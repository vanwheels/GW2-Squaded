import type { Fact, Skill } from '../types'
import { factLine, type FactLine } from './fact-numbers'
import { healingLinesForSkill } from './healing-calc'
import { barrierLinesForSkill } from './barrier-calc'
import { damageLinesForSkill } from './damage-calc'

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

function realValueLine(
  fact: Fact,
  damageByLabel: Map<string, number>,
  healingByLabel: Map<string, number>,
  barrierByLabel: Map<string, number>
): FactLine | null {
  if (typeof fact.text !== 'string') return null
  const icon = fact.icon ?? null
  if (fact.type === 'Damage' && damageByLabel.has(fact.text)) {
    return { icon, text: `${fact.text}: ${damageByLabel.get(fact.text)!.toLocaleString()}` }
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
 * `requires_trait` gating, except a `Damage`/`AttributeAdjust`-Healing fact this skill has a
 * wiki-verified coefficient for (`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS`/
 * `CURATED_BARRIER_COEFFICIENTS`, matched by exact fact `text`) renders its real current-build-scaled
 * number instead of `numericFactLines`' generic hit-count/reference-base-value placeholder. Labeled
 * by the fact's own `text` (e.g. "Front Damage"/"Back damage", or a Barrier skill's own "Self
 * Barrier"/"Ally Barrier") rather than the generic formatter's hardcoded "Damage:" prefix, so a
 * curated multi-fact skill (e.g. Backstab, or a skill with both a Healing and a Barrier fact like
 * Necromancer's Sand Flare) renders one distinct line per fact instead of collapsing into a single
 * deduplicated placeholder the generic path would produce. Barrier gets its own tooltip line rather
 * than being folded into Healing's — different resource bar, see `barrier-calc.ts`'s own top comment
 * for why the GW2 API makes that distinction non-obvious. Only used for skills, not traits
 * (`TraitsEditor.tsx` keeps using `numericFactLines` directly) — all 3 curated tables are keyed by
 * skill id only, so a trait fact never has a real-value match here anyway.
 */
export function skillFactLines(
  skill: Skill,
  activeIds: ReadonlySet<number>,
  power: number,
  healingPower: number,
  targetArmor: number
): FactLine[] {
  const damageByLabel = new Map(damageLinesForSkill(skill, power, targetArmor, activeIds).map((l) => [l.label, l.value]))
  const healingByLabel = new Map(healingLinesForSkill(skill, healingPower, activeIds).map((l) => [l.label, l.value]))
  const barrierByLabel = new Map(barrierLinesForSkill(skill, healingPower, activeIds).map((l) => [l.label, l.value]))

  const lines: FactLine[] = []
  const seen = new Set<string>()
  for (const rawFact of [...skill.facts, ...skill.traitedFacts]) {
    if (rawFact.requires_trait != null && !activeIds.has(rawFact.requires_trait)) continue
    const fact = applyCuratedPercentOverride(rawFact, skill.id)
    if (!fact) continue
    const line = realValueLine(fact, damageByLabel, healingByLabel, barrierByLabel) ?? factLine(fact)
    if (line && !seen.has(line.text)) {
      seen.add(line.text)
      lines.push(line)
    }
  }
  return lines
}
