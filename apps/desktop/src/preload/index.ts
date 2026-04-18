import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

contextBridge.exposeInMainWorld('electron', electronAPI)

contextBridge.exposeInMainWorld('bridgeAPI', {
  onEvent: (callback: (event: unknown) => void): void => {
    ipcRenderer.on('bridge-event', (_event, data) => callback(data))
  },
  sendCommand: (command: object): void => {
    ipcRenderer.send('bridge-command', command)
  }
})
