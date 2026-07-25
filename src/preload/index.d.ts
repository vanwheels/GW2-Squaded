import type { StorageAdapter } from '@shared/storage/storage-interface'
import type { GameDataProvider } from '@shared/game-data/game-data-provider'

declare global {
  interface Window {
    gw2Storage: StorageAdapter
    gw2GameData: GameDataProvider
  }
}
