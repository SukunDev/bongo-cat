/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ElectronStore from 'electron-store'
import { startBridge, stopBridge, sendToBridge } from './lib/bridge'

const Store = (ElectronStore as any).default || ElectronStore

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  nativeTheme.themeSource = 'dark'
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bongocat.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const store = new Store()

  // Window controls
  ipcMain.on('window:minimize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    win?.minimize()
  })
  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('window:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    win?.close()
  })

  // Store
  ipcMain.handle('store:set', (_event, name: string, value: any) => {
    store.set(name, value)
  })
  ipcMain.handle('store:get', (_event, name: string) => {
    return store.get(name)
  })
  ipcMain.handle('store:clear', () => {
    store.clear()
    return true
  })

  // Bridge IPC
  ipcMain.on('bridge-command', (_event, command) => {
    sendToBridge(command)
  })

  const mainWindow = createWindow()
  startBridge(mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBridge()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
