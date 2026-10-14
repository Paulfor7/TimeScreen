const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save',data),
  saveSync: data => ipcRenderer.sendSync('data:save-sync',data),
  onSuspend: callback => ipcRenderer.on('system:suspend',(_,time)=>callback(time)),
  notify: (title,body) => ipcRenderer.invoke('notify',{title,body}),
  export: (content,name) => ipcRenderer.invoke('export',{content,name})
});
