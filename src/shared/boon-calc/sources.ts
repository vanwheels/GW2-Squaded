import type { Build, Consumable, EquipmentSlotKey, Fact, Infusion, ItemStat, Legend, Pet, Profession, Rune, Skill, Trait, WvwFactOverride, WvwFactOverrides } from '../types'
import { isBoonName, isConditionName } from './constants'
import { boonDurationPercent, computeGearAttributeTotals, conditionDurationPercent } from '../gear-calc/attribute-totals'
import { weaponSkillIdsForPair } from '../weapon-calc/weapon-skills'

export interface BoonConditionSource {
  sourceKind: 'skill' | 'trait'
  sourceId: number
  sourceName: string
  sourceIcon: string
  boonOrConditionName: string
  isCondition: boolean
  baseDurationSeconds: number
  /** `baseDurationSeconds` scaled by the build's gear-derived boon/condition duration %. */
  scaledDurationSeconds: number
  applyCount: number
  requiresTraitId: number | null
}

/**
 * Trait ids currently "active" for a build: every minor trait of an equipped
 * specialization line (auto-granted) plus every chosen major trait. Used to
 * gate `Fact.requires_trait` — some facts (on skills AND traits) only apply
 * when a specific other trait is also active.
 */
export function activeTraitIds(build: Build, allTraits: Trait[]): Set<number> {
  const equippedLines = build.specializations.filter((line): line is NonNullable<typeof line> => line != null)
  const equippedSpecIds = new Set(equippedLines.map((line) => line.specializationId))
  const ids = new Set<number>()
  for (const trait of allTraits) {
    if (trait.slot === 'Minor' && equippedSpecIds.has(trait.specializationId)) {
      ids.add(trait.id)
    }
  }
  for (const line of equippedLines) {
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
  sourceName: string,
  sourceIcon: string,
  durationPercent: { boon: number; condition: number },
  wvwOverrides: Record<string, WvwFactOverride> | undefined
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

    const wvwOverride = wvwOverrides?.[fact.status]
    if (wvwOverride === 'omit') continue
    const baseDuration = typeof wvwOverride === 'number' ? wvwOverride : fact.duration

    const percent = isCondition ? durationPercent.condition : durationPercent.boon
    out.push({
      sourceKind,
      sourceId,
      sourceName,
      sourceIcon,
      boonOrConditionName: fact.status,
      isCondition,
      baseDurationSeconds: baseDuration,
      scaledDurationSeconds: baseDuration * (1 + percent / 100),
      applyCount: fact.apply_count ?? 1,
      requiresTraitId: fact.requires_trait ?? null
    })
  }
  return out
}

/**
 * Boon/condition facts a single skill grants, gated by the same `requires_trait`/WvW-override/
 * duration-scaling rules as `computeBoonConditionSources` — used for skill tooltips (both the
 * equipped skill-bar slots and the picker grid) so a skill's boon/condition output is visible
 * without it needing to already be equipped. `activeIds`/`durationPercent` are the caller's
 * responsibility to compute once (via `activeTraitIds` and gear-calc's duration-percent
 * functions) and reuse across every skill shown, rather than recomputing per hover.
 */
export function boonConditionFactsForSkill(
  skill: Skill,
  activeIds: Set<number>,
  durationPercent: { boon: number; condition: number },
  wvwOverride: Record<string, WvwFactOverride> | undefined
): BoonConditionSource[] {
  return extractFromFacts(
    skill.facts,
    skill.traitedFacts,
    activeIds,
    'skill',
    skill.id,
    skill.name,
    skill.icon,
    durationPercent,
    wvwOverride
  )
}

/**
 * Every weapon-derived skill id a build's currently-`environment`-relevant weapon sets grant.
 * Land builds count BOTH swap sets (A and B); underwater builds count both underwater sets (U1
 * and U2) — a player carries both and can swap anytime, same "both always contribute" reasoning
 * as `RevenantSkillSelection.activeLegendIndex` (see its doc comment). `activeWeaponSet`/
 * `activeUnderwaterSet` are display-only and don't gate this.
 */
function weaponSkillIdsForBuild(build: Build, professions: Profession[], skillsById: Map<number, Skill>): number[] {
  const profession = professions.find((p) => p.id === build.profession)
  if (!profession) return []

  const pairs: [EquipmentSlotKey, EquipmentSlotKey | null][] =
    build.environment === 'land'
      ? [
          ['weaponA1', 'weaponA2'],
          ['weaponB1', 'weaponB2']
        ]
      : [
          ['weaponU1', null],
          ['weaponU2', null]
        ]

  const ids: number[] = []
  for (const [mainKey, offKey] of pairs) {
    const mainType = build.equipment[mainKey]?.weaponType
    const offType = offKey ? build.equipment[offKey]?.weaponType : undefined
    const mainWeapon = mainType ? profession.weapons[mainType] : undefined
    const offWeapon = offType ? profession.weapons[offType] : mainWeapon
    if (!mainWeapon && !offWeapon) continue
    for (const id of weaponSkillIdsForPair(mainWeapon, offWeapon, build.environment, skillsById)) {
      if (id !== null) ids.push(id)
    }
  }
  return ids
}

