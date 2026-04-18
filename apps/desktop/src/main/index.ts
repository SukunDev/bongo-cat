/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, shell, BrowserWindow, ipcMain, nativeTheme, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ElectronStore from 'electron-store'
import { startBridge, stopBridge, sendToBridge } from './lib/bridge'

const Store = (ElectronStore as any).default || ElectronStore

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 450,
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
    mainWindow!.show()
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

function createTray(): void {
  if (tray) return
  tray = new Tray(icon)
  tray.setToolTip('Bongo Cat')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show',
        click: (): void => {
          mainWindow?.show()
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: (): void => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', () => {
    mainWindow?.show()
  })
}

function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bongocat.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const store = new Store()

  // Apply saved auto-launch setting
  const autoLaunch = store.get('settings.openOnStartup', false)
  app.setLoginItemSettings({ openAtLogin: autoLaunch as boolean })

  // Apply saved system tray setting
  const useTray = store.get('settings.systemTray', false)
  if (useTray) createTray()

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
    const trayEnabled = store.get('settings.systemTray', false)
    if (trayEnabled && !isQuitting) {
      win?.hide()
    } else {
      win?.close()
    }
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

  // Settings IPC
  ipcMain.on('settings:autoLaunch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
  })
  ipcMain.on('settings:systemTray', (_event, enabled: boolean) => {
    if (enabled) {
      createTray()
    } else {
      destroyTray()
    }
  })

  // Bridge IPC
  ipcMain.on('bridge-command', (_event, command) => {
    sendToBridge(command)
  })

  const win = createWindow()
  startBridge(win)

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
