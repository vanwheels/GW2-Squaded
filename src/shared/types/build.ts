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
  /** Up to 3 equipped specialization lines. */
  specializations: TraitLineSelection[]
  skills: SkillSelection
  equipment: Partial<Record<EquipmentSlotKey, EquipmentSlot>>
  createdAt: Timestamp
  updatedAt: Timestamp
}
