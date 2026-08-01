import type { Build, Profession, ProfessionId, Skill, SoulbeastBeastmodeMap } from '../types'

export interface ProfessionMechanicBarEntry {
  slot: string
  skill: Skill
}

/**
 * Skill ids that are candidates for an F1-F5 slot in the raw API data but must never be picked,
 * live-verified 2026-07-30 while wiring this resolver into the UI across all 9 professions (not
 * just Guardian, which this resolver was originally built and verified against). Grouped by why:
 */
const EXCLUDED_MECHANIC_SKILL_IDS = new Set<number>([
  // Warrior Spellbreaker (spec 61) Profession_2: 6 same-slot, same-spec, no-flip ids sharing
  // categories:["Burst"] with no differentiator from the current "Full Counter" (44165) — almost
  // certainly pre-rework leftover ids for a removed per-weapon Full Counter design. Excluding them
  // leaves 44165 as the sole candidate.
  39972, 46044, 41283, 41543, 43488, 44397,
  // Elementalist's newest elite spec (id 80) reworks the 4 Attunement-swap buttons (F1-F4) into
  // ids that collide 3-deep on slot Profession_1 with no differentiator. Excluding lets F1-F4
  // always fall back to the base 4 Attunement ids (5492-5495) even with that spec equipped — a
  // documented simplification (generic "Fire/Water/Air/Earth Attunement" label rather than that
  // spec's reworked flavor).
  76580, 76988, 77082, 76703,
  // Engineer Scrapper (spec 43) Profession_5 "Function Gyro": 2 older same-name, no-flip
  // duplicate ids (a rename/rework left orphaned ids behind) — keep the highest id (72114) as a
  // best-effort "most recent" pin; unlike the Warrior exclusion above, no name-based tell confirms
  // this is actually correct.
  56920, 72103,
  // Engineer Mechanist (spec 70) Profession_4 ("Crash Down"/"Depth Charges"/"Recall Mech"): 3
  // differently-named ids under one slot with no clean single "the F4 button" pick — genuinely
  // unresolved. Excluding drops the slot entirely for Mechanist rather than guessing.
  63050, 63210, 63089,
  // Engineer's newest elite spec "Amalgam" (spec 75) Profession_2-5: F2-F4 are literally named
  // "Locked" ("Select a skill using the arrow above") — a dynamically-chosen sub-mechanic, not a
  // fixed id; F5 "Evolve" has 2 identical no-flip duplicates with no tell either. All excluded,
  // genuinely unresolved this pass.
  77388, 76790, 77107, 76642, 76651,
  // Ranger's "Worldly Impact" (Profession_3): its raw `specialization` field is missing entirely
  // (unlike every other Beastmode id, which is correctly tagged spec 55/Soulbeast — see
  // `RANGER_BEASTMODE_SPEC_ID` below) even though its description starts "Beast." exactly like the
  // rest of Soulbeast's per-pet-family kit — a real API data gap, not a base-game core F3.
  // Excluding it directly since the spec-based exclusion below can't catch it.
  42809,
  // Ranger's "Unflinching Fortitude" (Profession_3): same class of gap as "Worldly Impact" just
  // above — live-verified 2026-07-31 it's one of the 5 per-pet-archetype F3 ids in
  // `data/game-data/soulbeast-beastmode.json` (Soulbeast-exclusive, description starts "Beast."
  // exactly like the rest of that kit) but its raw `specialization` field is null, so without this
  // exclusion the generic resolver picks it as core Ranger's spec-less Profession_3 fallback and
  // shows it on every Ranger form (Druid, Untamed, no elite spec) except Soulbeast, which already
  // gets its own correct F3 from `soulbeastBeastmodeBar`.
  45797,
  // Revenant Profession_1: every candidate here is exactly one of the 8 Legends' own `swap` skill
  // id (live-verified 2026-07-30 by name match against legends.json, e.g. 28419 "Legendary Dwarf
  // Stance" = Jalis's swap skill) — already fully surfaced by the Legend picker itself,
  // (`RevenantSkillsEditor`), so showing them again as a redundant "F1" button would be confusing.
  // Re-verify against legends.json if a new Revenant elite spec/legend is ever added.
  28419, 28494, 28195, 28134, 28085, 46409, 62891, 76610,
  // Revenant Conduit (spec 79) Profession_2 "Release Potential": 5 differently-named ids (one per
  // Assassin/Monk/Dervish/Mesmer/Warrior "affinity") sharing one slot with no clean single pick —
  // live-verified 2026-07-30 the correct one depends on a player-chosen "Vestige"/Affinity build
  // axis this app doesn't model at all yet. Excluding drops Conduit's F2 entirely rather than
  // guessing (picking one arbitrarily would be wrong for most players).
  78845, 78501, 78661, 78615, 78895,
  // Ranger Untamed (spec 72) Profession_5 "Unleash Ranger"/"Unleash Pet": a single toggle skill (the
  // 2 ids are each other's `flip_skill` target), not 2 independent picks — showing only one (the
  // resolver's lowest-id fallback would silently prefer "Unleash Ranger") would misrepresent the
  // mechanic. Resolved 2026-07-31: the toggle is surfaced separately as `Build.rangerUnleashed`, a
  // `WeaponSkillBar.tsx` display toggle (see `untamed-unleash.ts`), not as a mechanic-bar button —
  // both ids stay excluded here so Untamed's F5 is simply omitted from this bar rather than
  // duplicating that toggle. (Untamed's actual F1-F3 pet-skill-replacement set — "Venomous
  // Outburst"/"Rending Vines"/"Enveloping Haze" — is NOT excluded and resolves normally through this
  // generic resolver whenever Untamed is equipped; see docs/game-data.md's "Untamed's Unleash
  // mechanic, resolved" section for the full writeup, including why it's unconditional.)
  63147, 63344
])

