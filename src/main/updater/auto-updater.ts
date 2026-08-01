import { app, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { UpdaterIpcChannel } from '@shared/updater/ipc-channels'
import type { UpdateStatus } from '@shared/updater/updater-provider'

// electron-updater's auto-update flow (via NSIS) is only wired up for Windows builds — see
// electron-builder.yml. `app.isPackaged` also gates it off in dev, where there's no packaged
// installer for electron-updater to diff/replace.
const SUPPORTED = process.platform === 'win32'

export function registerUpdaterIpc(getWindow: () => BrowserWindow | null): void {
  // Manual flow: 'available' is a real user-visible step the renderer surfaces a button for,
  // rather than silently downloading the moment a check finds something newer.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  function broadcast(status: UpdateStatus): void {
    getWindow()?.webContents.send(UpdaterIpcChannel.status, status)
  }

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => broadcast({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => broadcast({ state: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    broadcast({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => broadcast({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => broadcast({ state: 'error', message: err.message }))

  ipcMain.handle(UpdaterIpcChannel.getAppVersion, () => app.getVersion())
  ipcMain.handle(UpdaterIpcChannel.isSupported, () => SUPPORTED && app.isPackaged)

  ipcMain.handle(UpdaterIpcChannel.check, async () => {
    if (!SUPPORTED || !app.isPackaged) return
    await autoUpdater.checkForUpdates()
  })
  ipcMain.handle(UpdaterIpcChannel.download, async () => {
    if (!SUPPORTED || !app.isPackaged) return
    await autoUpdater.downloadUpdate()
  })
  ipcMain.handle(UpdaterIpcChannel.install, () => {
    if (!SUPPORTED || !app.isPackaged) return
    autoUpdater.quitAndInstall()
  })
}
