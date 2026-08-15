import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { Fact, GameData, Skill, Trait } from '@shared/types'
import type { GameDataMeta } from '@shared/game-data/data-update-provider'

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

/**
 * `synthetic-trait-facts.json`'s merge — `withSyntheticFacts`'s trait counterpart, same `{
 * [id]: Fact[] }` shape and same once-at-load-time merge onto `.facts`, kept as a separate file/id
 * namespace rather than folded into `synthetic-facts.json` since skill ids and trait ids are
 * independent sequences that could collide. Covers dodge-roll traits whose real Buff fact lives on a
 * separate un-equippable "proc skill" entity `skillIdsForBuild` never includes: Warrior's Reckless
 * Dodge 1446 ↔ proc skill Reckless Impact 14268; Guardian/Vindicator's Saint of zu Heltzer 2238
 * (already carries its own "Saint of zu Heltzer" buff fact, but its Alacrity grant lives only on proc
 * skill Saint's Shield 62689); Vindicator's Forerunner of Death 2257 (own "Forerunner of Death" buff
 * fact present, Vulnerability grant lives only on proc skill Death Drop 62693); and Vindicator's
 * Vassals of the Empire 2232, whose `facts` array is entirely empty on the trait itself — every
 * number here comes from proc skill Imperial Impact 62859 instead. The latter two were missed by the
 * 2026-08-15 dodge sweep that seeded `DODGE_TRIGGER_NOTES` (see that table's own doc comment) because
 * that sweep searched `traits.json` descriptions for the substring "dodge", and both of these traits'
 * descriptions say "Dodging" — which doesn't contain "dodge" as a substring (no "e" before the "i").
 * User-flagged 2026-08-15; TODO.md's dodge-roll item now also tracks the other ~10 "Dodging"-worded
 * traits that same substring gap missed, not yet individually triaged. See TODO.md/docs/game-data.md
 * for the full writeup. Copied verbatim from each proc skill's own fact (WvW value where the wiki
 * splits by game mode — Imperial Impact's Might/Protection use `wvw-fact-overrides.json`'s existing
 * 8s/2s WvW entry rather than the API's raw PvE 10s/5s) so `BUFF_INSTANCE_LABELS`/
 * `DODGE_TRIGGER_NOTES`/`TARGET_COUNT_OVERRIDES` (all keyed by `sourceKind`+`sourceId`) resolve
 * against the TRAIT's id once merged, not the proc skill's — each proc skill's own pre-existing
 * `TARGET_COUNT_OVERRIDES` entry is left in place as historical documentation even though that skill
 * id is never reached by `skillIdsForBuild`.
 */
function withSyntheticTraitFacts(traits: Trait[]): Trait[] {
  const syntheticTraitFacts = readJson<Record<string, Fact[]>>('synthetic-trait-facts.json')
  return traits.map((trait) => {
    const extra = syntheticTraitFacts[trait.id]
    return extra ? { ...trait, facts: [...trait.facts, ...extra] } : trait
  })
}

export function loadGameData(): GameData {
  if (!cached) {
    cached = {
      professions: readJson('professions.json'),
      specializations: readJson('specializations.json'),
      traits: withSyntheticTraitFacts(readJson('traits.json')),
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
