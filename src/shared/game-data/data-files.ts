/**
 * Every `data/game-data/*.json` file `load-game-data.ts` reads at runtime, kept in sync by hand
 * (same "duplicated, not shared via tooling" tradeoff `worker/src/index.ts`'s own `ShareKind`
 * comment documents) — this is what the in-app data-update downloader
 * (`src/main/game-data/data-update.ts`) pulls from the published raw-GitHub blob. `meta.json`
 * itself is handled separately (its `gw2Build`/`fetchedAt` fields are the freshness signal,
 * checked before any of these are fetched) — not listed here.
 */
export const GAME_DATA_FILE_NAMES = [
  'professions.json',
  'specializations.json',
  'traits.json',
  'skills.json',
  'itemstats.json',
  'itemstat-icons.json',
  'itemstat-legal-ids.json',
  'elite-spec-skills.json',
  'glyph-form-variants.json',
  'skill-variant-exclusions.json',
  'wvw-fact-overrides.json',
  'legends.json',
  'pets.json',
  'familiars.json',
  'soulbeast-beastmode.json',
  'runes.json',
  'sigils.json',
  'infusions.json',
  'relics.json',
  'relic-effects.json',
  'food.json',
  'utility.json',
  'tome-chapters.json',
  'synthetic-facts.json',
  'synthetic-trait-facts.json'
] as const
