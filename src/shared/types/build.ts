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

export interface StandardSkillSelection {
  kind: 'standard'
  heal: number | null
  utility: [number | null, number | null, number | null]
  elite: number | null
}

/**
 * Revenant's skill mechanic is fundamentally different from every other profession: instead of
 * independently choosing a Heal/Utility/Elite skill, a Revenant equips 2 Legends (by `Legend.id`,
 * see game-data.ts), each of which is a *fixed* kit (its own heal/3 utility/elite skills, not
 * player-selectable) that can be swapped between in combat. `null` = that legend slot not yet
 * chosen.
 */
export interface RevenantSkillSelection {
  kind: 'revenant'
  legends: [string | null, string | null]
  /** Which equipped legend's fixed skill bar is currently displayed in the editor — display-only,
   *  doesn't affect computed boon/condition totals since both legends' kits always contribute. */
  activeLegendIndex: 0 | 1
}

export type SkillSelection = StandardSkillSelection | RevenantSkillSelection

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
