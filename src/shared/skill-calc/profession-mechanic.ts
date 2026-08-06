import type { Build, Environment, Familiar, Profession, Skill, SoulbeastBeastmodeMap } from '../types'
import { EVOKER_SPECIALIZATION_ID } from './familiar'

/** Same land/underwater disambiguation signal as `weapon-calc/weapon-skills.ts`'s `LAND_ONLY_FLAG`
 *  — Warrior's Burst Skill needs it too now that Spear (Janthir Wilds) is a dual land/underwater
 *  weapon type with separate skill ids per environment for every slot, Profession_1 included. */
const LAND_ONLY_FLAG = 'NoUnderwater'

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
  // Revenant Conduit (spec 79) Profession_2 "Release Potential": resolved 2026-07-31 by
  // `conduitReleasePotentialBar` below instead of the generic per-spec resolver (see that
  // function's doc comment) — the 5 named-variant ids actually reachable via
  // `Profession.professionSkills` (confirmed live; a 6th same-named id, 77896 "Release Potential:
  // Warrior" with no `GroundTargeted` flag, exists in `/v2/skills` but is NOT one of Revenant's
  // `professionSkills` — same class of orphaned pre-rework leftover id as the Warrior Spellbreaker
  // ids above, so 78895, the one the profession's own skill list actually references, is the real
  // one) excluded here so the generic resolver never picks one arbitrarily.
  // `CONDUIT_RELEASE_POTENTIAL_EXCLUDED_SLOTS` below additionally drops the slot's spec-less
  // fallback ("Ancient Echo") whenever Conduit is equipped, so nothing from the generic resolver
  // leaks through before `conduitReleasePotentialBar`'s entry is prepended in `ProfessionMechanicBar.tsx`.
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
  63147, 63344,
  // Elementalist Evoker (spec 80) Profession_5 "Familiar": "Ignite" (76643) is a same-slot,
  // same-spec, no-flip, blank-description orphan sharing an icon file id adjacent to the real
  // Fire familiar skill "Conflagration" (76585) — live-verified 2026-08-01 while wiring up
  // `evokerFamiliarBar` below, same class of pre-rework leftover as the Warrior Spellbreaker ids
  // above. Excluded so it never becomes `evokerFamiliarBar`'s Fire pick or leaks through the
  // generic resolver.
  76643,
  // Thief's Profession_2 "Stolen Skill": live-verified 2026-08-01 all 22 raw candidates carry
  // `specializationId: null` and `categories: []` — no per-profession/per-source tell exists in
  // this dataset (contra this file's own older assumption) — themed instead by enemy weapon/
  // monster type (e.g. "Mace Head Crack", "Whirling Axe", "Skull Fear"); which skill is "live"
  // depends entirely on who you steal from in combat, not on anything in the build. Excluded
  // here (rather than via `SKIPPED_SLOTS`, since Specter's real Profession_2 "Enter Shadow Shroud"
  // below shares this exact slot and must still resolve normally) so the generic resolver's
  // fallback never arbitrarily picks one; surfaced instead by `ThiefStolenSkillPicker`'s own manual
  // build-state field (see `thief-stolen-skill.ts`) for display/calc purposes. 3 pairs
  // (76702/76601 "Exalted Hammer", 76633/76550 "Forged Surfer Dash", 45094/1110 "Throw Gunk") are
  // same-named orphan duplicates within this set, same class as Warrior Spellbreaker's above — both
  // ids of each pair excluded here; the manual picker dedupes to the lower id itself.
  76702, 76601, 76633, 76550, 76800, 76900, 77288, 76895, 1131, 1118, 1162, 1167, 1115, 45094, 1110, 1139, 1125, 1148, 1129, 1123, 1141, 31438,
  // Specter (spec 71) Profession_2 "Exit Shadow Shroud" (63251): the toggled-off/exit half of
  // Shroud's entry pair — live-verified 2026-08-01 neither 63251 nor its entry counterpart 63155
  // "Enter Shadow Shroud" carries a `flipSkill` link to the other (unlike Necromancer's Death
  // Shroud <-> End Death Shroud, which do chain via `flipSkill`), so `resolveMechanicSlot`'s
  // flip-chain dedup step can't tell them apart on its own. Excluded explicitly so only the entry
  // id ever surfaces as Specter's F2 mechanic-bar button, same as every other Shroud variant's
  // entry-only F-bar icon.
  63251
])

