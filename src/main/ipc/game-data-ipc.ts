import { ipcMain } from 'electron'
import { GameDataIpcChannel } from '@shared/game-data/ipc-channels'
import { loadGameData } from '../game-data/load-game-data'

export function registerGameDataIpc(): void {
  ipcMain.handle(GameDataIpcChannel.getAll, () => loadGameData())
}
