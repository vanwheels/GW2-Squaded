import type {
  Build,
  Consumable,
  Fact,
  Infusion,
  ItemStat,
  ItemStatLegalIds,
  Legend,
  Party,
  Pet,
  Profession,
  Rune,
  Sigil,
  Skill,
  SoulbeastBeastmodeMap,
  TomeChaptersByTomeId,
  Trait,
  WvwFactOverrides
} from '../types'
import { computeAuraSources, computeBoonConditionSources, computeComboSources, computeNamedFactSources } from '../boon-calc/sources'

export interface PartyBoonConditionContribution {
  slotIndex: number
  buildName: string
  sourceName: string
  sourceIcon: string
  scaledDurationSeconds: number
  applyCount: number
}

export interface PartyBoonConditionEntry {
  name: string
  isCondition: boolean
  contributions: PartyBoonConditionContribution[]
}

export interface PartyAuraContribution {
  slotIndex: number
  buildName: string
  sourceName: string
  sourceIcon: string
  scaledDurationSeconds: number
  applyCount: number
}

export interface PartyAuraEntry {
  name: string
  contributions: PartyAuraContribution[]
}

export interface PartyNamedFactContribution {
  slotIndex: number
  buildName: string
  sourceName: string
  sourceIcon: string
  detail: string | null
}

export interface PartyNamedFactEntry {
  name: string
  contributions: PartyNamedFactContribution[]
}

export interface PartyComboContribution {
  slotIndex: number
  buildName: string
  sourceName: string
  sourceIcon: string
  fieldType: string | null
  finisherType: string | null
}

export interface PartyComboEntry {
  kind: 'field' | 'finisher'
  contributions: PartyComboContribution[]
}

/**
 * Party-wide "which boons/conditions can this party produce at all" summary — a presence union
 * across every assigned slot's build, each entry keeping per-source/per-character attribution for
 * display (e.g. a hover tooltip). Deliberately NOT a merged/estimated combined-uptime %: unlike a
 * single build's own scaled duration (a real, bounded number), estimating a party's true combined
 * uptime would need to reason about skill cooldowns/rotation overlap across 5 players, which this
 * app doesn't model anywhere — see TODO.md's boon-calc item, which already flags a "combined/ideal
 * uptime" mode as a later stretch goal, not part of this pass.
 *
 * A slot whose `buildId` doesn't resolve in `buildsById` (empty slot, or a deleted build a squad
 * still references) is simply skipped — same fail-safe-over-guessing pattern used throughout this
 * codebase's game-data handling.
 */
export function computePartyBoonConditionSummary(
  party: Party,
  buildsById: Map<string, Build>,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    itemStats: ItemStat[]
    itemStatLegalIds: ItemStatLegalIds
    infusions: Infusion[]
    runes: Rune[]
    sigils: Sigil[]
    food: Consumable[]
    utility: Consumable[]
    wvwFactOverrides: WvwFactOverrides
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
  }
): PartyBoonConditionEntry[] {
  const map = new Map<string, PartyBoonConditionEntry>()

  party.slots.forEach((slot, slotIndex) => {
    if (slot.buildId === null) return
    const build = buildsById.get(slot.buildId)
    if (!build) return

    for (const source of computeBoonConditionSources(build, gameData)) {
      let entry = map.get(source.boonOrConditionName)
      if (!entry) {
        entry = { name: source.boonOrConditionName, isCondition: source.isCondition, contributions: [] }
        map.set(source.boonOrConditionName, entry)
      }
      entry.contributions.push({
        slotIndex,
        buildName: build.name,
        sourceName: source.sourceName,
        sourceIcon: source.sourceIcon,
        scaledDurationSeconds: source.scaledDurationSeconds,
        applyCount: source.applyCount
      })
    }
  })

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Aura counterpart to `computePartyBoonConditionSummary` — same presence-union-with-attribution
 *  contract, over `computeAuraSources` instead of `computeBoonConditionSources`. */
export function computePartyAuraSummary(
  party: Party,
  buildsById: Map<string, Build>,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    wvwFactOverrides: WvwFactOverrides
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
  }
): PartyAuraEntry[] {
  const map = new Map<string, PartyAuraEntry>()

  party.slots.forEach((slot, slotIndex) => {
    if (slot.buildId === null) return
    const build = buildsById.get(slot.buildId)
    if (!build) return

    for (const source of computeAuraSources(build, gameData)) {
      let entry = map.get(source.boonOrConditionName)
      if (!entry) {
        entry = { name: source.boonOrConditionName, contributions: [] }
        map.set(source.boonOrConditionName, entry)
      }
      entry.contributions.push({
        slotIndex,
        buildName: build.name,
        sourceName: source.sourceName,
        sourceIcon: source.sourceIcon,
        scaledDurationSeconds: source.scaledDurationSeconds,
        applyCount: source.applyCount
      })
    }
  })

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Control/Miscellaneous/Strip&Corrupt counterpart to `computePartyBoonConditionSummary` — same
 *  presence-union-with-attribution contract, generic over a `computeNamedFactSources` matcher table
 *  (`CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/`BOON_STRIP_CORRUPT_MATCHERS`) so one function
 *  covers all three rows, mirroring `computeNamedFactSources` itself being matcher-generic. */
export function computePartyNamedFactSummary(
  party: Party,
  buildsById: Map<string, Build>,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
  },
  matchers: Record<string, (fact: Fact) => boolean>
): PartyNamedFactEntry[] {
  const map = new Map<string, PartyNamedFactEntry>()

  party.slots.forEach((slot, slotIndex) => {
    if (slot.buildId === null) return
    const build = buildsById.get(slot.buildId)
    if (!build) return

    for (const source of computeNamedFactSources(build, gameData, matchers)) {
      let entry = map.get(source.name)
      if (!entry) {
        entry = { name: source.name, contributions: [] }
        map.set(source.name, entry)
      }
      entry.contributions.push({
        slotIndex,
        buildName: build.name,
        sourceName: source.sourceName,
        sourceIcon: source.sourceIcon,
        detail: source.detail
      })
    }
  })

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Combo counterpart to `computePartyBoonConditionSummary` — same presence-union-with-attribution
 *  contract, over `computeComboSources`. Like `comboIconItems` in `BoonConditionSummaryPanel`, this
 *  collapses down to at most 2 entries (Field, Finisher) since the API exposes only one generic icon
 *  per kind — the specific field/finisher types this party produces are per-contribution detail. */
export function computePartyComboSummary(
  party: Party,
  buildsById: Map<string, Build>,
  gameData: {
    skills: Skill[]
    traits: Trait[]
    legends: Legend[]
    pets: Pet[]
    professions: Profession[]
    tomeChapters: TomeChaptersByTomeId
    soulbeastBeastmode: SoulbeastBeastmodeMap
  }
): PartyComboEntry[] {
  const map = new Map<'field' | 'finisher', PartyComboEntry>()

  party.slots.forEach((slot, slotIndex) => {
    if (slot.buildId === null) return
    const build = buildsById.get(slot.buildId)
    if (!build) return

    for (const source of computeComboSources(build, gameData)) {
      let entry = map.get(source.kind)
      if (!entry) {
        entry = { kind: source.kind, contributions: [] }
        map.set(source.kind, entry)
      }
      entry.contributions.push({
        slotIndex,
        buildName: build.name,
        sourceName: source.sourceName,
        sourceIcon: source.sourceIcon,
        fieldType: source.fieldType,
        finisherType: source.finisherType
      })
    }
  })

  return [...map.values()].sort((a, b) => a.kind.localeCompare(b.kind))
}
