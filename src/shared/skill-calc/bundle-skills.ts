import type { Build, Environment, Skill, TomeChapter, TomeChaptersByTomeId } from '../types'
import { resolveSkillBarIds } from '../weapon-calc/weapon-skills'

/** Druid's "Celestial Avatar" mechanic-bar (Profession_5) skill id. */
const CELESTIAL_AVATAR_SKILL_ID = 31869

/**
 * The 5 real Celestial-Avatar-form skills, resolved by `categories.includes('CelestialAvatar')`
 * rather than by `specializationId` — live-verified 2026-07-31 (correcting an earlier, wrong
 * 2026-07-30 identification that used `specializationId === 5`/Druid instead): that field only
 * identifies "a skill gated to Druid," which is ALSO true of Ranger's normal (non-transformed)
 * Staff weapon bar (Solar Beam/Astral Wisp/Ancestral Grace/Vine Surge/Sublime Conversion —
 * `profession.weapons.Staff.skills`, tagged `specializationId: 5` at the weapon level since Staff
 * was originally Druid-exclusive) — a hybrid damage/heal kit used to build Astral Force, NOT what
 * you see once transformed. The real transformation skills (Cosmic Ray/Seed of Life/Lunar Impact/
 * Rejuvenating Tides/Natural Convergence) are a completely different, heal-focused set whose
 * descriptions all literally start "Celestial Avatar." (same naming-convention tell already used
 * elsewhere in this codebase — e.g. Soulbeast's per-pet-family kit starting "Beast.", see
 * `profession-mechanic.ts`'s `EXCLUDED_MECHANIC_SKILL_IDS`) and which carry `specializationId:
 * null` — the wrong-set bug hid behind exactly that split. Each slot has 2 near-identical ids
 * (differing only by a `GroundTargeted`/`NoUnderwater` flag pair with no other distinguishing
 * field) — same shape as Ritualist's Shroud slots in `NECRO_SHROUD_SLOT_SKILLS` below, not a real
 * land/underwater split (Celestial Avatar can't be entered underwater at all); falls back to the
 * lower id deterministically, a documented known limitation rather than a guess.
 */
function celestialAvatarSlotSkillIds(skillsById: Map<number, Skill>): (number | null)[] {
  const bySlot = new Map<string, Skill[]>()
  for (const skill of skillsById.values()) {
    if (skill.categories.includes('CelestialAvatar') && skill.slot.startsWith('Weapon_')) {
      const existing = bySlot.get(skill.slot)
      if (existing) existing.push(skill)
      else bySlot.set(skill.slot, [skill])
    }
  }
  return ['Weapon_1', 'Weapon_2', 'Weapon_3', 'Weapon_4', 'Weapon_5'].map((slot) => {
    const candidates = bySlot.get(slot)
    if (!candidates || candidates.length === 0) return null
    return [...candidates].sort((a, b) => a.id - b.id)[0].id
  })
}

/**
 * Necromancer's Shroud (core Death Shroud, Reaper's Shroud, Harbinger Shroud, Ritualist's Shroud —
 * NOT Scourge, which replaces Shroud with the non-bundle Shade mechanic instead): entering Shroud
 * replaces the weapon-skill bar with 5 fixed skills, same bundle shape as Celestial Avatar, keyed
 * by the F1 mechanic-bar skill id `profession-mechanic.ts` already resolves (10574/30792/62567/
 * 77238 for core/Reaper/Harbinger/Ritualist respectively). Hand-verified 2026-07-31 against both
 * the wiki and `/v2/skills` — a genuinely unusual API data shape not worth generalizing into a
 * `celestialAvatarSlotSkillIds`-style auto-scan: every Shroud's slots 1-4 are tagged `slot:
 * "Downed_1"`-`"Downed_4"` in the raw data (reusing the Downed-state bar's own slot labels, not a
 * `Weapon_`-prefixed one — real, confirmed by cross-referencing exact skill names against the wiki
 * page for each Shroud, not a guess), and only slot 5 gets `"Weapon_5"`. Per-variant notes:
 * - Core: single id per slot, no ambiguity (10554/10604/10588/10594/19504).
 * - Reaper: slot 1 is itself a 3-hit chain (Life Rend -> Life Slash -> Life Reap); slot 3's
 *   "Infusing Terror" flips to a dormant "Terrify" id. Only the chain/flip entry points are listed
 *   below (29442, not 29458/30278; 29958, not its flip target 29709) — the flip targets are never
 *   independently equippable, same reasoning `weapon-calc/weapon-skills.ts` already documents.
 * - Harbinger: single id per slot, no ambiguity.
 * - Ritualist: slots 3 ("Wanderlust") and 5 ("Summon Spirits") each have 2 near-identical duplicate
 *   ids differing only in a `GroundTargeted`/`NoUnderwater` flag pair with no other distinguishing
 *   field — same "duplicate ids, no clean signal" shape as the Weaver Dual Attack/duplicate-skill
 *   cases in TODO.md. Falls back to the lower id deterministically (76741, 76607) rather than
 *   guessing which is "correct" — a documented known limitation, not a silent guess.
 */
