// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickFolder: async () => {
    return await ipcRenderer.invoke('pick-folder');
  },
  renameFile: async (fromPath, newBase) => {
    return await ipcRenderer.invoke('rename-file', { fromPath, newBase });
  },
  deleteFile: async (fullPath) => {
    return await ipcRenderer.invoke('delete-file', fullPath);
  },
  confirmDelete: async (fileName) => {
    return await ipcRenderer.invoke('confirm-delete', fileName);
  },
  showInFolder: (fullPath) => {
    ipcRenderer.send('show-in-folder', fullPath);
  }
});