/**
 * Ranger Soulbeast (specialization id 55): live-verified 2026-07-30 every `Profession_1`-`_4`
 * candidate gated to this spec (e.g. "Swoop"/"Bite"/"Quickening Screech"/"Defy Pain" per pet
 * *family* in `Profession_1`/`_2`; "Spiritual Reprieve"/"Primal Cry" in `Profession_3`; "Eternal
 * Bond" — a contextual "merge with your other pet" alternate — in `Profession_4`) can't be picked
 * by this resolver's normal per-spec logic — none of them is a single fixed id, since the real
 * skill depends on which pet the build has merged with, not just which specialization is equipped.
 * `Profession_1`-`_3` are resolved separately instead, by `soulbeastBeastmodeBar` (below) reading
 * `data/game-data/soulbeast-beastmode.json`; `Profession_4` ("Eternal Bond", a contextual "merge
 * with your other pet" alternate) has no such per-pet data and stays genuinely unresolved. All 4
 * stay excluded here either way so this resolver's own per-spec fallback doesn't pick a wrong one.
 * `Profession_5` ("Beastmode", the actual merge-with-pet toggle button) is the one exception — a
 * single clean id, not excluded. Excluded by spec id rather than individually listing ~65 ids.
 */
export const RANGER_BEASTMODE_SPEC_ID = 55
const RANGER_BEASTMODE_EXCLUDED_SLOTS = new Set(['Profession_1', 'Profession_2', 'Profession_3', 'Profession_4'])

/**
 * Guardian Dragonhunter (specialization id 27): live-verified 2026-07-31 a real gap in the
 * `/v2/professions/Guardian` response — its virtue skills "Spear of Justice" (F1)/"Wings of
 * Resolve" (F2)/"Shield of Courage" (F3) never appear in `professionSkills` at all (unlike every
 * other Guardian elite spec's virtue rework, which does), even though the ids themselves exist in
 * `/v2/skills` correctly tagged `specialization: 27` and `slot: "Profession_1"`/`"_2"`/`"_3"` — the
 * same class of gap as Ranger's "Worldly Impact" above. Hand-injected by id below so the normal
 * per-slot resolver (flip-chain dedup, spec-match preference) still runs over them like any other
 * candidate; without this, Dragonhunter silently falls back to showing core Guardian's unthemed
 * Virtue of Justice/Resolve/Courage instead of its own.
 */
