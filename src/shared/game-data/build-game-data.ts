import type { Fact, GameData, Profession, Specialization, Skill, Trait } from '../types'

/**
 * Reads and parses one named file from whatever game-data source is active — `data/game-data/`
 * on disk for Electron (`src/main/game-data/load-game-data.ts`), an HTTP `fetch` of statically
 * hosted copies for the web-preview bundle (`src/web-preview/load-game-data-web.ts`). Sync or
 * async either way (a plain object is a valid "already resolved" value to `await`), so one
 * `buildGameData` body below serves both callers.
 */
export type JsonReader = <T>(fileName: string) => Promise<T> | T

/**
 * `synthetic-facts.json`'s merge — hand-curated, wiki-sourced `Fact` objects for skills the GW2
 * API returns with no real fact of the needed shape at all. See
 * `src/main/game-data/load-game-data.ts`'s (pre-extraction) doc comment / `docs/game-data.md` for
 * the full writeup of why this file exists and when to add to it — that reasoning didn't move
 * with the code, only the mechanism did.
 */
function withSyntheticFacts(skills: Skill[], syntheticFacts: Record<string, Fact[]>): Skill[] {
  return skills.map((skill) => {
    const extra = syntheticFacts[skill.id]
    return extra ? { ...skill, facts: [...skill.facts, ...extra] } : skill
  })
}

/** `synthetic-trait-facts.json`'s merge — `withSyntheticFacts`'s trait counterpart. See
 *  `docs/game-data.md` for the full writeup (dodge-roll proc-skill traits, the "Dogding" typo gap,
 *  the Saint of zu Heltzer reversal, etc.) — unchanged by this extraction. */
function withSyntheticTraitFacts(traits: Trait[], syntheticTraitFacts: Record<string, Fact[]>): Trait[] {
  return traits.map((trait) => {
    const extra = syntheticTraitFacts[trait.id]
    return extra ? { ...trait, facts: [...trait.facts, ...extra] } : trait
  })
}

/** `tango-icons.json`'s merge — see `Profession.tangoIcon`/`Specialization.tangoIcon` and
 *  `scripts/fetch-tango-icons.ts` for why this is a separate wiki-sourced file rather than a field
 *  `fetch-game-data.ts` itself produces. */
function withTangoIcons(
  professions: Profession[],
  specializations: Specialization[],
  tangoIcons: { professions: Record<string, string>; specializations: Record<string, string> }
): [Profession[], Specialization[]] {
  const mergedProfessions = professions.map((p) => ({ ...p, tangoIcon: tangoIcons.professions[p.id] }))
  const mergedSpecializations = specializations.map((s) => {
    const tangoIcon = tangoIcons.specializations[String(s.id)]
    return tangoIcon ? { ...s, tangoIcon } : s
  })
  return [mergedProfessions, mergedSpecializations]
}

/**
 * Assembles the full `GameData` object from `data/game-data/*.json` (see `docs/game-data.md`),
 * given a `readJson` that knows how to fetch one named file — extracted out of
 * `src/main/game-data/load-game-data.ts`'s `loadGameData()` (2026-08-19, for the Discord bot's
 * `/builddisplay` web-preview render page) so the exact same assembly/merge logic — including the
 * synthetic-facts/tango-icons overlays — runs identically whether the reader is Electron's
 * `fs.readFileSync` or the web-preview bundle's `fetch`. Callers own caching (Electron's
 * `loadGameData()` keeps its own module-level cache; a browser tab has no equivalent need since
 * it only ever calls this once per page load).
 */
export async function buildGameData(readJson: JsonReader): Promise<GameData> {
  const [professions, specializations] = withTangoIcons(
    await readJson('professions.json'),
    await readJson('specializations.json'),
    await readJson('tango-icons.json')
  )
  return {
    professions,
    specializations,
    traits: withSyntheticTraitFacts(await readJson('traits.json'), await readJson('synthetic-trait-facts.json')),
    skills: withSyntheticFacts(await readJson('skills.json'), await readJson('synthetic-facts.json')),
    itemStats: await readJson('itemstats.json'),
    itemStatIcons: await readJson('itemstat-icons.json'),
    itemStatLegalIds: await readJson('itemstat-legal-ids.json'),
    eliteSpecSkills: await readJson('elite-spec-skills.json'),
    glyphFormVariants: await readJson('glyph-form-variants.json'),
    skillVariantExclusions: await readJson('skill-variant-exclusions.json'),
    wvwFactOverrides: await readJson('wvw-fact-overrides.json'),
    legends: await readJson('legends.json'),
    pets: await readJson('pets.json'),
    familiars: await readJson('familiars.json'),
    soulbeastBeastmode: await readJson('soulbeast-beastmode.json'),
    runes: await readJson('runes.json'),
    sigils: await readJson('sigils.json'),
    infusions: await readJson('infusions.json'),
    relics: await readJson('relics.json'),
    relicEffects: await readJson('relic-effects.json'),
    food: await readJson('food.json'),
    utility: await readJson('utility.json'),
    tomeChapters: await readJson('tome-chapters.json')
  }
}
