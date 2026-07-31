import type { Build } from '../types/build'
import type { SquadComp } from '../types/squad-comp'

/** Mirrors the Worker's own `ShareKind` (`worker/src/index.ts`) — kept in sync by hand, see that
 *  file's doc comment. */
export type ShareKind = 'build' | 'squadComp'

/** A squad comp shares its full roster as a standalone snapshot rather than bare `buildId`
 *  references, since those ids only resolve within the sharer's own local database — see
 *  `SquadComp`'s "Immutable-snapshot-on-share" doc comment. `builds` holds every build referenced
 *  by any slot in `squadComp.parties`, keyed by that build's original (sharer-local) id, so the
 *  importer can recreate each one locally and remap slot references onto the new local ids. */
export interface SquadCompSharePayload {
  squadComp: SquadComp
  builds: Record<string, Build>
}

export type SharePayload<K extends ShareKind> = K extends 'build' ? Build : SquadCompSharePayload

export interface CreateShareResponse {
  id: string
}

export interface GetShareResponse {
  kind: ShareKind
  data: unknown
  createdAt: string
}
