import type { Build, Skill } from '../types'
import type { ProfessionMechanicBarEntry } from './profession-mechanic'

/**
 * Thief's F2 "Stolen Skill": which of these is actually usable depends on who you steal from in a
 * live fight, not on anything in the build (see `EXCLUDED_MECHANIC_SKILL_IDS`'s doc comment in
 * `profession-mechanic.ts` for the live-verified data shape — no per-profession `source` field
 * exists, these are themed by enemy weapon/monster type instead). Since there's no way to derive
 * "the current one" from the build, this app instead lets the user manually pick one to
 * display/calc against (`Build.thiefStolenSkillId`), the same "can't be resolved automatically,
 * so ask the player" shape as `Build.familiarId`.
 *
 * The 19 canonical ids below are every distinct-named `Profession_2` candidate, live-verified
 * 2026-08-01 against `/v2/skills` and deduped from the raw 22: 3 names (Exalted Hammer, Forged
 * Surfer Dash, Throw Gunk) each have a same-named orphan duplicate id with no distinguishing field
 * — same "pre-rework leftover" class as Warrior Spellbreaker's Full Counter ids — the lower id of
 * each pair is kept here, matching this app's existing "keep the lower id" convention for
 * unresolvable duplicates (e.g. `NECRO_SHROUD_SLOT_SKILLS`'s Ritualist dupes). All 22 raw ids
 * (both members of every pair) stay excluded from `professionMechanicBar`'s own generic resolver
 * via `EXCLUDED_MECHANIC_SKILL_IDS` — that resolver has no way to pick one, this manual list is the
 * only place they're offered.
 */
export const THIEF_STOLEN_SKILL_IDS: number[] = [
  76601, // Exalted Hammer
  76550, // Forged Surfer Dash
  76800, // Holo-Dancer Decoy
  76900, // Summon Kryptis Turret
  77288, // Mistburn Mortar
  76895, // Zephyrite Sun Crystal
  1131, // Mace Head Crack
  1118, // Throw Chain
  1162, // Whirling Axe
  1167, // Whirling Strike
  1115, // Branch Leap
  1110, // Throw Gunk
  1139, // Healing Seed
  1125, // Eat Egg
  1148, // Blinding Tuft
  1129, // Ice Shard Stab
  1123, // Consume Plasma
  1141, // Skull Fear
  31438 // Essence Sap
]

/**
 * Thief's F2 mechanic-bar entry for the manually-picked Stolen Skill (`Build.thiefStolenSkillId`)
 * — only meaningful when Specter isn't equipped, since Specter's own F2 "Enter Shadow Shroud"
 * (`SPECTER_MECHANIC_SKILLS` in `profession-mechanic.ts`) already occupies that slot through the
 * generic resolver; callers gate on that themselves (see `ProfessionMechanicBar`), same as every
 * other spec-conditional bar in `profession-mechanic.ts`. Returns empty when no skill is chosen
 * yet, same as `evokerFamiliarBar`.
 */
export function thiefStolenSkillBar(build: Build, skillsById: Map<number, Skill>): ProfessionMechanicBarEntry[] {
  if (build.thiefStolenSkillId === null) return []
  const skill = skillsById.get(build.thiefStolenSkillId)
  if (!skill) return []
  return [{ slot: 'Profession_2', skill }]
}