const DRAGONHUNTER_VIRTUE_SKILLS: { id: number; slot: string }[] = [
  { id: 29887, slot: 'Profession_1' }, // Spear of Justice
  { id: 30783, slot: 'Profession_2' }, // Wings of Resolve (entry point)
  { id: 30225, slot: 'Profession_2' }, // Wings of Resolve (flip target)
  { id: 30029, slot: 'Profession_3' }, // Shield of Courage (entry point)
  { id: 30039, slot: 'Profession_3' } // Shield of Courage (flip target)
]

/**
 * Necromancer's Shroud-enter skills — core Death Shroud (10574), Reaper's Shroud (30792),
 * Harbinger Shroud (62567), Ritualist's Shroud (77238) — live-verified 2026-07-31 while wiring up
 * Shroud's F1 click-toggle (see `bundle-skills.ts`'s `NECRO_SHROUD_SLOT_SKILLS`): unlike every
 * other elite spec's mechanic-skill rework in this file, all 4 are tagged `specializationId: null`
 * in the raw API — none of them actually carries the elite spec that requires it. Without this
 * override the generic resolver's spec-match step can't tell them apart at all, and its final
 * "lowest id" tie-break always silently picks core Death Shroud regardless of equipped elite spec.
 * Used to feed the resolver a corrected `specializationId` per id (see `professionMechanicBar`'s
 * candidate-gathering loop) rather than duplicating its spec-match/flip-chain logic here — core
 * Death Shroud itself needs no entry, it's correctly the fallback once the other 3 are excluded.
 */
const NECRO_SHROUD_SPEC_OVERRIDE: Record<number, number> = {
  30792: 34, // Reaper's Shroud -> Reaper
  62567: 64, // Harbinger Shroud -> Harbinger
  77238: 76 // Ritualist's Shroud -> Ritualist
}

/** Slots that exist in the raw data but aren't a real, build-determinable F-skill. Thief's F2 is
 *  the "stolen skill" — live-verified its candidates are tagged per enemy *profession*
 *  (`source: "Warrior"`, `"Guardian"`, ...), i.e. it depends on who you steal from in a live
 *  fight, not on anything in the build. */
const SKIPPED_SLOTS: Partial<Record<ProfessionId, string[]>> = {
  Thief: ['Profession_2']
}

/**
 * Resolves a profession's mechanic ("F-skill") bar — Guardian's Virtue of Justice/Resolve/Courage
 * in F1-F3, Warrior's per-weapon Burst Skill, etc. — down to the one id per slot that actually
 * applies given the build's equipped specializations (and, for Warrior's Burst Skill only,
 * equipped main-hand weapon type). Grouped by `Profession.professionSkills`' own `slot` field
 * (`Profession_1`-`Profession_5`) rather than by name, unlike `skill-calc/skill-variants.ts`'s
 * Heal/Utility/Elite collapsing: an elite spec reworking a mechanic skill usually renames it
 * entirely (Guardian's "Virtue of Justice" -> Firebrand's "Tome of Justice" -> Willbender's
 * "Rushing Justice"), so name-based grouping wouldn't collapse them.
 *
 * Does NOT cover Engineer's base Toolbelt (F1-F4) — that's not enumerable via `professionSkills`
 * at all, see `engineerToolbeltBar` below — nor Ranger's pet skill or Revenant's Legend kit, which
 * are surfaced by their own dedicated pickers (`PetsEditor`/`RevenantSkillsEditor`) instead; this
 * resolver still runs for both professions to pick up their *other* real F-buttons (Druid's
 * Celestial Avatar toggle, Vindicator's Energy Meld, ...), just with the Legend/pet-adjacent
 * candidates filtered out (see `EXCLUDED_MECHANIC_SKILL_IDS`/`RANGER_BEASTMODE_SPEC_ID`).
 *
 * Per slot, resolution is:
 * 0. Drop any candidate in `EXCLUDED_MECHANIC_SKILL_IDS` (hand-verified legacy/ambiguous ids, see
 *    that constant's doc comment) and any slot listed in `SKIPPED_SLOTS`.
 * 1. Warrior's `Profession_1` only: further filter candidates to `skill.weaponType ===
 *    mainHandWeaponType` — Burst Skill has dozens of candidates with no `specializationId` at all
 *    to disambiguate, varying by equipped weapon instead of by spec.
 * 2. Prefer the id(s) whose `specializationId` matches an equipped spec; fall back to the
 *    spec-less (`specializationId === null`) base id if none match (same rule
 *    `skill-variants.ts` already uses for Heal/Utility/Elite reworks).
 * 3. Drop any remaining id that's another remaining id's `flipSkill` target (e.g. Firebrand's
 *    "Tome of Justice" (44364) flips to a "dormant" duplicate-named id (68647) the wiki itself
 *    documents as an alt id for the same skill — not a separate pick).
 * 4. If more than one id is still left (a real wrinkle found live 2026-07-30: Firebrand's F1 slot
 *    also lists "Stow Tome", a same-spec terminal id with no outgoing `flipSkill` of its own, and
 *    F3 lists a genuine duplicate-named "Tome of Courage" id with no outgoing flip either), prefer
 *    whichever id DOES have a non-null `flipSkill` — the entry-point skill a player actually
 *    equips always chains to something (its own activated/dormant effect), while a chain's
 *    terminal ids ("Stow X") don't. Falls back to the lowest id deterministically if that still
 *    doesn't narrow to one — a known, documented edge case, not a guess at which is "correct".
 * 5. Finally, if the chosen skill requires a specialization the build doesn't have equipped, the
 *    slot is dropped entirely rather than shown — this matters for slots that only exist under one
 *    elite spec at all (e.g. an elite-spec-only F4/F5): without this, a build with NO elite spec
 *    equipped would still see that elite spec's F-button, since a slot with only ONE candidate (or
 *    with no spec-less fallback candidate) would otherwise resolve to it by default.
 */
