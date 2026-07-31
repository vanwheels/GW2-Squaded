import type { Build } from '../types/build'
import type { SquadCompSharePayload } from './types'

/** The `worker/` backend stores opaque JSON with no schema of its own (see its doc comment) — a
 *  minimal shape check here is what actually protects import against a garbled/foreign payload.
 *  Not a full structural validation of every `Build` field; just enough to catch "this obviously
 *  isn't a build" before it's persisted locally. */
export function isLikelyBuild(data: unknown): data is Build {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.profession === 'string' &&
    Array.isArray(d.specializations) &&
    d.specializations.length === 3 &&
    typeof d.skills === 'object' &&
    d.skills !== null &&
    typeof d.equipment === 'object' &&
    d.equipment !== null
  )
}

export function isLikelySquadCompSharePayload(data: unknown): data is SquadCompSharePayload {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (typeof d.builds !== 'object' || d.builds === null) return false
  if (typeof d.squadComp !== 'object' || d.squadComp === null) return false
  const squadComp = d.squadComp as Record<string, unknown>
  return typeof squadComp.name === 'string' && Array.isArray(squadComp.parties)
}
