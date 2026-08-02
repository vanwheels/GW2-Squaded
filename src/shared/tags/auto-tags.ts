import type { Build, Profession, Specialization } from '../types'

/**
 * Profession + (if chosen) elite-specialization name for a build, e.g. `["Mesmer",
 * "Chronomancer"]` or just `["Guardian"]` at Core. Computed on the fly rather than stored in
 * `Build.tags` — deriving it from `profession`/`specializations` means it can never drift out of
 * sync with the build's actual profession/spec the way a persisted string could if the build were
 * later changed. Shown as non-removable chips alongside `Build.tags` in the tag editor, and merged
 * into the same filter-chip vocabulary as user tags (see `renderer/state/use-tag-filter.ts`).
 */
export function getBuildAutoTags(
  build: Build,
  gameData: { professions: Profession[]; specializationsById: Map<number, Specialization> }
): string[] {
  const profession = gameData.professions.find((p) => p.id === build.profession)
  const tags = [profession?.name ?? build.profession]
  /** The elite spec line is always the 3rd trait line, by GW2 convention (same constant as
   *  `ProfessionSpecPicker`'s `ELITE_LINE_INDEX`). */
  const eliteLine = build.specializations[2]
  const eliteSpec = eliteLine ? gameData.specializationsById.get(eliteLine.specializationId) : undefined
  if (eliteSpec?.elite) tags.push(eliteSpec.name)
  return tags
}
