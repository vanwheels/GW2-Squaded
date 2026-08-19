import { isProfession } from './professions'

/** Mirrors `src/shared/share/validate.ts`'s `isLikelyBuild`/`isLikelySquadCompSharePayload` in the
 *  main app — duplicated here rather than imported, same "separate deployable, no monorepo
 *  tooling" reasoning as `index.ts`'s duplicated `ShareKind` (see that file's doc comment). Only
 *  the fields `/buildAdd`/`/squadAdd`/`/buildEdit`/`/squadEdit` actually need are checked; this is
 *  not a full structural validation, same scope as the original. */

export interface LikelyBuildFields {
  name: string
  profession: string
}

export function asLikelyBuildFields(data: unknown): LikelyBuildFields | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (
    typeof d.profession !== 'string' ||
    !isProfession(d.profession) ||
    !Array.isArray(d.specializations) ||
    d.specializations.length !== 3 ||
    typeof d.skills !== 'object' ||
    d.skills === null ||
    typeof d.equipment !== 'object' ||
    d.equipment === null ||
    typeof d.name !== 'string'
  ) {
    return null
  }
  return { name: d.name, profession: d.profession }
}

export interface LikelySquadCompFields {
  name: string
}

export function asLikelySquadCompFields(data: unknown): LikelySquadCompFields | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d.builds !== 'object' || d.builds === null) return null
  if (typeof d.squadComp !== 'object' || d.squadComp === null) return null
  const squadComp = d.squadComp as Record<string, unknown>
  if (typeof squadComp.name !== 'string' || !Array.isArray(squadComp.parties)) return null
  return { name: squadComp.name }
}
