import type { Build, Environment, Skill, TomeChapter, TomeChaptersByTomeId } from '../types'
import { resolveSkillBarIds } from '../weapon-calc/weapon-skills'

/**
 * Every equipped Heal/Utility/Elite skill id that's a "bundle" — Engineer Kits (`Skill.bundleSkills`)
 * — plus every Firebrand Tome id present in `mechanicBarSkillIds` (Tomes are Guardian mechanic-bar
 * skills, not Heal/Utility/Elite picks — see `Build.activeBundleSkillId`'s doc comment — so they're
 * passed in separately rather than read off `build.skills`). These are the ids capable of being
 * toggled into `Build.activeBundleSkillId`; used both to validate/clear that field and to list
 * toggle candidates in the UI.
 */
export function bundleCapableSkillIds(
  build: Build,
  skillsById: Map<number, Skill>,
  tomeChapters: TomeChaptersByTomeId,
  mechanicBarSkillIds: number[]
): number[] {
  const equippedIds = build.skills.kind === 'standard' ? [build.skills.heal, ...build.skills.utility, build.skills.elite] : []
  const kitIds = equippedIds.filter((id): id is number => id !== null && (skillsById.get(id)?.bundleSkills?.length ?? 0) > 0)
  const tomeIds = mechanicBarSkillIds.filter((id) => id in tomeChapters)
  return [...kitIds, ...tomeIds]
}

/** One resolved slot (1-5) of an active kit/tome bundle — either a real `Skill` (Kit) or a
 *  wiki-sourced `TomeChapter` (Tome); display components branch on `kind`. */
export type BundleSlot = { kind: 'kit'; skill: Skill } | { kind: 'tome'; chapter: TomeChapter } | null

export interface ActiveBundle {
  kind: 'kit' | 'tome'
  sourceSkill: Skill
  slots: BundleSlot[]
}

/**
 * Resolves `build.activeBundleSkillId` (if set and still valid) into its 5 displayable slots,
 * scoped to the build's current `environment` (Kits have land/underwater variants the same way
 * weapons do — see `resolveSkillBarIds`; Tomes don't, `TomeChapter` has no environment split).
 * Returns `null` when no bundle is active — callers should fall back to the normal weapon bar.
 */
export function resolveActiveBundle(
  build: Build,
  skillsById: Map<number, Skill>,
  tomeChapters: TomeChaptersByTomeId,
  environment: Environment
): ActiveBundle | null {
  const id = build.activeBundleSkillId
  if (id === null) return null
  const sourceSkill = skillsById.get(id)
  if (!sourceSkill) return null

  if (sourceSkill.bundleSkills && sourceSkill.bundleSkills.length > 0) {
    const candidates = sourceSkill.bundleSkills.map((skillId) => ({ id: skillId, slot: skillsById.get(skillId)?.slot ?? '' }))
    const ids = resolveSkillBarIds(candidates, environment, skillsById)
    return {
      kind: 'kit',
      sourceSkill,
      slots: ids.map((skillId) => {
        const skill = skillId !== null ? skillsById.get(skillId) : undefined
        return skill ? { kind: 'kit', skill } : null
      })
    }
  }

  const chapters = tomeChapters[id]
  if (chapters) {
    const bySlot = new Map(chapters.map((c) => [c.slotIndex, c]))
    return {
      kind: 'tome',
      sourceSkill,
      slots: [0, 1, 2, 3, 4].map((i) => {
        const chapter = bySlot.get(i)
        return chapter ? { kind: 'tome', chapter } : null
      })
    }
  }

  return null
}

/**
 * Every bundle-capable id's own resolved skills, for the given `bundleCapableSkillIds` list and
 * environment — used by the boon/condition calculator so a kit/tome's skills always contribute
 * regardless of whether it's the currently-*displayed* bundle (same "every equipped kit/tome could
 * be opened at will" reasoning as `Build.activeBundleSkillId`'s own doc comment). Kit ids resolve
 * to real `Skill` ids (folded into the normal skill-id list `sources.ts` already walks); Tome
 * chapters have no `Skill` id at all, so they're returned separately as `TomeChapter`s for a
 * dedicated fact-extraction path (see `sources.ts`'s `tomeChapterBoonSources`).
 */
export function bundleSkillIdsForBuild(
  bundleCapableIds: number[],
  skillsById: Map<number, Skill>,
  tomeChapters: TomeChaptersByTomeId,
  environment: Environment
): { kitSkillIds: number[]; tomeChapters: TomeChapter[] } {
  const kitSkillIds: number[] = []
  const chapters: TomeChapter[] = []
  for (const id of bundleCapableIds) {
    const skill = skillsById.get(id)
    if (skill?.bundleSkills && skill.bundleSkills.length > 0) {
      const candidates = skill.bundleSkills.map((skillId) => ({ id: skillId, slot: skillsById.get(skillId)?.slot ?? '' }))
      for (const resolvedId of resolveSkillBarIds(candidates, environment, skillsById)) {
        if (resolvedId !== null) kitSkillIds.push(resolvedId)
      }
      continue
    }
    const tomeChaptersForId = tomeChapters[id]
    if (tomeChaptersForId) chapters.push(...tomeChaptersForId)
  }
  return { kitSkillIds, tomeChapters: chapters }
}
