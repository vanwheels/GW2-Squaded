import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameData } from '@shared/types'

let cached: GameData | null = null

function readJson<T>(fileName: string): T {
  const filePath = join(app.getAppPath(), 'data', 'game-data', fileName)
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

/**
 * Loads the static game-data JSON written by `npm run fetch-game-data` (see
 * scripts/fetch-game-data.ts and docs/game-data.md). Reads from the app root, which works
 * for `electron-vite dev` today; packaging this as an `extraResources` entry in
 * electron-builder config is still pending (see TODO.md).
 */
export function loadGameData(): GameData {
  if (!cached) {
    cached = {
      professions: readJson('professions.json'),
      specializations: readJson('specializations.json'),
      traits: readJson('traits.json'),
      skills: readJson('skills.json'),
      itemStats: readJson('itemstats.json')
    }
  }
  return cached
}
