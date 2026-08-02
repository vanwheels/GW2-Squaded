import type { LocalId, Timestamp } from './common'
import type { ProfessionId } from './game-data'

/**
 * A "just the icon" pick for a slot with no saved Build ready yet — profession plus optionally an
 * elite specialization (`null` = core/no elite spec chosen). Deliberately NOT a real `Build`: it's
 * never saved, never appears in the Builds list, and has no majors/gear/skills to compute anything
 * from — purely a visual stand-in until a real build gets assigned. Mutually exclusive with
 * `SquadSlot.buildId` (assigning one always clears the other).
 */
export interface GhostPick {
  profession: ProfessionId
  specializationId: number | null
}

/** A single roster slot within a party — either empty, a `GhostPick`, or a saved Build. */
export interface SquadSlot {
  buildId: LocalId | null
  ghostPick: GhostPick | null
  /** Free-text label shown in the slot when no build is assigned yet, e.g. "any DPS". */
  placeholderLabel: string | null
}

/** WvW squad parties are 5-player groups. */
export type PartySlots = [SquadSlot, SquadSlot, SquadSlot, SquadSlot, SquadSlot]

export interface Party {
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
  /** User-defined labels for search/filtering (`SquadsView`). Absent on records saved before this
   *  field existed — read paths backfill `tags ?? []`, no storage migration. See `Build.tags`. */
  tags: string[]
  /** Manual sort position for the Squads card grid's drag-to-reorder (`SquadsView`) — same
   *  scheme as `Build.order`, see its doc comment. */
  order: number
}
