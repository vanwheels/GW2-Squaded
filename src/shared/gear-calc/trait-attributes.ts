import type { Build, Trait } from '../types'
import { addPoints, emptyTotals, type AttributeTotals } from './attribute-totals'

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

export interface TraitConversion {
  traitId: number
  source: string
  target: string
  percent: number
}

const CURATED_FLAT_BONUSES: TraitFlatBonus[] = [
  // Life Attunement (Revenant, Salvation, Minor tier 2) — "Gain healing power." Unambiguous
  // single-value AttributeAdjust fact; description confirms this is a genuine passive stat gain.
  { traitId: 1821, target: 'Healing', value: 120 }
]

const CURATED_CONVERSIONS: TraitConversion[] = [
  // Life Attunement — "Gain concentration based on a portion of your healing power." Wiki-verified
  // 2026-08-02 (wiki.guildwars2.com/wiki/Life_Attunement): 7% is the PvE **and** WvW value; 4% (the
  // raw API's other listed value) is competitive/PvP-only.
  { traitId: 1821, source: 'Healing', target: 'BoonDuration', percent: 7 }
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

  const conversions = activeTraitConversions(build, traitsById)
  const conversionBonus: Record<string, number> = {}
  for (const c of conversions) {
    conversionBonus[c.target] = (conversionBonus[c.target] ?? 0) + ((totals.points[c.source] ?? 0) * c.percent) / 100
  }
  for (const [target, bonus] of Object.entries(conversionBonus)) addPoints(totals, target, bonus)
}
