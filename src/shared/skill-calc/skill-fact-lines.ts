import type { Fact, RechargeWvwOverrides, ResourceCostsById, Skill } from '../types'
import { factLine, type FactLine } from './fact-numbers'
import { healingLinesForSkill } from './healing-calc'
import { barrierLinesForSkill } from './barrier-calc'
import { damageLinesForSkill } from './damage-calc'
import { siphonDamageLinesForSkill } from './siphon-damage-calc'
import { withRechargeOverride } from './recharge-override'
import { resourceCostLines } from './resource-cost-lines'
import { CLEANSING_IRE_CLEANSE_FACTS } from '../boon-calc/sources'

/**
 * Curated per-skill overrides for `Percent`-type facts the GW2 API duplicates once per game mode
 * with no mode-selector field of its own (unlike `Damage`'s `dmg_multiplier`, which already carries
 * a real PvE/WvW+PvP split — see `CURATED_DAMAGE_COEFFICIENTS`) — so every duplicate renders flat,
 * unfiltered, in `factLine`'s generic fallback. Matched by the fact's own `(text, percent)` pair
 * (not `text` alone, since both duplicates of a given label share the same `text` and differ only
 * in `percent`) to a `'drop'` (this is the other game mode's duplicate, discard it entirely) or a
 * `displayText` (this occurrence is correctly the one this app should show, but the API's own
 * `text` field on it is wrong — rename it before rendering).
 *
 * Blossoming Aura (scepter, id 71816) is the only entry today, resolved against the wiki's raw
 * `{{skill fact}}` templates (fetched fresh 2026-08-14, not the API — the API has no mode field on
 * `Percent` facts to trust here) rather than guessed from screenshots. WvW selected throughout,
 * matching this app's existing WvW-first convention for every other curated coefficient on this
 * skill (`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`, both barrier-calc.ts and
 * damage-calc.ts already pick the WvW+PvP value for this exact skill's Damage/Barrier facts):
 *   - "Damage Increase per Interval" 50%(PvE)/25%(WvW+PvP) -> keep 25%, drop 50%
 *   - "Max Damage Increase" 150%(PvE)/25%(WvW+PvP) -> keep 25%, drop 150%
 *   - "Barrier Increase per Interval" 33.333%(PvE+PvP)/20%(WvW) -> keep 20%, drop 33.333%
 *   - "Max Barrier" 100%(PvE+PvP)/60%(WvW) -> keep 60%, drop 100%
 * The wiki's WvW "Barrier Increase per Interval" (20%) entry comes back from the live API mislabeled
 * as `text: "Damage Increase per Interval"` (confirmed against the wiki template, which has no such
 * ambiguity) sharing the Barrier fact's own icon rather than the Damage facts' icon — an API data
 * bug, not a genuine 5th duplicate — so that one occurrence is relabeled rather than dropped.
 */
const CURATED_PERCENT_FACT_OVERRIDES: Record<number, Array<{ text: string; percent: number; action: 'drop' | { displayText: string } }>> = {
  71816: [
    { text: 'Damage Increase per Interval', percent: 50, action: 'drop' },
    { text: 'Max Damage Increase', percent: 150, action: 'drop' },
    { text: 'Barrier Increase per Interval', percent: 33.333, action: 'drop' },
    { text: 'Damage Increase per Interval', percent: 20, action: { displayText: 'Barrier Increase per Interval' } },
    { text: 'Max Barrier', percent: 100, action: 'drop' }
  ]
}

/** Applies `CURATED_PERCENT_FACT_OVERRIDES` to one fact ahead of `factLine`/`realValueLine` — `null`
 *  return means "drop this fact," a relabeled copy means "keep it, but render under this text
 *  instead," and the fact is returned unchanged when this skill/fact pair has no override at all
 *  (the overwhelming majority of calls, including every fact on every skill without an entry above). */