/**
 * Specter (specialization id 71): live-verified 2026-08-01 against `/v2/skills` — like Guardian
 * Dragonhunter's virtue rework (`DRAGONHUNTER_VIRTUE_SKILLS` above), Specter's own F1 "Siphon"
 * (63067, replaces "Steal") and F2 "Enter Shadow Shroud" (63155, a Shroud-toggle mirroring
 * Necromancer's — see `SPECTER_SHROUD_SLOT_SKILLS` in `bundle-skills.ts`) exist correctly in
 * `/v2/skills`, correctly tagged `specializationId: 71` and `slot: "Profession_1"`/`"_2"`, but
 * never appear in Thief's `professionSkills` at all — the same real API data gap, not a guess.
 * Hand-injected below so the normal per-slot resolver (spec-match preferred over the null-spec
 * "Steal" fallback) picks them correctly once Specter is equipped; without this, Specter silently
 * shows core Thief's unthemed "Steal" for F1 and drops F2 entirely (its only candidates would be
 * the excluded stolen-skill ids above).
 */
export const SPECTER_SPEC_ID = 71
const SPECTER_MECHANIC_SKILLS: { id: number; slot: string }[] = [
  { id: 63067, slot: 'Profession_1' }, // Siphon
  { id: 63155, slot: 'Profession_2' } // Enter Shadow Shroud
]

/**
 * Vindicator (specialization id 69): live-verified 2026-08-04 against `/v2/skills` — "Alliance
 * Tactics" (62729, description "Swap your Legendary Alliance Stance skills.", correctly tagged
 * `specializationId: 69`/`slot: "Profession_3"`) never appears in Revenant's `professionSkills` at
 * all, the same real API data gap as Dragonhunter's virtues/Specter's mechanics above. Hand-injected
 * so the normal per-slot resolver picks it up whenever Vindicator is equipped; without this,
 * Vindicator's F3 slot (Profession_3 has no other Revenant candidate at all — unlike Conduit's
 * Cosmic Wisdom, which shares that slot) is simply omitted. `ProfessionMechanicBar` wires this
 * specific id to toggle `Build.vindicatorAspectFlipped` (see `vindicator-aspect.ts`) rather than
 * treating it as read-only, the same "clickable, not disabled" treatment as a Kit/Tome/Celestial
 * Avatar's `activeBundleSkillId` toggle.
 */