/**
 * Every skill id "equipped" by a build's skill selection — for a standard profession, the chosen
 * Heal/Utility/Elite skills; for Revenant, every skill (swap + heal + 3 utility + elite) belonging
 * to either of the 2 equipped legends, since a legend's kit is fixed rather than picked skill-by-
 * skill (see `RevenantSkillSelection`) — plus every weapon-derived skill id from the build's
 * currently-relevant weapon sets (see `weaponSkillIdsForBuild`), plus, for Ranger, both equipped
 * pets' own skill (`Build.equippedPetIds` — both always contribute, same "both always equipped"
 * reasoning as the Revenant legends and land weapon-swap sets above).
 */
function skillIdsForBuild(build: Build, legends: Legend[], pets: Pet[], professions: Profession[], skillsById: Map<number, Skill>): number[] {
  const nonWeaponIds =
    build.skills.kind === 'revenant'
      ? build.skills.legends
          .filter((id): id is string => id !== null)
          .map((id) => legends.find((l) => l.id === id))
          .filter((l): l is Legend => l !== undefined)
          .flatMap((l) => [l.swap, l.heal, l.elite, ...l.utilities])
      : [build.skills.heal, ...build.skills.utility, build.skills.elite].filter((id): id is number => id !== null)

  const petSkillIds =
    build.profession === 'Ranger'
      ? build.equippedPetIds
          .filter((id): id is number => id !== null)
          .map((id) => pets.find((p) => p.id === id))
          .filter((p): p is Pet => p !== undefined)
          .map((p) => p.skillId)
      : []

  return [...nonWeaponIds, ...petSkillIds, ...weaponSkillIdsForBuild(build, professions, skillsById)]
}

/**
 * Every boon/condition source (skill or trait) a build provides. Walks
 * equipped heal/utility/elite skills, auto-granted minor traits on equipped
 * specialization lines, and chosen major traits — gated by requires_trait so
 * conditional facts only show up when the trait that unlocks them is active.
 *
 * `baseDurationSeconds` is the WvW-adjusted value (see `wvwFactOverrides` below);
 * `scaledDurationSeconds` further applies the build's gear-derived boon/condition duration %
 * (Concentration/Expertise from equipped armor/trinkets/back/weapons). Food/utility consumables
 * aren't fetched/modeled yet, so they're not included in either number — see TODO.md.
 *
 * Also walks every weapon-derived skill from the build's currently-`environment`-relevant weapon
 * sets (see `weaponSkillIdsForBuild`) — both land sets or both underwater sets always contribute,
 * per `Build.activeWeaponSet`'s doc comment.
 *
 * The GW2 API's `Fact.duration` for a Buff fact is PvE data (or the sole value, for facts with no
 * WvW/PvE split) — see scripts/fetch-wvw-splits.ts and docs/game-data.md for how that's verified
 * and how `gameData.wvwFactOverrides` is derived from the wiki. Every Buff fact is checked against
 * that map: an `'omit'` entry drops the fact (PvE-only, no WvW variant), a number entry replaces
 * `fact.duration` with the WvW-tagged value. Facts with no entry are used as-is (either unsplit,
 * or a split the fetch script couldn't confidently resolve — see TODO.md).
 */
export function computeBoonConditionSources(
  build: Build,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    itemStats: ItemStat[]
    infusions: Infusion[]
    runes: Rune[]
    food: Consumable[]
    utility: Consumable[]
    wvwFactOverrides: WvwFactOverrides
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
  }
): BoonConditionSource[] {
  const activeIds = activeTraitIds(build, gameData.traits)
  const out: BoonConditionSource[] = []
  const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))

  const gearTotals = computeGearAttributeTotals(build, gameData)
  const durationPercent = {
    boon: boonDurationPercent(gearTotals),
    condition: conditionDurationPercent(gearTotals)
  }

  const skillIds = skillIdsForBuild(build, gameData.legends, gameData.pets, gameData.professions, skillsById)
  for (const id of skillIds) {
    const skill = skillsById.get(id)
    if (!skill) continue
    out.push(
      ...extractFromFacts(
        skill.facts,
        skill.traitedFacts,
        activeIds,
        'skill',
        skill.id,
        skill.name,
        skill.icon,
        durationPercent,
        gameData.wvwFactOverrides.skill[skill.id]
      )
    )
  }

  for (const line of build.specializations) {
    if (line == null) continue
    for (const trait of gameData.traits) {
      if (trait.specializationId !== line.specializationId) continue
      const isMinor = trait.slot === 'Minor'
      const isChosenMajor = trait.slot === 'Major' && line.chosenTraitIds.includes(trait.id)
      if (!isMinor && !isChosenMajor) continue
      out.push(
        ...extractFromFacts(
          trait.facts,
          trait.traitedFacts,
          activeIds,
          'trait',
          trait.id,
          trait.name,
          trait.icon,
          durationPercent,
          gameData.wvwFactOverrides.trait[trait.id]
        )
      )
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