function applyCuratedPercentOverride(fact: Fact, skillId: number): Fact | null {
  if (fact.type !== 'Percent' || typeof fact.percent !== 'number') return fact
  const overrides = CURATED_PERCENT_FACT_OVERRIDES[skillId]
  if (!overrides) return fact
  const match = overrides.find((o) => o.text === fact.text && o.percent === fact.percent)
  if (!match) return fact
  return match.action === 'drop' ? null : { ...fact, text: match.action.displayText }
}

/**
 * Wiki-confirmed WvW value for a `Number`-type fact the raw API exposes as ONE flat value with no
 * pve/wvw duplicate at all — unlike `NUMERIC_FACT_WVW_OVERRIDES` (fact-numbers.ts), whose entries
 * all select between 2 existing raw facts sharing one `text` (dropping whichever doesn't match),
 * these skills only ever emit a single "Conditions Removed" fact, so there's nothing to filter
 * between; the value itself must be replaced outright. Keyed by skill id then the fact's own
 * `text`. Found 2026-09-29 verifying the Sep 29 patch's Seed of Life/Cultivated Synergy nerfs —
 * skills had no equivalent of `NUMERIC_FACT_WVW_OVERRIDES` at all until this table, since
 * `skillFactLines` never consulted it (that function is trait-only, see its own doc comment).
 */
const CURATED_NUMERIC_FACT_VALUES: Record<number, Record<string, number>> = {
  // Seed of Life (Druid Celestial Avatar, Staff 4). Raw API's single "Conditions Removed" fact (3)
  // is the pve value, unaffected by this patch; wiki: wvw 2 -> 1, 2026-09-29 patch. Both ids share
  // one wiki page (31406 base cast, 32242 a 2nd id for the same skill).
  31406: { 'Conditions Removed': 1 },
  32242: { 'Conditions Removed': 1 },
  // Lesser Seed of Life (granted by the Cultivated Synergy trait). Raw API's single "Conditions
  // Removed" fact (2) is the pve value, unaffected by this patch; wiki: wvw 2 -> 1 (a split newly
  // introduced by this patch, previously unsplit), 2026-09-29 patch.
  31776: { 'Conditions Removed': 1 }
}

/** Applies `CURATED_NUMERIC_FACT_VALUES` to one fact ahead of `factLine` — returns the fact
 *  unchanged when this skill/fact-text pair has no override (the overwhelming majority of calls). */
function applyCuratedNumericFactValue(fact: Fact, skillId: number): Fact {
  if (fact.type !== 'Number' || typeof fact.text !== 'string') return fact
  const value = CURATED_NUMERIC_FACT_VALUES[skillId]?.[fact.text]
  return value === undefined ? fact : { ...fact, value }
}

/**
 * Skill-tooltip counterpart to `sources.ts`'s `cleansingIreCleanseSource` — same curated table
 * (`CLEANSING_IRE_CLEANSE_FACTS`, imported rather than duplicated), different rendering path. That
 * function only fixes the aggregate Cleanse-row/per-skill-chip pipeline
 * (`computeNamedFactSources`/`namedFactsForSkill`); this one fixes the separate per-skill tooltip a
 * player sees hovering a burst skill directly in the build editor, which reads raw `Fact`s through
 * `skillFactLines` and never touches that pipeline at all. Two raw-data shapes to cover, both
 * documented on `CLEANSING_IRE_CLEANSE_FACTS` itself: the 12 core (spec-less) canonical ids carry NO
 * `Conditions Removed` fact whatsoever (so there's nothing for the main `facts` loop below to
 * override — this line is manufactured from scratch, `icon: null`, same convention as
 * `resourceCostLines`' synthetic lines), while the 25 Berserker/Spellbreaker ids carry one, but its
 * `value` is stale by one full adrenaline tier (the main loop's fact-exclusion `continue` drops that
 * raw fact before `factLine` ever renders the wrong number, and this function's caller re-supplies
 * that dropped fact's own icon so the replacement line still shows the correct CDN glyph). Returns
 * `null` for a skill with no entry in the table, or when Cleansing Ire (trait 1649) isn't equipped —
 * harmless no-op, the overwhelming majority of calls.
 */
