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
 * Armor/trinket slots map to a fixed adjustment key. Weapon slots are resolved dynamically in
 * `computeGearAttributeTotals` instead (see below) now that `EquipmentSlot.weaponType` exists.
 */
const SLOT_ADJUSTMENT_KEY: Partial<Record<EquipmentSlotKey, AdjustmentKey>> = {
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
  amulet: 'trinketAmulet'
}

const UNDERWATER_WEAPON_SLOTS: EquipmentSlotKey[] = ['weaponU1', 'weaponU2']

const RARITY: 'exotic' | 'ascended' = 'ascended'

/** Attribute name (as in `ItemStatAttribute.attribute`, e.g. "BoonDuration") -> summed points across all equipped gear. */
export type AttributeTotals = Record<string, number>

/**
 * Land weapon slots (`weaponA1/A2/B1/B2`) always use the one-handed constant, even when a
 * two-handed weapon is equipped: `EquipmentEditor` mirrors a two-handed weapon's `weaponType`+
 * `itemStatId` onto BOTH its main- and off-hand slot keys, and `weaponOneHanded.ascended * 2 ===
 * weaponTwoHanded.ascended` exactly (same for exotic) — so crediting the one-handed constant to
 * each of the two mirrored slots already sums to the correct two-handed total, no special-casing
 * needed. Underwater slots (`weaponU1/U2`) are single, non-paired slots and every aquatic weapon
 * is confirmed two-handed, so they always use the two-handed constant directly.
 */
function weaponAdjustmentKey(slotKey: EquipmentSlotKey): AdjustmentKey {
  return UNDERWATER_WEAPON_SLOTS.includes(slotKey) ? 'weaponTwoHanded' : 'weaponOneHanded'
}

export function computeGearAttributeTotals(build: Build, itemStats: ItemStat[]): AttributeTotals {
  const statsById = new Map(itemStats.map((s) => [s.id, s]))
  const totals: AttributeTotals = {}

  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    const slot = build.equipment[slotKey]
    if (!slot || slot.itemStatId === null) continue

    const isWeaponSlot = slotKey.startsWith('weapon')
    if (isWeaponSlot && !slot.weaponType) continue // empty weapon slot — no item actually equipped
    const adjustmentKey = SLOT_ADJUSTMENT_KEY[slotKey] ?? weaponAdjustmentKey(slotKey)

    const stat = statsById.get(slot.itemStatId)
    if (!stat) continue

    const adjustment = ATTRIBUTE_ADJUSTMENT[adjustmentKey][RARITY]
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
