const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save',data),
  saveSync: data => ipcRenderer.sendSync('data:save-sync',data),
  onSuspend: callback => ipcRenderer.on('system:suspend',(_,time)=>callback(time)),
  getWindowMode: () => ipcRenderer.invoke('window:mode'),
  setCompact: value => ipcRenderer.invoke('window:compact',value),
  setPinned: value => ipcRenderer.invoke('window:pinned',value),
  onWindowMode: callback => ipcRenderer.on('window:mode-changed',(_,mode)=>callback(mode)),
  notify: (title,body) => ipcRenderer.invoke('notify',{title,body}),
  export: (content,name) => ipcRenderer.invoke('export',{content,name})
});
