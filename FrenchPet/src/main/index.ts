import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { applyRetroactiveDecay, startDecayTimer, stopDecayTimer } from './decay-timer'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 480,
    minHeight: 720,
    maxWidth: 480,
    maxHeight: 720,
    resizable: false,
    title: 'FrenchPet',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

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
  electronApp.setAppUserModelId('com.frenchpet')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  initDatabase()

  // Apply retroactive decay for time elapsed while app was closed
  applyRetroactiveDecay()

  // Register IPC handlers
  registerIpcHandlers()

  const mainWindow = createWindow()

  // Start the decay timer
  startDecayTimer(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      startDecayTimer(newWindow)
    }
  })
})

app.on('window-all-closed', () => {
  stopDecayTimer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
