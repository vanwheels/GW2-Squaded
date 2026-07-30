import type { LocalId, Timestamp } from './common'
import type { ProfessionId } from './game-data'

/**
 * A player's chosen major traits for one equipped specialization line.
 * Minor traits are automatically granted and aren't tracked here.
 */
export interface TraitLineSelection {
  specializationId: number
  /** Chosen major trait id for tiers 1-3, in order. `null` = not yet chosen. */
  chosenTraitIds: [number | null, number | null, number | null]
}

/**
 * A build's 3 trait lines, indexed by fixed position (0-2; line 2 is conventionally the elite
 * spec line). `null` = no specialization chosen for that line. Always exactly 3 entries so a
 * line's array index is a stable identity — a picker targeting "line 3" can write `slots[2]`
 * directly without the array shifting when an earlier line is empty.
 */
export type TraitLineSlots = [TraitLineSelection | null, TraitLineSelection | null, TraitLineSelection | null]

export interface SkillSelection {
  heal: number | null
  utility: [number | null, number | null, number | null]
  elite: number | null
}

export type EquipmentSlotKey =
  | 'helm'
  | 'shoulders'
  | 'chest'
  | 'gloves'
  | 'leggings'
  | 'boots'
  | 'backpiece'
  | 'accessory1'
  | 'accessory2'
  | 'ring1'
  | 'ring2'
  | 'amulet'
  | 'weaponA1'
  | 'weaponA2'
  | 'weaponB1'
  | 'weaponB2'

export interface EquipmentSlot {
  itemStatId: number | null
}

/**
 * A theoretical stat build: profession + specialization/trait choices + skills +
 * equipment stat selections. Comparable in scope to a gw2skills.net build link.
 */
export interface Build {
  id: LocalId
  name: string
  notes: string
  profession: ProfessionId
  /** The 3 equipped specialization lines (fixed positions; `null` = not chosen yet). */
  specializations: TraitLineSlots
  skills: SkillSelection
  equipment: Partial<Record<EquipmentSlotKey, EquipmentSlot>>
  createdAt: Timestamp
  updatedAt: Timestamp
}
