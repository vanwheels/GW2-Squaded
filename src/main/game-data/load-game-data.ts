import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameData } from '@shared/types'

let cached: GameData | null = null

// The main bundle lives at <projectRoot>/out/main/index.cjs (both in `electron-vite dev` and
// `electron-vite build` output) — __dirname is stable there, unlike `app.getAppPath()`, which
// resolves to `out/main` itself (not the project root) once running from the built bundle.
const DATA_DIR = join(__dirname, '..', '..', 'data', 'game-data')

function readJson<T>(fileName: string): T {
  const filePath = join(DATA_DIR, fileName)
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

/**
 * Loads the static game-data JSON written by `npm run fetch-game-data` (see
 * scripts/fetch-game-data.ts and docs/game-data.md). Reads straight from the repo's
 * data/game-data/ directory, which works unpackaged (dev and local `npm run build`); packaging
 * this as an `extraResources` entry in electron-builder config is still pending (see TODO.md).
 */
export function loadGameData(): GameData {
  if (!cached) {
    cached = {
      professions: readJson('professions.json'),
      specializations: readJson('specializations.json'),
      traits: readJson('traits.json'),
      skills: readJson('skills.json'),
      itemStats: readJson('itemstats.json'),
      itemStatIcons: readJson('itemstat-icons.json'),
      eliteSpecSkills: readJson('elite-spec-skills.json'),
      glyphFormVariants: readJson('glyph-form-variants.json'),
      wvwFactOverrides: readJson('wvw-fact-overrides.json'),
      legends: readJson('legends.json'),
      pets: readJson('pets.json'),
      runes: readJson('runes.json'),
      sigils: readJson('sigils.json'),
      infusions: readJson('infusions.json'),
      relics: readJson('relics.json'),
      relicEffects: readJson('relic-effects.json'),
      food: readJson('food.json'),
      utility: readJson('utility.json'),
      tomeChapters: readJson('tome-chapters.json')
    }
  }
  return cached
}
