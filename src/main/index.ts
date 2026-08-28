import { app, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createSqliteStorage } from './storage/sqlite-storage'
import { registerStorageIpc } from './ipc/storage-ipc'
import { registerGameDataIpc } from './ipc/game-data-ipc'
import { registerDataUpdateIpc } from './ipc/data-update-ipc'
import { registerCaptureIpc } from './ipc/capture-ipc'
import { registerUpdaterIpc } from './updater/auto-updater'
import { loadRenderer } from './renderer-url'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    // Floor for the below-1920 reflow work (2026-08-28) — layout below this is not designed for,
    // so just don't let the OS shrink the window past it rather than chasing arbitrarily small
    // sizes. 1024x720 covers small-laptop-sized windows, the narrowest case reflow targets.
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
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

  void loadRenderer(mainWindow)

  return mainWindow
}

app.whenReady().then(() => {
  const dbPath = join(app.getPath('userData'), 'gw2-squaded.sqlite')
  const storage = createSqliteStorage(dbPath)
  registerStorageIpc(storage)
  registerGameDataIpc()
  registerCaptureIpc()

  let mainWindow: BrowserWindow | null = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  registerUpdaterIpc(() => mainWindow)
  const { runAutoCheck } = registerDataUpdateIpc(() => mainWindow)
  // "Check on launch, prompt the user" (TODO.md's decided contract for this feature) — fired once
  // `ready-to-show` so the check's own IPC push doesn't race the renderer's status subscription,
  // which only wires up after React mounts.
  mainWindow.once('ready-to-show', runAutoCheck)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