export function professionMechanicBar(
  profession: Profession,
  skillsById: Map<number, Skill>,
  equippedSpecializationIds: ReadonlySet<number>,
  mainHandWeaponType?: string | null
): ProfessionMechanicBarEntry[] {
  const skippedSlots = new Set(SKIPPED_SLOTS[profession.id] ?? [])
  const slotOrder: string[] = []
  const bySlot = new Map<string, Skill[]>()
  const rawSkillRefs: { id: number; slot: string }[] = [...profession.professionSkills]
  if (profession.id === 'Guardian') rawSkillRefs.push(...DRAGONHUNTER_VIRTUE_SKILLS)
  for (const { id, slot } of rawSkillRefs) {
    if (!slot.startsWith('Profession_') || skippedSlots.has(slot) || EXCLUDED_MECHANIC_SKILL_IDS.has(id)) continue
    let skill = skillsById.get(id)
    if (!skill) continue
    const necroShroudSpec = profession.id === 'Necromancer' ? NECRO_SHROUD_SPEC_OVERRIDE[id] : undefined
    if (necroShroudSpec !== undefined) skill = { ...skill, specializationId: necroShroudSpec }
    if (
      profession.id === 'Ranger' &&
      RANGER_BEASTMODE_EXCLUDED_SLOTS.has(slot) &&
      skill.specializationId === RANGER_BEASTMODE_SPEC_ID
    ) {
      continue
    }
    if (!bySlot.has(slot)) {
      bySlot.set(slot, [])
      slotOrder.push(slot)
    }
    bySlot.get(slot)!.push(skill)
  }

  const out: ProfessionMechanicBarEntry[] = []
  for (const slot of slotOrder.sort()) {
    let candidates = bySlot.get(slot)!
    if (profession.id === 'Warrior' && slot === 'Profession_1') {
      candidates = mainHandWeaponType ? candidates.filter((s) => s.weaponType === mainHandWeaponType) : []
    }
    const chosen = resolveMechanicSlot(candidates, equippedSpecializationIds)
    if (!chosen) continue
    if (chosen.specializationId !== null && !equippedSpecializationIds.has(chosen.specializationId)) continue
    out.push({ slot, skill: chosen })
  }
  return out
}