const NECRO_SHROUD_SLOT_SKILLS: Record<number, number[]> = {
  10574: [10554, 10604, 10588, 10594, 19504], // core Death Shroud
  30792: [29442, 30825, 29958, 30504, 30557], // Reaper's Shroud
  62567: [62611, 62621, 62672, 62539, 62563], // Harbinger Shroud
  77238: [77061, 76864, 76741, 76684, 76607] // Ritualist's Shroud
}

/**
 * Every equipped Heal/Utility/Elite skill id that's a "bundle" — Engineer Kits (`Skill.bundleSkills`)
 * — plus every Firebrand Tome id present in `mechanicBarSkillIds` (Tomes are Guardian mechanic-bar
 * skills, not Heal/Utility/Elite picks — see `Build.activeBundleSkillId`'s doc comment — so they're
 * passed in separately rather than read off `build.skills`), plus Druid's Celestial Avatar id and
 * Necromancer's Shroud id under the same condition (`Profession_1`/`_5`, resolved by
 * `professionMechanicBar` same as Tomes' `Profession_1`-`3`). These are the ids capable of being
 * toggled into `Build.activeBundleSkillId`; used both to validate/clear that field and to list
 * toggle candidates in the UI (though Tomes and Shroud toggle via their own F-bar icon now, see
 * `ProfessionMechanicBar` — only Kits and Celestial Avatar still use the separate toggle row).
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
  const celestialAvatarIds = mechanicBarSkillIds.filter((id) => id === CELESTIAL_AVATAR_SKILL_ID)
  const shroudIds = mechanicBarSkillIds.filter((id) => id in NECRO_SHROUD_SLOT_SKILLS)
  return [...kitIds, ...tomeIds, ...celestialAvatarIds, ...shroudIds]
}

/** Ids `ProfessionMechanicBar` makes clickable directly on their own F-bar icon rather than
 *  through the separate toggle row — Tomes, Shroud, and Celestial Avatar (Engineer Kits still use
 *  the row; see that component's doc comment for why). */
export function isMechanicBarBundleId(id: number, tomeChapters: TomeChaptersByTomeId): boolean {
  return id in tomeChapters || id in NECRO_SHROUD_SLOT_SKILLS || id === CELESTIAL_AVATAR_SKILL_ID
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

  if (id === CELESTIAL_AVATAR_SKILL_ID) {
    return {
      kind: 'kit',
      sourceSkill,
      slots: celestialAvatarSlotSkillIds(skillsById).map((skillId) => {
        const skill = skillId !== null ? skillsById.get(skillId) : undefined
        return skill ? { kind: 'kit', skill } : null
      })
    }
  }

  const shroudSlotIds = NECRO_SHROUD_SLOT_SKILLS[id]
  if (shroudSlotIds) {
    return {
      kind: 'kit',
      sourceSkill,
      slots: shroudSlotIds.map((skillId) => {
        const skill = skillsById.get(skillId)
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
    if (id === CELESTIAL_AVATAR_SKILL_ID) {
      for (const resolvedId of celestialAvatarSlotSkillIds(skillsById)) {
        if (resolvedId !== null) kitSkillIds.push(resolvedId)
      }
      continue
    }
    const shroudSlotIds = NECRO_SHROUD_SLOT_SKILLS[id]
    if (shroudSlotIds) {
      kitSkillIds.push(...shroudSlotIds)
      continue
    }
    const tomeChaptersForId = tomeChapters[id]
    if (tomeChaptersForId) chapters.push(...tomeChaptersForId)
  }
  return { kitSkillIds, tomeChapters: chapters }
}
