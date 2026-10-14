const {app, BrowserWindow, ipcMain, dialog, Notification, powerMonitor} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
let win;
if(process.env.TIMESCREEN_DATA_DIR) app.setPath('userData', path.resolve(process.env.TIMESCREEN_DATA_DIR));
const dataPath = () => path.join(app.getPath('userData'), 'timescreen.json');
function saveData(data) {
  const file = dataPath();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file+'.tmp', JSON.stringify(data), 'utf8');
  if(fs.existsSync(file)) fs.copyFileSync(file, file+'.bak');
  fs.renameSync(file+'.tmp', file);
  return true;
}
function readData() {
  for (const file of [dataPath(), dataPath()+'.bak']) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return null;
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if(win) { if(win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    ipcMain.handle('data:load', readData);
    ipcMain.handle('data:save', (_, data) => saveData(data));
    ipcMain.on('data:save-sync', (event, data) => {
      try { event.returnValue = saveData(data); } catch { event.returnValue = false; }
    });
    ipcMain.handle('notify', (_, {title, body}) => { if(Notification.isSupported()) new Notification({title,body}).show(); });
    ipcMain.handle('export', async (_, {content, name}) => {
      const result = await dialog.showSaveDialog(win, {defaultPath: name});
      if (!result.canceled) { fs.writeFileSync(result.filePath, content, 'utf8'); return true; }
      return false;
    });
    win = new BrowserWindow({width: 1440,height: 960,minWidth: 1024,minHeight: 740,backgroundColor:'#f5f6f8',title:'TimeScreen',icon:path.join(__dirname,'../assets/icon.png'),autoHideMenuBar: true, webPreferences: {preload: path.join(__dirname,'preload.cjs'),contextIsolation: true,nodeIntegration: false,backgroundThrottling:false}});
    win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    win.webContents.on('will-navigate', e => e.preventDefault());
    powerMonitor.on('suspend',()=>win?.webContents.send('system:suspend',Date.now()));
    win.loadFile(path.join(__dirname,'../dist/index.html'));
  });
  app.on('window-all-closed',()=>app.quit());
}
