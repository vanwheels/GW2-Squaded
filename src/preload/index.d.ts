import type { StorageAdapter } from '@shared/storage/storage-interface'
import type { GameDataProvider } from '@shared/game-data/game-data-provider'
import type { DataUpdateProvider } from '@shared/game-data/data-update-provider'
import type { CaptureProvider } from '@shared/capture/capture-provider'
import type { UpdaterProvider } from '@shared/updater/updater-provider'

declare global {
  interface Window {
    gw2Storage: StorageAdapter
    gw2GameData: GameDataProvider
    gw2Capture: CaptureProvider
    gw2Updater: UpdaterProvider
    gw2DataUpdate: DataUpdateProvider
  }
}
