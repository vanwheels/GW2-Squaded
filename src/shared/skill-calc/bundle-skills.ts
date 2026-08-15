import type { Build, Environment, Skill, TomeChapter, TomeChaptersByTomeId } from '../types'
import { resolveSkillBarIds } from '../weapon-calc/weapon-skills'
import { GUNSABER_WEAPON_BAR_SKILL_IDS } from './gunsaber-skills'
import {
  DRAGON_SLASH_BAR_SKILL_IDS,
  DRAGON_SLASH_RIVERS_FLOW_BAR_SKILL_IDS,
  DRAGON_SLASH_SHARP_AS_THE_WIND_BAR_SKILL_IDS,
  DRAGON_TRIGGER_SKILL_ID,
  RIVERS_FLOW_TRAIT_ID,
  SHARP_AS_THE_WIND_TRAIT_ID
} from './dragon-slash-skills'

/** Druid's "Celestial Avatar" mechanic-bar (Profession_5) skill id. Exported so
 *  `skill-calc/glyph-forms.ts` can read `Build.activeBundleSkillId` against the same id this file
 *  uses to swap the weapon bar — a Druid Glyph's real facts depend on the identical toggle. */
export const CELESTIAL_AVATAR_SKILL_ID = 31869

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
 * Thief Specter (specialization id 71, `SPECTER_SPEC_ID` in `profession-mechanic.ts`)'s "Enter
 * Shadow Shroud" (63155, Specter's F2 — see that file's doc comment for the hand-injection this
 * relies on): same bundle shape as Necromancer's Shroud above, live-verified 2026-08-01. Unlike
 * every Necromancer variant, these 5 weapon-bar ids carry no raw `Downed_`/`Weapon_5` split at all
 * — all 5 are plain `Weapon_1`-`Weapon_5`, and none is part of Scepter's own normal weapon bar
 * (Scepter's real ids are 63066/63351/63254/63267/63154 — easy to confuse since both share
 * `specializationId: 71` and overlapping "Shadow"/"Night" flavor text). Weapon_2 ("Grasping
 * Shadows") and Weapon_3 ("Dawn's Repose") each have a `GroundTargeted` duplicate id with no other
 * distinguishing field — same "duplicate ids, no clean signal" shape as Ritualist's Shroud dupes
 * above; falls back to the lower (non-ground-targeted) id deterministically, matching this file's
 * existing convention rather than guessing.
 */
const SPECTER_SHROUD_SLOT_SKILLS: Record<number, number[]> = {
  63155: [63362, 63107, 63227, 63160, 63249] // Enter Shadow Shroud
}

/** Every entry-skill id that toggles the weapon-skill row into a fixed 5-skill Shroud bundle —
 *  Necromancer's 4 Shroud variants plus Specter's — keyed the same way; merged into one lookup
 *  since every caller below treats them identically. */
/** Exported so `scripts/scan-empty-effect-facts.ts` (and anything else needing "is this
 *  `Downed_*`-slotted id actually reachable" without a full `Build` in hand) can check membership
 *  without re-deriving this hand-verified table — see this file's own doc comment above for why
 *  `slot: "Downed_*"` alone doesn't mean unreachable for Necromancer's 4 Shroud variants. */
export const SHROUD_SLOT_SKILLS: Record<number, number[]> = { ...NECRO_SHROUD_SLOT_SKILLS, ...SPECTER_SHROUD_SLOT_SKILLS }

/** Bladesworn's "Unsheathe Gunsaber" id (Warrior's Profession_1 F1 button — see
 *  `profession-mechanic.ts`'s Warrior weapon-type-filter carve-out for why it survives that
 *  filter) mapped to Gunsaber's own 5 weapon-bar skills — same bundle shape as Necromancer's
 *  Shroud above, except these 5 ids don't exist in the API at all and are hand-authored in
 *  `gunsaber-skills.ts` (see that file's doc comment for the full data-gap writeup). */
const GUNSABER_UNSHEATHE_SKILL_ID = 62745
const GUNSABER_SLOT_SKILLS: Record<number, number[]> = {
  [GUNSABER_UNSHEATHE_SKILL_ID]: GUNSABER_WEAPON_BAR_SKILL_IDS
}

/**
 * Which of Dragon Trigger's 3 possible 5-skill bars applies for a build — untraited, or reflavored
 * by whichever of Bladesworn's 2 Dragon-Slash traits (if either) is chosen (see
 * `dragon-slash-skills.ts`'s doc comment for the full writeup). Checks `chosenTraitIds` membership
 * across every specialization line, not just whichever one currently holds Bladesworn — a trait id
 * is globally unique, so this is safe regardless of line index, same defensive shape as
 * `boon-calc/sources.ts`'s own `activeTraitIds`. Both traits are real player-chosen Major traits
 * (never auto-granted minors), so `chosenTraitIds` alone (no minor-trait scan needed) is enough,
 * same "just check membership, no full trait-object lookup" shape as `skill-variants.ts`'s
 * `GADGETEER_GATED_SKILL_IDS` resolution.
 */
function dragonSlashBarSkillIdsForBuild(build: Build): number[] {
  const chosenTraitIds = new Set(build.specializations.flatMap((line) => line?.chosenTraitIds ?? []))
  if (chosenTraitIds.has(SHARP_AS_THE_WIND_TRAIT_ID)) return DRAGON_SLASH_SHARP_AS_THE_WIND_BAR_SKILL_IDS
  if (chosenTraitIds.has(RIVERS_FLOW_TRAIT_ID)) return DRAGON_SLASH_RIVERS_FLOW_BAR_SKILL_IDS
  return DRAGON_SLASH_BAR_SKILL_IDS
}

/**
 * Every equipped Heal/Utility/Elite skill id that's a "bundle" — Engineer Kits (`Skill.bundleSkills`)
 * — plus every Firebrand Tome id present in `mechanicBarSkillIds` (Tomes are Guardian mechanic-bar
 * skills, not Heal/Utility/Elite picks — see `Build.activeBundleSkillId`'s doc comment — so they're
 * passed in separately rather than read off `build.skills`), plus Druid's Celestial Avatar id and
 * Necromancer's Shroud id under the same condition (`Profession_1`/`_5`, resolved by
 * `professionMechanicBar` same as Tomes' `Profession_1`-`3`). These are the ids capable of being
 * toggled into `Build.activeBundleSkillId`; used both to validate/clear that field and to list
 * toggle candidates in the UI (though Tomes, Shroud, Celestial Avatar, and Gunsaber all toggle via
 * their own F-bar icon now, see `ProfessionMechanicBar` — only Kits still use the separate toggle
 * row, since a Kit has no fixed F-slot of its own; see `WeaponSkillBar`'s doc comment for why).
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
  const shroudIds = mechanicBarSkillIds.filter((id) => id in SHROUD_SLOT_SKILLS)
  const gunsaberIds = mechanicBarSkillIds.filter((id) => id in GUNSABER_SLOT_SKILLS)
  const dragonSlashIds = mechanicBarSkillIds.filter((id) => id === DRAGON_TRIGGER_SKILL_ID)
  return [...kitIds, ...tomeIds, ...celestialAvatarIds, ...shroudIds, ...gunsaberIds, ...dragonSlashIds]
}

/** Ids `ProfessionMechanicBar` makes clickable directly on their own F-bar icon rather than
 *  through the separate toggle row — Tomes, Shroud, Celestial Avatar, Gunsaber, and Dragon Trigger
 *  (Engineer Kits still use the row; see that component's doc comment for why). */
export function isMechanicBarBundleId(id: number, tomeChapters: TomeChaptersByTomeId): boolean {
  return (
    id in tomeChapters ||
    id in SHROUD_SLOT_SKILLS ||
    id === CELESTIAL_AVATAR_SKILL_ID ||
    id in GUNSABER_SLOT_SKILLS ||
    id === DRAGON_TRIGGER_SKILL_ID
  )
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

  const shroudSlotIds = SHROUD_SLOT_SKILLS[id]
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

  const gunsaberSlotIds = GUNSABER_SLOT_SKILLS[id]
  if (gunsaberSlotIds) {
    return {
      kind: 'kit',
      sourceSkill,
      slots: gunsaberSlotIds.map((skillId) => {
        const skill = skillsById.get(skillId)
        return skill ? { kind: 'kit', skill } : null
      })
    }
  }

  if (id === DRAGON_TRIGGER_SKILL_ID) {
    return {
      kind: 'kit',
      sourceSkill,
      slots: dragonSlashBarSkillIdsForBuild(build).map((skillId) => {
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
 * dedicated fact-extraction path (see `sources.ts`'s `tomeChapterBoonSources`). `build` is only
 * used for `dragonSlashBarSkillIdsForBuild`'s trait-gated bar selection (Dragon Slash is the one
 * bundle whose resolved skill list depends on more than the mechanic-bar id itself).
 */
export function bundleSkillIdsForBuild(
  build: Build,
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
    const shroudSlotIds = SHROUD_SLOT_SKILLS[id]
    if (shroudSlotIds) {
      kitSkillIds.push(...shroudSlotIds)
      continue
    }
    const gunsaberSlotIds = GUNSABER_SLOT_SKILLS[id]
    if (gunsaberSlotIds) {
      kitSkillIds.push(...gunsaberSlotIds)
      continue
    }
    if (id === DRAGON_TRIGGER_SKILL_ID) {
      kitSkillIds.push(...dragonSlashBarSkillIdsForBuild(build))
      continue
    }
    const tomeChaptersForId = tomeChapters[id]
    if (tomeChaptersForId) chapters.push(...tomeChaptersForId)
  }
  return { kitSkillIds, tomeChapters: chapters }
}