function cleansingIreTooltipLine(skill: Skill, activeIds: ReadonlySet<number>, icon: string | null): FactLine | null {
  const entry = CLEANSING_IRE_CLEANSE_FACTS[skill.id]
  if (!entry || !activeIds.has(1649)) return null
  return { icon, text: `Conditions Removed: ${entry.detail}` }
}

function realValueLine(
  fact: Fact,
  damageByLabel: Map<string, number>,
  healingByLabel: Map<string, number>,
  barrierByLabel: Map<string, number>,
  siphonDamageByLabel: Map<string, number>
): FactLine | null {
  if (typeof fact.text !== 'string') return null
  const icon = fact.icon ?? null
  if (fact.type === 'Damage' && damageByLabel.has(fact.text)) {
    return { icon, text: `${fact.text}: ${damageByLabel.get(fact.text)!.toLocaleString()}` }
  }
  if (fact.type === 'AttributeAdjust' && fact.target === 'Power' && siphonDamageByLabel.has(fact.text)) {
    return { icon, text: `${fact.text}: ${siphonDamageByLabel.get(fact.text)!.toLocaleString()}` }
  }
  if (fact.type === 'AttributeAdjust' && fact.target === 'Healing') {
    // Barrier is a different resource bar than Health, checked first since the GW2 API mislabels
    // every Barrier fact's `target` as `'Healing'` too (see `barrier-calc.ts`'s own top comment) —
    // `factText` (not `target`) is what actually distinguishes the two for a given skill, and no
    // skill has ever been found with the same fact text curated in both tables.
    if (barrierByLabel.has(fact.text)) {
      return { icon, text: `${fact.text}: ${barrierByLabel.get(fact.text)!.toLocaleString()}` }
    }
    if (healingByLabel.has(fact.text)) {
      return { icon, text: `${fact.text}: ${healingByLabel.get(fact.text)!.toLocaleString()}` }
    }
  }
  return null
}

/**
 * Skill-tooltip counterpart to `fact-numbers.ts`'s `numericFactLines` — same per-fact walk and
 * `requires_trait` gating, except a `Damage`/`AttributeAdjust`-Healing/`AttributeAdjust`-Power fact
 * this skill has a wiki-verified coefficient for (`CURATED_DAMAGE_COEFFICIENTS`/
 * `CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`/`CURATED_SIPHON_DAMAGE_COEFFICIENTS`,
 * matched by exact fact `text`) renders its real current-build-scaled number instead of
 * `numericFactLines`' generic hit-count/reference-base-value placeholder. Labeled by the fact's own
 * `text` (e.g. "Front Damage"/"Back damage", or a Barrier skill's own "Self Barrier"/"Ally Barrier")
 * rather than the generic formatter's hardcoded "Damage:" prefix, so a curated multi-fact skill (e.g.
 * Backstab, or a skill with both a Healing and a Barrier fact like Necromancer's Sand Flare) renders
 * one distinct line per fact instead of collapsing into a single deduplicated placeholder the generic
 * path would produce. Barrier gets its own tooltip line rather than being folded into Healing's —
 * different resource bar, see `barrier-calc.ts`'s own top comment for why the GW2 API makes that
 * distinction non-obvious; Life Siphon Damage similarly gets its own line rather than folding into
 * the ordinary weapon-Damage one — a genuinely different fact TYPE (`AttributeAdjust`, not `Damage`),
 * see `siphon-damage-calc.ts`'s own top comment. `CURATED_NUMERIC_FACT_VALUES` similarly replaces a
 * `Number` fact's raw value with its wiki-confirmed WvW number for the rare skill whose API facts
 * carry no pve/wvw duplicate to select between at all (see that table's own doc comment). Only used
 * for skills, not traits — `TraitsEditor.tsx` calls `trait-fact-lines.ts`'s `traitFactLines`
 * instead, a separate but analogous function reading `CURATED_TRAIT_HEALING_COEFFICIENTS` (the only
 * curated table with any trait entries so far; `CURATED_DAMAGE_COEFFICIENTS`/
 * `CURATED_BARRIER_COEFFICIENTS`/`CURATED_SIPHON_DAMAGE_COEFFICIENTS` remain skill-id-keyed only, so
 * a trait fact still never gets a real-value match against those three here). `rechargeWvwOverrides` substitutes a
 * WvW-correct `Recharge` fact value where the wiki documents one differing from the API's
 * PvE-reference-build number (see `recharge-override.ts`) — optional so every pre-existing caller
 * (and every test) keeps working unchanged, showing the un-adjusted PvE value, same as before this
 * existed. `resourceCosts` prepends synthetic Energy/Initiative/Upkeep/Health Cost lines ahead of
 * the API's own facts — see `resource-cost-lines.ts` — same optional-param back-compat convention
 * as `rechargeWvwOverrides` (no lines shown when omitted). `cleansingIreTooltipLine` (always active,
 * no opt-in param) appends a curated Cleanse line for Cleansing Ire's (trait 1649) 37 burst-skill
 * ids, same `CLEANSING_IRE_CLEANSE_FACTS` table `sources.ts`'s aggregate pipeline already uses — see
 * that function's own doc comment for why this is a separate fix from that one.
 */
