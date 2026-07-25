import type { GameData } from '../types'

/**
 * The renderer's only way to reach static GW2 game data — reached via the preload-exposed
 * `window.gw2GameData` bridge (see src/preload/index.ts). Mirrors the StorageAdapter seam:
 * a future Capacitor build implements this against bundled assets instead of Electron IPC,
 * and the renderer code doesn't change.
 */
export interface GameDataProvider {
  getAll(): Promise<GameData>
}
