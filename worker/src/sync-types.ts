/**
 * Shape of the per-account sync blob the PUT/GET /sync/:username routes (Leg 3) read, merge, and
 * write. Split into its own file so Leg 2's account routes don't need to import Leg 3's handlers
 * to see it.
 *
 * Mirrors the renderer's `Build`/`SquadComp` types (`src/shared/types/{build,squad-comp}.ts`) —
 * kept in sync by hand, same "separate deployable, no shared import" reasoning as
 * `professions.ts`'s duplicated `ProfessionId`. Ported from ChoiceBuds' worker/src/index.ts
 * `SyncPayload` section, with ChoiceBuds' three collections (teams/battles/savedPokemon) swapped
 * for this app's two (builds/squadComps), and no singleton field (ChoiceBuds' optional
 * `playerProfile` has no GW2-Squaded equivalent).
 */

import type { SyncTombstone } from './merge'

type Timestamp = string

/** The Worker only ever needs `id`/`updatedAt` to merge a record (see merge.ts's
 *  `mergeCollection`) — the rest of each collection's shape (Build/SquadComp) is opaque to it. */
export interface HasIdAndUpdatedAt {
  id: string
  updatedAt: Timestamp
  [key: string]: unknown
}

export interface SyncPayload {
  builds: HasIdAndUpdatedAt[]
  buildTombstones: SyncTombstone[]
  squadComps: HasIdAndUpdatedAt[]
  squadCompTombstones: SyncTombstone[]
  savedAt: Timestamp
}

export const EMPTY_SYNC_PAYLOAD: SyncPayload = {
  builds: [], buildTombstones: [],
  squadComps: [], squadCompTombstones: [],
  savedAt: new Date(0).toISOString()
}