export function skillFactLines(
  skill: Skill,
  activeIds: ReadonlySet<number>,
  power: number,
  healingPower: number,
  targetArmor: number,
  rechargeWvwOverrides?: RechargeWvwOverrides,
  resourceCosts?: ResourceCostsById
): FactLine[] {
  const damageByLabel = new Map(damageLinesForSkill(skill, power, targetArmor, activeIds).map((l) => [l.label, l.value]))
  const healingByLabel = new Map(healingLinesForSkill(skill, healingPower, activeIds).map((l) => [l.label, l.value]))
  const barrierByLabel = new Map(barrierLinesForSkill(skill, healingPower, activeIds).map((l) => [l.label, l.value]))
  const siphonDamageByLabel = new Map(siphonDamageLinesForSkill(skill, power, activeIds).map((l) => [l.label, l.value]))

  const facts = rechargeWvwOverrides ? withRechargeOverride(skill.facts, skill.id, rechargeWvwOverrides.skill) : skill.facts

  const lines: FactLine[] = resourceCosts ? resourceCostLines(skill.id, resourceCosts) : []
  const seen = new Set<string>()
  for (const line of lines) seen.add(line.text)
  let cleansingIreIcon: string | null = null
  for (const rawFact of [...facts, ...skill.traitedFacts]) {
    if (rawFact.requires_trait != null && !activeIds.has(rawFact.requires_trait)) continue
    if (rawFact.requires_trait === 1649 && rawFact.type === 'Number' && rawFact.text === 'Conditions Removed') {
      cleansingIreIcon = rawFact.icon ?? null
      continue
    }
    const percentAdjusted = applyCuratedPercentOverride(rawFact, skill.id)
    if (!percentAdjusted) continue
    const fact = applyCuratedNumericFactValue(percentAdjusted, skill.id)
    const line = realValueLine(fact, damageByLabel, healingByLabel, barrierByLabel, siphonDamageByLabel) ?? factLine(fact)
    if (line && !seen.has(line.text)) {
      seen.add(line.text)
      lines.push(line)
    }
  }
  const cleansingIreLine = cleansingIreTooltipLine(skill, activeIds, cleansingIreIcon)
  if (cleansingIreLine && !seen.has(cleansingIreLine.text)) lines.push(cleansingIreLine)
  return lines
}
