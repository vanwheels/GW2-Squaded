import type { Build, Fact, Skill, Trait } from '../types'
import { isBoonName, isConditionName } from './constants'

export interface BoonConditionSource {
  sourceKind: 'skill' | 'trait'
  sourceId: number
  sourceName: string
  boonOrConditionName: string
  isCondition: boolean
  baseDurationSeconds: number
  applyCount: number
  requiresTraitId: number | null
}

/**
 * Trait ids currently "active" for a build: every minor trait of an equipped
 * specialization line (auto-granted) plus every chosen major trait. Used to
 * gate `Fact.requires_trait` — some facts (on skills AND traits) only apply
 * when a specific other trait is also active.
 */
function activeTraitIds(build: Build, allTraits: Trait[]): Set<number> {
  const equippedSpecIds = new Set(build.specializations.map((line) => line.specializationId))
  const ids = new Set<number>()
  for (const trait of allTraits) {
    if (trait.slot === 'Minor' && equippedSpecIds.has(trait.specializationId)) {
      ids.add(trait.id)
    }
  }
  for (const line of build.specializations) {
    for (const chosenId of line.chosenTraitIds) {
      if (chosenId !== null) ids.add(chosenId)
    }
  }
  return ids
}

function extractFromFacts(
  facts: Fact[],
  traitedFacts: Fact[],
  activeIds: Set<number>,
  sourceKind: 'skill' | 'trait',
  sourceId: number,
  sourceName: string
): BoonConditionSource[] {
  const out: BoonConditionSource[] = []
  for (const fact of [...facts, ...traitedFacts]) {
    if (fact.type !== 'Buff' || typeof fact.status !== 'string' || typeof fact.duration !== 'number') {
      continue
    }
    const isBoon = isBoonName(fact.status)
    const isCondition = isConditionName(fact.status)
    if (!isBoon && !isCondition) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue

    out.push({
      sourceKind,
      sourceId,
      sourceName,
      boonOrConditionName: fact.status,
      isCondition,
      baseDurationSeconds: fact.duration,
      applyCount: fact.apply_count ?? 1,
      requiresTraitId: fact.requires_trait ?? null
    })
  }
  return out
}

/**
 * Every boon/condition source (skill or trait) a build provides, with base
 * (unscaled) duration straight from the GW2 API's facts. Walks equipped
 * heal/utility/elite skills, auto-granted minor traits on equipped
 * specialization lines, and chosen major traits — gated by requires_trait so
 * conditional facts only show up when the trait that unlocks them is active.
 *
 * Deliberately does NOT scale by boon duration/condition duration (gear) or
 * food/utility yet — see TODO.md for why (gear scaling needs a verified
 * item-stat resolution formula; consumables aren't fetched/modeled yet).
 */
export function computeBoonConditionSources(
  build: Build,
  gameData: { skills: Skill[]; traits: Trait[] }
): BoonConditionSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: BoonConditionSource[] = []

  const skillIds = [build.skills.heal, ...build.skills.utility, build.skills.elite].filter(
    (id): id is number => id !== null
  )
  for (const id of skillIds) {
    const skill = gameData.skills.find((s) => s.id === id)
    if (!skill) continue
    out.push(...extractFromFacts(skill.facts, skill.traitedFacts, activeIds, 'skill', skill.id, skill.name))
  }

  for (const line of build.specializations) {
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(...extractFromFacts(trait.facts, trait.traitedFacts, activeIds, 'trait', trait.id, trait.name))
    }
  }

  return out
}

export interface BoonConditionGroup {
  name: string
  isCondition: boolean
  sources: BoonConditionSource[]
}

export function groupBoonConditionSources(sources: BoonConditionSource[]): BoonConditionGroup[] {
  const map = new Map<string, BoonConditionGroup>()
  for (const source of sources) {
    let group = map.get(source.boonOrConditionName)
    if (!group) {
      group = { name: source.boonOrConditionName, isCondition: source.isCondition, sources: [] }
      map.set(source.boonOrConditionName, group)
    }
    group.sources.push(source)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
