import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { GameData } from '@shared/types'
import type { GameDataMeta } from '@shared/game-data/data-update-provider'
import { buildGameData } from '@shared/game-data/build-game-data'

let cached: GameData | null = null

// Unpackaged (dev and local `npm run build`), the main bundle lives at
// <projectRoot>/out/main/index.cjs — __dirname is stable there, unlike `app.getAppPath()`, which
// resolves to `out/main` itself (not the project root). Packaged, electron-builder.yml ships
// data/game-data/ as an `extraResources` entry (outside app.asar, since native-module-adjacent
// resources and large static data don't need to go through the archive), landing at
// process.resourcesPath/data/game-data.
const BUNDLED_DATA_DIR = app.isPackaged
  ? join(process.resourcesPath, 'data', 'game-data')
  : join(__dirname, '..', '..', 'data', 'game-data')

// A downloaded game-data refresh (src/main/game-data/data-update.ts) writes a full replacement
// copy here, in the writable userData directory, rather than overwriting BUNDLED_DATA_DIR (not
// writable once packaged, and overwriting a repo-committed dev copy would be a confusing git-status
// surprise). Preferred over BUNDLED_DATA_DIR whenever present — its own meta.json's presence is
// what marks it "complete" (downloadUpdate() writes every other file first, meta.json last).
export const OVERRIDE_DATA_DIR = join(app.getPath('userData'), 'game-data')

function resolveDataDir(): string {
  return existsSync(join(OVERRIDE_DATA_DIR, 'meta.json')) ? OVERRIDE_DATA_DIR : BUNDLED_DATA_DIR
}

function readJson<T>(fileName: string): T {
  const filePath = join(resolveDataDir(), fileName)
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

/** The currently-active copy's `meta.json` — read fresh every call (unlike `loadGameData()`,
 *  never cached), since the update-check flow needs it to reflect a just-downloaded override
 *  without requiring a restart first. */
export function loadLocalMeta(): GameDataMeta {
  return readJson<GameDataMeta>('meta.json')
}

/**
 * Loads the static game-data JSON written by `npm run fetch-game-data` (see
 * scripts/fetch-game-data.ts and docs/game-data.md). Reads straight from the repo's
 * data/game-data/ directory, which works unpackaged (dev and local `npm run build`); packaging
 * this as an `extraResources` entry in electron-builder config is still pending (see TODO.md).
 *
 * The actual file-assembly/merge logic (including the synthetic-facts/tango-icons overlays —
 * see `docs/game-data.md` for the full writeup of what each one is and when to add to it, e.g.
 * synthetic-trait-facts.json's dodge-roll proc-skill traits, the "Dogding" typo gap, the Saint of
 * zu Heltzer reversal) lives in `@shared/game-data/build-game-data.ts`'s `buildGameData()` — moved
 * there 2026-08-19 so the Discord bot's `/builddisplay` web-preview render page can assemble the
 * identical `GameData` shape from a `fetch`-based reader instead of this file's `fs`-based one,
 * with zero duplicated merge logic. This function is now just Electron's `JsonReader` plus the
 * on-disk directory resolution (`resolveDataDir()`) and the module-level cache below.
 */
export async function loadGameData(): Promise<GameData> {
  if (!cached) {
    cached = await buildGameData(readJson)
  }
  return cached
}
