import type { Build, Trait } from '../types'
import { addPoints, applyConversions, emptyTotals, type AttributeConversion, type AttributeTotals } from './attribute-totals'

/**
 * Traits can grant a flat attribute bonus (`AttributeAdjust` fact) or convert a percentage of one
 * attribute into another (`BuffConversion` fact) — a contribution previously entirely unmodeled in
 * `computeGearAttributeTotals`/`computeCharacterStats`, discovered by the user cross-checking
 * against gw2skills.net. Confirmed live 2026-08-02 via a full `traits.json` scan: 193 traits carry
 * at least one such fact — but **the fact type alone does not mean "you passively gain this"**:
 * verified live that "Healer's Gift" (Revenant/Salvation minor) carries an unambiguous single-value
 * `AttributeAdjust` (197 Healing) that is NOT a stat grant at all — it's the base-heal coefficient
 * for that trait's own proc ("The end of your dodge roll heals nearby allies"), i.e. skill-tooltip
 * math reusing the same fact type. Only `AttributeAdjust`/`BuffConversion` facts on traits whose
 * *description* is itself an unconditional "you gain/convert this" (no proc/skill/condition
 * language) are genuine character-stat contributions — this can't be told apart reliably from the
 * fact data alone, so (same as `CURATED_RELIC_DAMAGE_BONUSES`/`FURY_CRIT_CHANCE_TRAIT_BONUSES`
 * elsewhere in this codebase) this is a hand-curated, individually-verified whitelist, not an
 * automatic parse-everything pipeline. Traits not listed here contribute nothing — fails open,
 * same convention as `glyphFormVariants`/`skillVariantExclusions`. See TODO.md for the process to
 * add more (there are ~190 unverified candidates from the `traits.json` scan).
 */
export interface TraitFlatBonus {
  traitId: number
  target: string
  value: number
}

export interface TraitConversion extends AttributeConversion {
  traitId: number
}

const CURATED_FLAT_BONUSES: TraitFlatBonus[] = [
  // Life Attunement (Revenant, Salvation, Minor tier 2) — "Gain healing power." Unambiguous
  // single-value AttributeAdjust fact; description confirms this is a genuine passive stat gain.
  { traitId: 1821, target: 'Healing', value: 120 },
  // Compounding Chemicals (Engineer, Alchemy, Minor GM) — "Gain increased concentration." Wiki-
  // verified 2026-08-12 (wiki.guildwars2.com/wiki/Compounding_Chemicals raw wikitext): split
  // pve=240/wvw+pvp=75; this app is WvW-focused so 75. The trait's other AttributeAdjust fact (37
  // Healing, coefficient 0.023) is the proc-heal-on-boon-grant, not a stat grant — excluded.
  { traitId: 413, target: 'BoonDuration', value: 75 },
  // Chemical Rounds (Engineer, Firearms, Major Adept) — "Gain condition damage." Wiki-verified
  // 2026-08-12: single game-mode-agnostic value (+120). The trait's other effect (pistol condition
  // duration) is a skill-specific modifier, not a character-stat gain — out of scope for this table.
  { traitId: 1878, target: 'ConditionDamage', value: 120 },
  // Thermal Vision (Engineer, Firearms, Major Master) — "Gain expertise." Wiki-verified 2026-08-12
  // (raw wikitext): split game mode=pve 150 / game mode=pvp wvw 60; WvW value is 60.
  { traitId: 2006, target: 'ConditionDuration', value: 60 },
  // Hybrid Vigor (Engineer, Amalgam, Minor Master) — "Gain vitality." Wiki-verified 2026-08-12 (raw
  // wikitext): single game-mode-agnostic value (+240), unlike this same trait's morph-skill barrier
  // proc (split pve/wvw/pvp), which is out of scope for this table.
  { traitId: 2389, target: 'Vitality', value: 240 }
]

