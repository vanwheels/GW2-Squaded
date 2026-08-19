import type { GameData } from '@shared/types'
import { buildGameData } from '@shared/game-data/build-game-data'
import type { GameDataProvider } from '@shared/game-data/game-data-provider'

/**
 * The web-preview bundle's `GameDataProvider` — reads the same `data/game-data/*.json` files
 * Electron's `loadGameData()` does, via plain `fetch` against static assets instead of
 * `fs.readFileSync`. Those files are served from `/game-data/*.json` on the same worker origin
 * this page is deployed alongside (staged there at build time by
 * `scripts/sync-web-preview-game-data.ts` — see that script's doc comment for why this is a
 * build-time copy rather than a second committed copy). No caching here beyond the browser's own
 * HTTP cache: unlike Electron's long-lived main process, a render page's tab exists for exactly
 * one screenshot and is then torn down, so there's nothing to reuse a module-level cache across.
 */
export const webGameDataProvider: GameDataProvider = {
  getAll(): Promise<GameData> {
    return buildGameData((fileName) => fetch(`/game-data/${fileName}`).then((r) => r.json()))
  }
}
