import type {
  Build,
  Consumable,
  Infusion,
  ItemStat,
  Legend,
  Party,
  Pet,
  Profession,
  Rune,
  Skill,
  SoulbeastBeastmodeMap,
  TomeChaptersByTomeId,
  Trait,
  WvwFactOverrides
} from '../types'
import { computeBoonConditionSources } from '../boon-calc/sources'

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
    infusions: Infusion[]
    runes: Rune[]
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
