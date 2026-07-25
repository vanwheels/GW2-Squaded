import type { LocalId, Timestamp } from './common'

/** A single roster slot within a party — either empty or referencing a saved Build. */
export interface SquadSlot {
  buildId: LocalId | null
  /** Free-text label shown in the slot when no build is assigned yet, e.g. "any DPS". */
  placeholderLabel: string | null
}

/** WvW squad parties are 5-player groups. */
export type PartySlots = [SquadSlot, SquadSlot, SquadSlot, SquadSlot, SquadSlot]

export interface Party {
  name: string
  slots: PartySlots
}

/**
 * A squad composition: a roster grid of parties. Immutable-snapshot-on-share by design
 * (see project sharing model) — this type describes the locally-editable version.
 */
export interface SquadComp {
  id: LocalId
  name: string
  notes: string
  parties: Party[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
