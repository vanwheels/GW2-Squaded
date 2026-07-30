import type { EquipmentSlotKey } from '../types'

/** The 6 armor pieces that carry a rune slot in-game. Trinkets/back/weapons never take runes. */
export const RUNE_SLOT_KEYS: EquipmentSlotKey[] = ['helm', 'shoulders', 'chest', 'gloves', 'leggings', 'boots']

/**
 * Infusion-slot capacity for non-weapon slots, confirmed directly by the user (see TODO.md,
 * "Per-slot infusion counts, confirmed 2026-07-29"): rings have 3 each, the backpiece has 2,
 * every other armor piece and the two accessories have 1 each, the amulet has 0.
 */
const ARMOR_TRINKET_INFUSION_CAPACITY: Partial<Record<EquipmentSlotKey, number>> = {
  helm: 1,
  shoulders: 1,
  chest: 1,
  gloves: 1,
  leggings: 1,
  boots: 1,
  backpiece: 2,
  accessory1: 1,
  accessory2: 1,
  ring1: 3,
  ring2: 3,
  amulet: 0
}

export function armorTrinketInfusionCapacity(slotKey: EquipmentSlotKey): number {
  return ARMOR_TRINKET_INFUSION_CAPACITY[slotKey] ?? 0
}

/**
 * Sigil and infusion capacity for a single weapon slot happen to follow the identical rule, both
 * confirmed directly by the user (see TODO.md): a two-handed weapon has 2 of each slot type on
 * that one item; a one-handed weapon (main-hand or off-hand independently) has 1 of each. No
 * slots at all if no weapon is equipped there.
 */
export function weaponUpgradeCapacity(hasWeapon: boolean, isTwoHanded: boolean): number {
  if (!hasWeapon) return 0
  return isTwoHanded ? 2 : 1
}

/** Resizes an upgrade-id array to `capacity`, preserving existing picks in-range and dropping
 *  any that no longer fit (e.g. a weapon slot's capacity shrinking from 2 to 1). */
export function resizeUpgradeIds(ids: (number | null)[] | undefined, capacity: number): (number | null)[] {
  const next = (ids ?? []).slice(0, capacity)
  while (next.length < capacity) next.push(null)
  return next
}
