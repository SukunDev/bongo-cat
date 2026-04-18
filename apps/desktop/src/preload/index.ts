/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },
  store: {
    set: (name: string, value: any) => ipcRenderer.invoke('store:set', name, value),
    get: (name: string) => ipcRenderer.invoke('store:get', name),
    clear: () => ipcRenderer.invoke('store:clear')
  },
  bridge: {
    onEvent: (callback: (event: any) => void) => {
      ipcRenderer.on('bridge-event', (_event, data) => callback(data))
    },
    sendCommand: (command: object) => {
      ipcRenderer.send('bridge-command', command)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
