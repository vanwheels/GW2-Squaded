import { app, ipcMain, type BrowserWindow } from 'electron'
import { DataUpdateIpcChannel } from '@shared/game-data/ipc-channels'
import type { DataUpdateStatus } from '@shared/game-data/data-update-provider'
import { loadLocalMeta } from '../game-data/load-game-data'
import { checkForUpdate, downloadUpdate } from '../game-data/data-update'

/** Registers the game-data refresh IPC surface and returns a `runAutoCheck` function the caller
 *  fires once after launch — same "check on launch, prompt the user, no silent background
 *  refresh" contract TODO.md decided for this feature (a real user-visible status push either
 *  way, never an unattended download). */
export function registerDataUpdateIpc(getWindow: () => BrowserWindow | null): { runAutoCheck: () => void } {
  function broadcast(status: DataUpdateStatus): void {
    getWindow()?.webContents.send(DataUpdateIpcChannel.status, status)
  }

  ipcMain.handle(DataUpdateIpcChannel.getLocalMeta, () => loadLocalMeta())
  ipcMain.handle(DataUpdateIpcChannel.check, () => checkForUpdate(broadcast))
  ipcMain.handle(DataUpdateIpcChannel.download, () => downloadUpdate(broadcast))
  ipcMain.handle(DataUpdateIpcChannel.restartAndApply, () => {
    app.relaunch()
    app.exit(0)
  })

  return { runAutoCheck: () => void checkForUpdate(broadcast) }
}
