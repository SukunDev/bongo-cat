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

interface BridgeAPI {
  onEvent: (callback: (event: BridgeEvent) => void) => void
  sendCommand: (command: object) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    bridgeAPI: BridgeAPI
  }
}
