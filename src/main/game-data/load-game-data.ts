import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { Fact, GameData, Skill } from '@shared/types'

let cached: GameData | null = null

// Unpackaged (dev and local `npm run build`), the main bundle lives at
// <projectRoot>/out/main/index.cjs — __dirname is stable there, unlike `app.getAppPath()`, which
// resolves to `out/main` itself (not the project root). Packaged, electron-builder.yml ships
// data/game-data/ as an `extraResources` entry (outside app.asar, since native-module-adjacent
// resources and large static data don't need to go through the archive), landing at
// process.resourcesPath/data/game-data.
const DATA_DIR = app.isPackaged
  ? join(process.resourcesPath, 'data', 'game-data')
  : join(__dirname, '..', '..', 'data', 'game-data')

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
/**
 * Merges `synthetic-facts.json` into each skill's `.facts` — hand-curated, wiki-sourced `Fact`
 * objects for skills the GW2 API returns with no real fact of the needed shape at all. Two use
 * cases share this one file/mechanism: (1) a skill has a real wiki-documented Healing/Damage
 * coefficient but no live-API fact of the matching `type`/`target`/`text` to key
 * `CURATED_HEALING_COEFFICIENTS`/`CURATED_DAMAGE_COEFFICIENTS` off at all (first hit: Mesmer's Tale
 * of the Second Scion, id 76695 — a live API pull returns zero `AttributeAdjust`/Healing facts); (2)
 * TODO.md's "some skills' real effects live entirely outside the GW2 API's `facts` array" bug
 * (`scripts/scan-empty-effect-facts.ts`'s 35-skill findings, e.g. Engineer's Detonate Elixir H
 * granting Protection/Regeneration/Swiftness with zero API facts beyond Range/Recharge) — there a
 * synthetic `Buff` fact (`status`/`duration`/`apply_count`, same shape a real API Buff fact uses)
 * flows through `extractFromFacts`/`boonConditionFactsForSkill` exactly like a real one, showing up
 * in both the skill's own tooltip and the whole-build boon/condition bar with no extra plumbing.
 * Every downstream consumer walks `skill.facts` to decide which lines/boons even exist before any
 * curated table or classifier ever runs — merging here, once, means every consumer (tooltip
 * rendering, curated-coefficient gating, generic fact fallback, boon-bar aggregation) sees the
 * synthetic fact identically to a real one, with no special-casing anywhere else. See
 * docs/game-data.md for the full writeup and when to add a new entry.
 */
function withSyntheticFacts(skills: Skill[]): Skill[] {
  const syntheticFacts = readJson<Record<string, Fact[]>>('synthetic-facts.json')
  return skills.map((skill) => {
    const extra = syntheticFacts[skill.id]
    return extra ? { ...skill, facts: [...skill.facts, ...extra] } : skill
  })
}

export function loadGameData(): GameData {
  if (!cached) {
    cached = {
      professions: readJson('professions.json'),
      specializations: readJson('specializations.json'),
      traits: readJson('traits.json'),
      skills: withSyntheticFacts(readJson('skills.json')),
      itemStats: readJson('itemstats.json'),
      itemStatIcons: readJson('itemstat-icons.json'),
      itemStatLegalIds: readJson('itemstat-legal-ids.json'),
      eliteSpecSkills: readJson('elite-spec-skills.json'),
      glyphFormVariants: readJson('glyph-form-variants.json'),
      skillVariantExclusions: readJson('skill-variant-exclusions.json'),
      wvwFactOverrides: readJson('wvw-fact-overrides.json'),
      legends: readJson('legends.json'),
      pets: readJson('pets.json'),
      familiars: readJson('familiars.json'),
      soulbeastBeastmode: readJson('soulbeast-beastmode.json'),
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
