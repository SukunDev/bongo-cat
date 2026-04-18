/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElectronAPI } from '@electron-toolkit/preload'

interface BridgeEvent {
  type: 'status' | 'key' | 'error' | 'ready'
  connection?: string
  state?: string
  port?: string
  device?: string
  side?: string
  action?: string
  message?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
      }
      store: {
        set: (name: string, value: any) => Promise<void>
        get: (name: string) => Promise<any>
        clear: () => Promise<boolean>
      }
      bridge: {
        onEvent: (callback: (event: BridgeEvent) => void) => void
        sendCommand: (command: object) => void
      }
      settings: {
        setAutoLaunch: (enabled: boolean) => void
        setSystemTray: (enabled: boolean) => void
      }
    }
  }
}
