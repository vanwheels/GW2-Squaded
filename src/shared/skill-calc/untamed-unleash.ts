import type { Environment, ProfessionWeapon, Skill } from '../types'

/** Ranger Untamed's specialization id — see `unleashedWeaponOneId`'s doc comment. */
export const UNTAMED_SPEC_ID = 72

const LAND_ONLY_FLAG = 'NoUnderwater'

/** Every id reachable from `startId` by following `Skill.flipSkill` (e.g. an autoattack chain's
 *  2nd/3rd hit) — used to exclude a weapon's own base autoattack chain from the search for its
 *  Untamed "Unleashed" alternate below, since Hammer's base chain ids also carry
 *  `specializationId === 72` (Hammer itself is Untamed-exclusive) and would otherwise be mistaken
 *  for the alternate. */
function flipChainIds(startId: number, skillsById: Map<number, Skill>): Set<number> {
  const ids = new Set<number>()
  let current: number | null = startId
  while (current !== null && !ids.has(current)) {
    ids.add(current)
    current = skillsById.get(current)?.flipSkill ?? null
  }
  return ids
}

/**
 * Untamed's "Unleashed" state (see `Build.rangerUnleashed`) empowers the Ranger's own weapon
 * autoattack (slot 1) — live-verified 2026-07-30 against the wiki's Unleash Ranger page plus the
 * raw skill data: every Ranger weapon type except Torch/Warhorn (offhand-only, no Weapon_1 at all)
 * has its own `specializationId === 72` alternate Weapon_1 skill (e.g. Hammer's "Hammer Strike" ->
 * "Relentless Whirl", Mace's "Germinate" -> "Rampant Growth"), each carrying real facts distinct
 * from the base autoattack (Relentless Whirl grants Stability, a real boon) — not cosmetic-only,
 * so it matters for the boon/condition calculator, not just display. This corrects an earlier
 * assumption in TODO.md that Untamed's Unleash mechanic replaces the full weapon bar (1-5) the same
 * way Kits/Tomes/Celestial Avatar do — the wiki's own Unleash Ranger/Unleash Pet pages confirm it
 * only swaps slot 1 (the autoattack) plus the pet's F1-F3 commands (already handled elsewhere), not
 * the whole bar.
 *
 * Returns `null` if the given weapon type has no Unleashed alternate (not a Ranger weapon, or one
 * of the 2 offhand-only weapons — Torch/Warhorn — with no Weapon_1/autoattack at all).
 */
export function unleashedWeaponOneId(
  weaponType: string,
  weapon: ProfessionWeapon,
  environment: Environment,
  skillsById: Map<number, Skill>
): number | null {
  const baseIds = weapon.skills.filter((s) => s.slot === 'Weapon_1').map((s) => s.id)
  if (baseIds.length === 0) return null
  const excluded = new Set(baseIds.flatMap((id) => [...flipChainIds(id, skillsById)]))

  const candidates = [...skillsById.values()].filter(
    (s) => s.specializationId === UNTAMED_SPEC_ID && s.slot === 'Weapon_1' && s.weaponType === weaponType && !excluded.has(s.id)
  )
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].id

  const landOnly = candidates.filter((s) => s.flags.includes(LAND_ONLY_FLAG))
  const notLandOnly = candidates.filter((s) => !s.flags.includes(LAND_ONLY_FLAG))
  if (landOnly.length === 1 && notLandOnly.length === 1) {
    return environment === 'land' ? landOnly[0].id : notLandOnly[0].id
  }
  return candidates[0].id
}
