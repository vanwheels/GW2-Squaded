import type { Fact, Skill } from '../types'
import { factLine, type FactLine } from './fact-numbers'
import { healingLinesForSkill } from './healing-calc'
import { damageLinesForSkill } from './damage-calc'

function realValueLine(fact: Fact, damageByLabel: Map<string, number>, healingByLabel: Map<string, number>): FactLine | null {
  if (typeof fact.text !== 'string') return null
  const icon = fact.icon ?? null
  if (fact.type === 'Damage' && damageByLabel.has(fact.text)) {
    return { icon, text: `${fact.text}: ${damageByLabel.get(fact.text)!.toLocaleString()}` }
  }
  if (fact.type === 'AttributeAdjust' && fact.target === 'Healing' && healingByLabel.has(fact.text)) {
    return { icon, text: `${fact.text}: ${healingByLabel.get(fact.text)!.toLocaleString()}` }
  }
  return null
}

/**
 * Skill-tooltip counterpart to `fact-numbers.ts`'s `numericFactLines` — same per-fact walk and
 * `requires_trait` gating, except a `Damage`/`AttributeAdjust`-Healing fact this skill has a
 * wiki-verified coefficient for (`CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS`,
 * matched by exact fact `text`) renders its real current-build-scaled number instead of
 * `numericFactLines`' generic hit-count/reference-base-value placeholder. Labeled by the fact's own
 * `text` (e.g. "Front Damage"/"Back damage") rather than the generic formatter's hardcoded "Damage:"
 * prefix, so a curated multi-fact skill (e.g. Backstab) renders 2 distinct lines instead of
 * collapsing into one deduplicated "Damage: 1 hit" the generic path would produce for it. Only used
 * for skills, not traits (`TraitsEditor.tsx` keeps using `numericFactLines` directly) — both curated
 * tables are keyed by skill id only, so a trait fact never has a real-value match here anyway.
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

  const lines: FactLine[] = []
  const seen = new Set<string>()
  for (const fact of [...skill.facts, ...skill.traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    const line = realValueLine(fact, damageByLabel, healingByLabel) ?? factLine(fact)
    if (line && !seen.has(line.text)) {
      seen.add(line.text)
      lines.push(line)
    }
  }
  return lines
}
