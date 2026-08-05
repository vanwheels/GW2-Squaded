import type { Fact, Skill } from '../types'
import { factLine, type FactLine } from './fact-numbers'
import { healingLinesForSkill } from './healing-calc'
import { barrierLinesForSkill } from './barrier-calc'
import { damageLinesForSkill } from './damage-calc'

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
  for (const fact of [...skill.facts, ...skill.traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    const line = realValueLine(fact, damageByLabel, healingByLabel, barrierByLabel) ?? factLine(fact)
    if (line && !seen.has(line.text)) {
      seen.add(line.text)
      lines.push(line)
    }
  }
  return lines
}
