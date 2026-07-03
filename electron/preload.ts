import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopAPI', {
  getApiBaseUrl: (): Promise<string> => ipcRenderer.invoke('app:getApiBaseUrl')
});
