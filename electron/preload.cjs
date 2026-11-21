const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (options) => ipcRenderer.invoke('print-receipt', options),
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close')
});