export const ALLIANCE_TACTICS_SKILL_ID = 62729
const VINDICATOR_MECHANIC_SKILLS: { id: number; slot: string }[] = [{ id: ALLIANCE_TACTICS_SKILL_ID, slot: 'Profession_3' }]

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
 * Revenant Conduit (specialization id 79): live-verified against the wiki 2026-07-31 — Conduit's
 * Profession_2 "Release Potential" isn't a fixed per-spec pick like every other elite spec's F2
 * (contra this file's earlier assumption, see `EXCLUDED_MECHANIC_SKILL_IDS`'s old comment). The
 * wiki (wiki.guildwars2.com/wiki/Cosmic_Wisdom, /wiki/Release_Potential) confirms both Profession_2
 * "Release Potential" and Profession_3 "Cosmic Wisdom" change effect based on which Legend is
 * *currently active* (swappable mid-fight, unlike a normal per-spec F-button) — Razah himself
 * channels 5 GW1-profession "forms" (Assassin/Monk/Mesmer/Warrior/Dervish), one per Legend. Cosmic
 * Wisdom stays a single id regardless (its effect differs in-game but the API only exposes one
 * skill id/icon for it, so the generic resolver already handles Profession_3 correctly unmodified);
 * Release Potential has 5 differently-named ids with no spec-based way to pick between them, so
 * this slot is dropped from the generic resolver's own per-spec logic (see
 * `CONDUIT_RELEASE_POTENTIAL_EXCLUDED_SLOTS` below) and resolved instead by
 * `conduitReleasePotentialBar`, keyed off `Build`'s actual active Legend.
 *
 * Since Conduit occupies the elite-spec trait line itself, only the 4 core Legends (Assassin/Dwarf
 * /Demon/Centaur) or Razah's own Legendary Entity Stance can ever be equipped alongside it — Dragon
 * /Renegade/Alliance each require a *different* elite spec's line — which maps 1:1 onto the wiki's
 * 5 documented "forms" with none left over:
 *   Legend2 (Legendary Assassin Stance)  -> Form of the Assassin -> "Release Potential: Assassin" (78845)
 *   Legend3 (Legendary Dwarf Stance)     -> Form of the Warrior  -> "Release Potential: Warrior"  (78895)
 *   Legend4 (Legendary Demon Stance)     -> Form of the Mesmer   -> "Release Potential: Mesmer"   (78615)
 *   Legend6 (Legendary Centaur Stance)   -> Form of the Monk     -> "Release Potential: Monk"     (78501)
 *   Legend8 (Legendary Entity Stance)    -> Form of the Dervish  -> "Release Potential: Dervish"  (78661)
 * "Release Potential: Warrior" has a same-named orphaned id (77896, not in `professionSkills` at
 * all — see `EXCLUDED_MECHANIC_SKILL_IDS`'s comment above) — 78895 is the real one; every other
 * variant has exactly one raw id.
 */
export const CONDUIT_SPEC_ID = 79
const CONDUIT_RELEASE_POTENTIAL_EXCLUDED_SLOTS = new Set(['Profession_2'])
const CONDUIT_RELEASE_POTENTIAL_BY_LEGEND: Record<string, number> = {
  Legend2: 78845,
  Legend3: 78895,
  Legend4: 78615,
  Legend6: 78501,
  Legend8: 78661
}

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

/**
 * Elementalist Tempest (specialization id 48): live-verified 2026-08-01 Tempest doesn't rework the
 * F1-F4 Attunement-swap ids at all — it keeps the base 4 (5492-5495, same as every other
 * Elementalist form) but changes their *effect* to an Overload while the button is held. Each base
 * id's own `flipSkill` field already points at the matching "Overload Fire/Water/Air/Earth" id
 * (5492 "Fire Attunement" -> 29706 "Overload Fire", etc.) — same field `resolveMechanicSlot` uses
 * elsewhere to find flip-chain entry points, reused here as a plain lookup instead: once the
 * generic per-slot resolver picks the base Attunement id, swap it for its flip target's skill
 * whenever Tempest is equipped, for icon/tooltip purposes only.
 */
export const TEMPEST_SPEC_ID = 48

/**
 * Maps the profession-mechanic bar's fixed F1-F4 slots to the Attunement each one swaps to, true
 * for every Elementalist form (base game, Tempest, Catalyst, Weaver, Evoker, ...) — F1-F4 always
 * resolves to the base Fire/Water/Air/Earth Attunement ids (5492-5495) in this exact slot order
 * (see `EXCLUDED_MECHANIC_SKILL_IDS`'s Evoker-elite-spec-rework-exclusion comment above); Tempest's
 * own Overload swap just above only changes the displayed icon/tooltip, never which slot maps to
 * which Attunement. `ProfessionMechanicBar.tsx` uses this to know which `Build.activeAttunement`
 * value clicking a given F-bar entry should set — replacing the old dedicated attunement-toggle row
 * above the whole bar, since the two did the exact same thing (confirmed 2026-08-05).
 */
export const ELEMENTALIST_ATTUNEMENT_SLOTS: Record<string, 'Fire' | 'Water' | 'Air' | 'Earth'> = {
  Profession_1: 'Fire',
  Profession_2: 'Water',
  Profession_3: 'Air',
  Profession_4: 'Earth'
}

/**
 * Elementalist Catalyst (specialization id 67): live-verified 2026-08-01 Catalyst's Profession_5
 * "Deploy Jade Sphere" isn't a single fixed id the way a normal per-spec F5 is — the API returns
 * ~24 raw candidates for the slot, an older set of 3 ids per attunement (a clean
 * `GroundTargeted`+`NoUnderwater`-flagged land version, a `GroundTargeted`-only version, and a
 * flagless version, with no further tell to pick between them) plus a newer set of 2
 * *completely* identical-looking ids per attunement (same icon, same flags, same everything but
 * the id — same shape of orphaned-duplicate gap as Engineer Scrapper's Function Gyro above).
 * Resolved instead by `catalystJadeSphereBar` below: filtered to the land, ground-targeted variant
 * (the version this app's environment-agnostic F-bar should represent — `WeaponSkillBar`'s own
 * Land/Underwater toggle already covers underwater separately) tagged for the build's
 * currently-active attunement, then the highest remaining id as a best-effort "most recent" pick
 * (same tie-break Function Gyro uses) — no hardcoded per-attunement id table needed, unlike
 * Conduit's Release Potential, since `attunement` plus the flag pair narrow cleanly on their own.
 * Excluded from the generic resolver's own per-slot logic whenever Catalyst is equipped (same
 * reasoning as `CONDUIT_RELEASE_POTENTIAL_EXCLUDED_SLOTS`) so nothing arbitrary leaks through
 * before `catalystJadeSphereBar`'s entry is appended in `ProfessionMechanicBar.tsx` (appended, not
 * prepended like Conduit's F2 — F5 is the last slot, and prepending would visually place it before
 * F1-F4).
 */
export const CATALYST_SPEC_ID = 67
const CATALYST_JADE_SPHERE_EXCLUDED_SLOTS = new Set(['Profession_5'])

/**
 * Elementalist Evoker's Profession_5 "Familiar" (specialization id 80, `EVOKER_SPECIALIZATION_ID`
 * from `familiar.ts`): live-verified 2026-08-01 against the 5 raw Profession_5 candidates tagged
 * spec 80 — 4 differently-named, distinctly-described skills each naming one of the 4 familiars in
 * their own description ("Summon the fox..."/"...the otter..."/"...the hare..."/"...the toad..."),
 * plus "Ignite" (76643, excluded above, a blank-description orphan). Keyed here by the familiar's
 * `element` field (already how `data/game-data/familiars.json` ties a familiar to an attunement)
 * rather than by familiar id directly, so `evokerFamiliarBar` just needs the build's chosen
 * familiar's `element` to look up the right skill — no separate per-familiar-id table. Excluded
 * from the generic resolver's own per-slot logic whenever Evoker is equipped, same reasoning as
 * Catalyst above (5 same-spec candidates would otherwise resolve arbitrarily via the lowest-id
 * fallback, never actually reflecting the chosen familiar).
 */
const EVOKER_FAMILIAR_EXCLUDED_SLOTS = new Set(['Profession_5'])
const EVOKER_FAMILIAR_SKILL_BY_ELEMENT: Record<string, number> = {
  Fire: 76585, // Conflagration (fox)
  Water: 76811, // Buoyant Deluge (otter)
  Air: 77089, // Lightning Blitz (hare)
  Earth: 76707 // Seismic Impact (toad)
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
 *    that constant's doc comment).
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
  environment: Environment = 'land',
  mainHandWeaponType?: string | null
): ProfessionMechanicBarEntry[] {
  const slotOrder: string[] = []
  const bySlot = new Map<string, Skill[]>()
  const rawSkillRefs: { id: number; slot: string }[] = [...profession.professionSkills]
  if (profession.id === 'Guardian') rawSkillRefs.push(...DRAGONHUNTER_VIRTUE_SKILLS)
  if (profession.id === 'Thief') rawSkillRefs.push(...SPECTER_MECHANIC_SKILLS)
  if (profession.id === 'Revenant') rawSkillRefs.push(...VINDICATOR_MECHANIC_SKILLS)
  for (const { id, slot } of rawSkillRefs) {
    if (!slot.startsWith('Profession_') || EXCLUDED_MECHANIC_SKILL_IDS.has(id)) continue
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
    if (
      profession.id === 'Revenant' &&
      CONDUIT_RELEASE_POTENTIAL_EXCLUDED_SLOTS.has(slot) &&
      equippedSpecializationIds.has(CONDUIT_SPEC_ID)
    ) {
      continue
    }
    if (
      profession.id === 'Elementalist' &&
      CATALYST_JADE_SPHERE_EXCLUDED_SLOTS.has(slot) &&
      equippedSpecializationIds.has(CATALYST_SPEC_ID)
    ) {
      continue
    }
    if (
      profession.id === 'Elementalist' &&
      EVOKER_FAMILIAR_EXCLUDED_SLOTS.has(slot) &&
      equippedSpecializationIds.has(EVOKER_SPECIALIZATION_ID)
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
      // Burst Skill candidates carry a real weaponType and vary by equipped main-hand weapon;
      // Bladesworn's Gunsaber toggle ("Unsheathe Gunsaber", weaponType "None") doesn't — it's an
      // innate, weapon-independent button, so it must survive this filter regardless of what's
      // equipped (or if nothing is), unlike every other Profession_1 candidate here.
      candidates = candidates.filter((s) => s.weaponType === null || s.weaponType === 'None' || s.weaponType === mainHandWeaponType)
      // Spear (Janthir Wilds) is the one weaponType with both a land and an underwater Burst Skill
      // id, same `NoUnderwater`-flag land/underwater split `weapon-skills.ts` uses for the weapon
      // bar itself — but unlike a normal weapon slot, Warrior's Profession_1 has a SEPARATE
      // land/underwater pair per spec that can override it (Berserker: Wild Throw/Wild Whirl,
      // specId 18; Spellbreaker: its own Harrier's Toss/Whirling Strike ids, specId 61; core:
      // specId null), so the split has to be resolved independently within each spec's own
      // candidates, not across the whole weapon-matched set (an id from one spec's pair is never a
      // valid stand-in for another spec's). The null-spec land side also carries 4 duplicate
      // "Harrier's Toss" ids (same shape as this file's other known-duplicate-id cases) — sorting
      // by id and taking the lowest collapses that before pairing, so it doesn't stop the pairing
      // from being clean 1-vs-1.
      const weaponMatched = candidates.filter((s) => s.weaponType === mainHandWeaponType)
      const bySpec = new Map<number | null, Skill[]>()
      for (const s of weaponMatched) {
        if (!bySpec.has(s.specializationId)) bySpec.set(s.specializationId, [])
        bySpec.get(s.specializationId)!.push(s)
      }
      const resolvedWeaponMatched: Skill[] = []
      for (const group of bySpec.values()) {
        const landOnly = group.filter((s) => s.flags.includes(LAND_ONLY_FLAG)).sort((a, b) => a.id - b.id)
        const notLandOnly = group.filter((s) => !s.flags.includes(LAND_ONLY_FLAG)).sort((a, b) => a.id - b.id)
        if (landOnly.length > 0 && notLandOnly.length > 0) {
          resolvedWeaponMatched.push(environment === 'land' ? landOnly[0] : notLandOnly[0])
        } else {
          resolvedWeaponMatched.push(...group)
        }
      }
      candidates = candidates.filter((s) => s.weaponType !== mainHandWeaponType).concat(resolvedWeaponMatched)
    }
    let chosen = resolveMechanicSlot(candidates, equippedSpecializationIds)
    if (!chosen) continue
    if (chosen.specializationId !== null && !equippedSpecializationIds.has(chosen.specializationId)) continue
    if (profession.id === 'Elementalist' && equippedSpecializationIds.has(TEMPEST_SPEC_ID) && chosen.flipSkill !== null) {
      const overload = skillsById.get(chosen.flipSkill)
      if (overload) chosen = overload
    }
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

/**
 * Revenant Conduit's Release Potential (F2), per the currently-active equipped Legend — see
 * `CONDUIT_RELEASE_POTENTIAL_BY_LEGEND` above for why this is a fixed 5-Legend mapping rather than
 * something derivable from `Skill.specializationId`. Mirrors `soulbeastBeastmodeBar`'s "read the
 * build's own active-index field, since the generic resolver has no way to know it" shape; also
 * mirrors `RevenantSkillsEditor`'s own active-legend skill bar (`SkillsEditor.tsx`), which already
 * reads `build.skills.legends[build.skills.activeLegendIndex]` the same way for Heal/Utility/Elite
 * display — display-only, same as that bar (see `RevenantSkillSelection.activeLegendIndex`'s own
 * doc comment for why this doesn't feed boon/condition totals).
 */
export function conduitReleasePotentialBar(build: Build, skillsById: Map<number, Skill>): ProfessionMechanicBarEntry[] {
  if (build.skills.kind !== 'revenant') return []
  const activeLegendId = build.skills.legends[build.skills.activeLegendIndex]
  if (activeLegendId === null) return []
  const skillId = CONDUIT_RELEASE_POTENTIAL_BY_LEGEND[activeLegendId]
  if (skillId === undefined) return []
  const skill = skillsById.get(skillId)
  if (!skill) return []
  return [{ slot: 'Profession_2', skill }]
}

/**
 * Elementalist Catalyst's Deploy Jade Sphere (F5), per the build's currently-displayed attunement
 * — see `CATALYST_SPEC_ID`'s doc comment above for why the candidate set needs the flag+attunement
 * filter rather than a fixed id table. Reads `Profession.professionSkills` itself (unlike
 * `soulbeastBeastmodeBar`/`conduitReleasePotentialBar`, which read a build-state field or a
 * side-table) since there's no simpler signal than the raw candidate list to filter down.
 */
export function catalystJadeSphereBar(build: Build, profession: Profession, skillsById: Map<number, Skill>): ProfessionMechanicBarEntry[] {
  const candidates = profession.professionSkills
    .filter((r) => r.slot === 'Profession_5')
    .map((r) => skillsById.get(r.id))
    .filter(
      (s): s is Skill =>
        s !== undefined &&
        s.specializationId === CATALYST_SPEC_ID &&
        s.attunement === build.activeAttunement &&
        s.flags.includes('GroundTargeted') &&
        s.flags.includes('NoUnderwater')
    )
  if (candidates.length === 0) return []
  const chosen = candidates.reduce((a, b) => (b.id > a.id ? b : a))
  return [{ slot: 'Profession_5', skill: chosen }]
}

/**
 * Elementalist Evoker's Familiar (F5), per the build's currently-chosen familiar
 * (`Build.familiarId`) — see `EVOKER_FAMILIAR_SKILL_BY_ELEMENT`'s doc comment above. Returns empty
 * (slot omitted entirely) when no familiar is chosen yet, same as every other bar here that reads
 * an unset build-state field.
 */
export function evokerFamiliarBar(build: Build, skillsById: Map<number, Skill>, familiars: Familiar[]): ProfessionMechanicBarEntry[] {
  if (build.familiarId === null) return []
  const familiar = familiars.find((f) => f.id === build.familiarId)
  if (!familiar) return []
  const skillId = EVOKER_FAMILIAR_SKILL_BY_ELEMENT[familiar.element]
  if (skillId === undefined) return []
  const skill = skillsById.get(skillId)
  if (!skill) return []
  return [{ slot: 'Profession_5', skill }]
}