const CURATED_CONVERSIONS: TraitConversion[] = [
  // Life Attunement — "Gain concentration based on a portion of your healing power." Wiki-verified
  // 2026-08-02 (wiki.guildwars2.com/wiki/Life_Attunement): 7% is the PvE **and** WvW value; 4% (the
  // raw API's other listed value) is competitive/PvP-only.
  { traitId: 1821, source: 'Healing', target: 'BoonDuration', percent: 7 },
  // Quiet Intensity (Mesmer, Virtuoso, Minor GM) — "Gain ferocity based on your vitality." Wiki-
  // verified 2026-08-12 (wiki.guildwars2.com/wiki/Quiet_Intensity): 10% is a single game-mode-
  // agnostic value, unlike this same trait's *other* effect ("Fury gives an increased critical
  // chance," 15% PvE / 10% WvW/PvP — that half is conditional-on-Fury, tracked separately in
  // `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`, not here).
  { traitId: 2193, source: 'Vitality', target: 'CritDamage', percent: 10 },
  // Blast Shield (Engineer, Explosives, Major Master) — "Gain vitality based on a percentage of
  // your power." Wiki-verified 2026-08-12 (raw wikitext: `{{skill fact|gain|Vitality|Power|10}}`,
  // no game-mode split). This trait's other effect (Explosive Entrance barrier, split pve/wvw pvp)
  // is a proc, not a stat grant — excluded.
  { traitId: 1944, source: 'Power', target: 'Vitality', percent: 10 }
]

/**
 * Every trait currently active on a build: every Minor trait of an equipped specialization line
 * (auto-granted, no selection needed) plus whichever Major trait was actually chosen per tier.
 */
function activeTraitIds(build: Build, traitsById: Map<number, Trait>): Set<number> {
  const active = new Set<number>()
  for (const line of build.specializations) {
    if (!line) continue
    const chosenIds = new Set(line.chosenTraitIds.filter((id): id is number => id !== null))
    for (const trait of traitsById.values()) {
      if (trait.specializationId !== line.specializationId) continue
      if (trait.slot === 'Minor' || chosenIds.has(trait.id)) active.add(trait.id)
    }
  }
  return active
}

/** Flat attribute-point bonuses from every currently-active, curated trait — gear-independent,
 *  safe to compute once regardless of what else is being varied (e.g. by the Gear Optimizer's
 *  search). */
export function activeTraitFlatBonuses(build: Build, traitsById: Map<number, Trait>): AttributeTotals {
  const active = activeTraitIds(build, traitsById)
  const totals = emptyTotals()
  for (const bonus of CURATED_FLAT_BONUSES) {
    if (active.has(bonus.traitId)) addPoints(totals, bonus.target, bonus.value)
  }
  return totals
}

/** Every currently-active, curated trait conversion, unresolved (the source attribute's *final*
 *  value — after gear, runes, other trait bonuses, everything — isn't known until the rest of the
 *  totals are assembled, so this just lists what to apply; see `applyTraitBonuses`). */
export function activeTraitConversions(build: Build, traitsById: Map<number, Trait>): TraitConversion[] {
  const active = activeTraitIds(build, traitsById)
  return CURATED_CONVERSIONS.filter((c) => active.has(c.traitId))
}

/** Applies every active trait's flat bonuses, then every active conversion computed from the
 *  resulting totals (not chained/compounding — every conversion reads the same post-flat-bonus
 *  snapshot, matching how the game itself computes simultaneous conversions), directly mutating
 *  `totals`. Call after every other additive contribution (gear/runes/food/utility/combat state)
 *  is already in `totals`, since conversions need the real final source-attribute value. */
export function applyTraitBonuses(totals: AttributeTotals, build: Build, traitsById: Map<number, Trait>): void {
  const flat = activeTraitFlatBonuses(build, traitsById)
  for (const [k, v] of Object.entries(flat.points)) addPoints(totals, k, v)

  applyConversions(totals, activeTraitConversions(build, traitsById))
}
