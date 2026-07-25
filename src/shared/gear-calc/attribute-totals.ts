import type { Build, EquipmentSlotKey, ItemStat } from '../types'

/**
 * attribute_adjustment constants for level-80 Exotic/Ascended gear, quoted directly from the
 * wiki's `API:2/itemstats` "Notes" table (wiki.guildwars2.com/wiki/API:2/itemstats, fetched raw
 * wikitext this session — not reconstructed from memory). Formula (same source): an item's
 * contribution to an attribute is `attribute_adjustment * multiplier + value`, where multiplier
 * and value come from the equipped stat combo's `ItemStat.attributes`.
 */
const ATTRIBUTE_ADJUSTMENT = {
  armorLight: { exotic: 128.04, ascended: 134.442 }, // Shoulders / Gloves / Boots
  armorHelm: { exotic: 170.72, ascended: 179.256 },
  armorLeggings: { exotic: 256.08, ascended: 268.884 },
  armorCoat: { exotic: 384.12, ascended: 403.326 },
  back: { exotic: 85.36, ascended: 89.628 },
  trinketAccessory: { exotic: 213.4, ascended: 224.07 },
  trinketRing: { exotic: 256.08, ascended: 268.884 },
  trinketAmulet: { exotic: 341.44, ascended: 358.512 },
  weaponOneHanded: { exotic: 341.44, ascended: 358.512 },
  weaponTwoHanded: { exotic: 682.88, ascended: 717.024 }
} as const

type AdjustmentKey = keyof typeof ATTRIBUTE_ADJUSTMENT

/**
 * Every equipment slot this app models defaults to level-80 Ascended, the realistic gear tier
 * for the target WvW meta comp (see TODO.md) — not user-selectable yet (would need a rarity
 * field on `EquipmentSlot`).
 *
 * Weapon slots are mapped to the one-handed constant unconditionally: `EquipmentSlotKey` only
 * stores an `itemStatId`, not a weapon type, so this app has no way to know whether a given
 * weapon slot holds a one- or two-handed weapon. This undercounts total attributes for builds
 * using two-handed weapons (e.g. Greatsword, Staff) — documented limitation, not silently wrong
 * math for the common one-handed case.
 */
const SLOT_ADJUSTMENT_KEY: Record<EquipmentSlotKey, AdjustmentKey> = {
  helm: 'armorHelm',
  shoulders: 'armorLight',
  chest: 'armorCoat',
  gloves: 'armorLight',
  leggings: 'armorLeggings',
  boots: 'armorLight',
  backpiece: 'back',
  accessory1: 'trinketAccessory',
  accessory2: 'trinketAccessory',
  ring1: 'trinketRing',
  ring2: 'trinketRing',
  amulet: 'trinketAmulet',
  weaponA1: 'weaponOneHanded',
  weaponA2: 'weaponOneHanded',
  weaponB1: 'weaponOneHanded',
  weaponB2: 'weaponOneHanded'
}

const RARITY: 'exotic' | 'ascended' = 'ascended'

/** Attribute name (as in `ItemStatAttribute.attribute`, e.g. "BoonDuration") -> summed points across all equipped gear. */
export type AttributeTotals = Record<string, number>

export function computeGearAttributeTotals(build: Build, itemStats: ItemStat[]): AttributeTotals {
  const statsById = new Map(itemStats.map((s) => [s.id, s]))
  const totals: AttributeTotals = {}

  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    const slot = build.equipment[slotKey]
    if (!slot || slot.itemStatId === null) continue
    const stat = statsById.get(slot.itemStatId)
    if (!stat) continue

    const adjustment = ATTRIBUTE_ADJUSTMENT[SLOT_ADJUSTMENT_KEY[slotKey]][RARITY]
    for (const attr of stat.attributes) {
      const points = adjustment * attr.multiplier + attr.value
      totals[attr.attribute] = (totals[attr.attribute] ?? 0) + points
    }
  }

  return totals
}

/**
 * Concentration (API attribute name `BoonDuration`) and Expertise (`ConditionDuration`) each
 * convert to a duration percentage at a flat rate of 15 points per 1% — quoted directly from
 * the wiki's Concentration and Expertise pages ("Every 15 points of Concentration/Expertise
 * adds 1% to boon/condition duration"), fetched raw wikitext this session.
 */
const DURATION_POINTS_PER_PERCENT = 15

export function boonDurationPercent(totals: AttributeTotals): number {
  return (totals.BoonDuration ?? 0) / DURATION_POINTS_PER_PERCENT
}

export function conditionDurationPercent(totals: AttributeTotals): number {
  return (totals.ConditionDuration ?? 0) / DURATION_POINTS_PER_PERCENT
}
