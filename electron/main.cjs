const {app, BrowserWindow, ipcMain, dialog, Notification, powerMonitor, screen} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {APP_ID, launchDetails} = require('./windows-launch.cjs');
const {compactBounds} = require('./window-layout.cjs');
if(process.platform === 'win32') app.setAppUserModelId(APP_ID);
let win;
if(process.env.TIMESCREEN_DATA_DIR) app.setPath('userData', path.resolve(process.env.TIMESCREEN_DATA_DIR));
const dataPath = () => path.join(app.getPath('userData'), 'timescreen.json');
let layout={},compact=false,changingLayout=false,layoutTimer;
const layoutPath=()=>path.join(app.getPath('userData'),'window-state.json');
const windowMode=()=>({compact,pinned:!!win?.isAlwaysOnTop()});
function saveLayout(){
  if(!win||win.isDestroyed()||changingLayout)return;
  if(compact)layout.compactBounds=win.getBounds();
  layout.compact=compact;
  try{fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(layoutPath()+'.tmp',JSON.stringify(layout));fs.renameSync(layoutPath()+'.tmp',layoutPath());}catch{}
}
const validNormalBounds=b=>b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>=1024&&b.height>=740;
function setCompact(value,restoring=false){
  value=value===true;
  if(value===compact)return windowMode();
  changingLayout=true;
  if(value){
    if(!restoring||!validNormalBounds(layout.normalBounds))layout.normalBounds=win.getNormalBounds();if(!restoring)layout.wasMaximized=win.isMaximized();
    if(win.isMaximized())win.unmaximize();
    win.setMinimumSize(280,210);win.setResizable(false);win.setMaximizable(false);win.setFullScreenable(false);compact=true;
    win.setBounds(compactBounds(layout.compactBounds,screen.getAllDisplays().map(d=>d.workArea)));
    win.setAlwaysOnTop(layout.pinned!==false);
  }else{
    layout.compactBounds=win.getBounds();compact=false;win.setAlwaysOnTop(false);win.setResizable(true);win.setMaximizable(true);win.setFullScreenable(true);win.setMinimumSize(1024,740);
    if(validNormalBounds(layout.normalBounds)){const b=layout.normalBounds,a=screen.getDisplayMatching(b).workArea;win.setBounds({...b,x:Math.max(a.x,Math.min(a.x+Math.max(0,a.width-b.width),b.x)),y:Math.max(a.y,Math.min(a.y+Math.max(0,a.height-b.height),b.y))});}
    if(layout.wasMaximized)win.maximize();
  }
  changingLayout=false;saveLayout();win.webContents.send('window:mode-changed',windowMode());return windowMode();
}
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
    try{layout=JSON.parse(fs.readFileSync(layoutPath(),'utf8'));if(!layout||typeof layout!=='object'||Array.isArray(layout))layout={};}catch{layout={};}
    ipcMain.handle('window:mode',()=>windowMode());
    ipcMain.handle('window:compact',(event,value)=>event.sender===win.webContents?setCompact(value):windowMode());
    ipcMain.handle('window:pinned',(event,value)=>{if(event.sender===win.webContents&&compact){layout.pinned=value===true;win.setAlwaysOnTop(layout.pinned);saveLayout();win.webContents.send('window:mode-changed',windowMode());}return windowMode();});
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
    win = new BrowserWindow({width: 1440,height: 960,minWidth: 1024,minHeight: 740,show:false,backgroundColor:'#f5f6f8',title:'TimeScreen',icon:path.join(__dirname,'../assets/icon.png'),autoHideMenuBar: true, webPreferences: {preload: path.join(__dirname,'preload.cjs'),contextIsolation: true,nodeIntegration: false,backgroundThrottling:false}});
    if(layout.compact===true)setCompact(true,true);
    const remember=()=>{clearTimeout(layoutTimer);layoutTimer=setTimeout(saveLayout,200);};
    win.on('move',remember);win.on('resize',remember);win.on('close',()=>{clearTimeout(layoutTimer);saveLayout();});
    win.once('ready-to-show',()=>win.show());
    if(process.platform === 'win32') win.setAppDetails(launchDetails({packaged: app.isPackaged}));
    win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    win.webContents.on('will-navigate', e => e.preventDefault());
    powerMonitor.on('suspend',()=>win?.webContents.send('system:suspend',Date.now()));
    win.loadFile(path.join(__dirname,'../dist/index.html'));
  });
  app.on('window-all-closed',()=>app.quit());
}