function resolveMechanicSlot(candidates: Skill[], equippedSpecializationIds: ReadonlySet<number>): Skill | undefined {
  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]

  const specMatched = candidates.filter((s) => s.specializationId !== null && equippedSpecializationIds.has(s.specializationId))
  let remaining = specMatched.length > 0 ? specMatched : candidates.filter((s) => s.specializationId === null)
  if (remaining.length === 0) remaining = candidates
  if (remaining.length === 1) return remaining[0]

  const targetIds = new Set(remaining.map((s) => s.flipSkill).filter((id): id is number => id !== null))
  const notAFlipTarget = remaining.filter((s) => !targetIds.has(s.id))
  if (notAFlipTarget.length === 1) return notAFlipTarget[0]
  remaining = notAFlipTarget.length > 0 ? notAFlipTarget : remaining

  const entryPoints = remaining.filter((s) => s.flipSkill !== null)
  if (entryPoints.length === 1) return entryPoints[0]
  remaining = entryPoints.length > 0 ? entryPoints : remaining

  return [...remaining].sort((a, b) => a.id - b.id)[0]
}

/**
 * Engineer's base Toolbelt (F1-F4): NOT enumerable via `Profession.professionSkills` at all — it's
 * generated per equipped Heal/Utility choice rather than fixed per elite spec (confirmed live
 * 2026-07-30: the raw data has no base-Toolbelt ids under `Profession_1`-`_4` whatsoever, only
 * elite-spec sub-mechanics like Photon Forge/Function Gyro/Mech Command, which still go through
 * `professionMechanicBar`'s normal slot resolution for F5). Instead, each Heal/Utility skill's own
 * `Skill.toolbeltSkill` field (the API's `toolbelt_skill`) gives the exact 1:1 link. Elite skills
 * have no toolbelt counterpart (confirmed live), so this only covers F1 (heal) + F2-F4 (the 3
 * utilities).
 */
export function engineerToolbeltBar(build: Build, skillsById: Map<number, Skill>): ProfessionMechanicBarEntry[] {
  if (build.skills.kind !== 'standard') return []
  const out: ProfessionMechanicBarEntry[] = []

  const heal = build.skills.heal !== null ? skillsById.get(build.skills.heal) : undefined
  if (heal?.toolbeltSkill != null) {
    const toolbelt = skillsById.get(heal.toolbeltSkill)
    if (toolbelt) out.push({ slot: 'Profession_1', skill: toolbelt })
  }

  build.skills.utility.forEach((utilityId, i) => {
    const utility = utilityId !== null ? skillsById.get(utilityId) : undefined
    if (utility?.toolbeltSkill != null) {
      const toolbelt = skillsById.get(utility.toolbeltSkill)
      if (toolbelt) out.push({ slot: `Profession_${i + 2}`, skill: toolbelt })
    }
  })

  return out
}

/**
 * Ranger Soulbeast's Beastmode F1-F3, per the currently-active equipped pet: `RANGER_BEASTMODE_
 * EXCLUDED_SLOTS` above deliberately drops every Profession_1-4 candidate whenever it's gated to
 * Soulbeast's specialization id (55), since none of those candidates are a single fixed pick — the
 * real skill depends on which pet is merged with (F1/F2, by the pet's *family*) or its archetype
 * (F3), neither of which `professionMechanicBar`'s per-spec resolver has any way to know. Sourced
 * from `data/game-data/soulbeast-beastmode.json` (see `scripts/fetch-soulbeast-beastmode.ts`),
 * keyed by `Pet.id` rather than by name/family — no per-pet-family concept exists anywhere else in
 * this app, so the wiki-sourced fetch script resolves family/archetype down to a flat per-pet
 * skill triplet once, rather than this function needing to know about families at all.
 */
export function soulbeastBeastmodeBar(build: Build, skillsById: Map<number, Skill>, soulbeastBeastmode: SoulbeastBeastmodeMap): ProfessionMechanicBarEntry[] {
  const activePetId = build.equippedPetIds[build.activePetIndex]
  if (activePetId === null) return []
  const bar = soulbeastBeastmode[activePetId]
  if (!bar) return []

  const out: ProfessionMechanicBarEntry[] = []
  const f1 = skillsById.get(bar.f1SkillId)
  if (f1) out.push({ slot: 'Profession_1', skill: f1 })
  const f2 = skillsById.get(bar.f2SkillId)
  if (f2) out.push({ slot: 'Profession_2', skill: f2 })
  const f3 = skillsById.get(bar.f3SkillId)
  if (f3) out.push({ slot: 'Profession_3', skill: f3 })
  return out
}
