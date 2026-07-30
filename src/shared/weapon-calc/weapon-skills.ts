import type { Environment, ProfessionWeapon, Skill } from '../types'

const LAND_ONLY_FLAG = 'NoUnderwater'

/**
 * Resolves one weapon type's skill ids for slots `Weapon_1`-`Weapon_5`, scoped to the given
 * environment. Most weapons have exactly one entry per slot (used as-is). A few complications
 * exist in the raw `/v2/professions` data that this function deliberately does NOT fully solve:
 *
 * - Land/underwater dual-use weapons (only `Spear`, which carries both `TwoHand` and `Aquatic`)
 *   have 2 entries for some slots — disambiguated via each candidate skill's own `Skill.flags`:
 *   the GW2 API tags a skill's land variant with `"NoUnderwater"`, so that's the pick for
 *   `environment: 'land'` and the other (non-`NoUnderwater`) candidate is the `'underwater'` pick.
 * - Other duplicate-slot cases exist for unrelated reasons this app doesn't model yet: auto-attack
 *   chain steps sharing one slot label, hand-context variants (e.g. a weapon whose 4th skill
 *   differs when placed main-hand vs. off-hand), and Elementalist's per-attunement skill sets
 *   (up to 26 entries for one weapon type). None of these are recoverable from data this app
 *   fetches today, so they fall back to the first matching entry — a documented known limitation
 *   (see TODO.md), not a silent guess presented as correct.
 */
export function resolveWeaponSkillIds(
  weapon: ProfessionWeapon,
  environment: Environment,
  skillsById: Map<number, Skill>
): (number | null)[] {
  const slots = ['Weapon_1', 'Weapon_2', 'Weapon_3', 'Weapon_4', 'Weapon_5']
  return slots.map((slotName) => {
    const candidates = weapon.skills.filter((s) => s.slot === slotName)
    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0].id

    if (candidates.length === 2) {
      const withFlags = candidates.map((c) => ({ id: c.id, isLandOnly: skillsById.get(c.id)?.flags.includes(LAND_ONLY_FLAG) ?? false }))
      const landOnly = withFlags.filter((c) => c.isLandOnly)
      const notLandOnly = withFlags.filter((c) => !c.isLandOnly)
      if (landOnly.length === 1 && notLandOnly.length === 1) {
        return environment === 'land' ? landOnly[0].id : notLandOnly[0].id
      }
    }

    return candidates[0].id
  })
}

/**
 * Combines a main-hand weapon's `Weapon_1-3` with an off-hand (or the same two-handed weapon's)
 * `Weapon_4-5` into one 5-slot skill bar — matches how GW2 actually composes a weapon skill bar
 * (main-hand supplies 1-3, off-hand supplies 4-5, a two-handed weapon alone supplies all 5).
 * `offWeapon` should be the same object as `mainWeapon` for a two-handed weapon (mirrored slot).
 */
export function weaponSkillIdsForPair(
  mainWeapon: ProfessionWeapon | undefined,
  offWeapon: ProfessionWeapon | undefined,
  environment: Environment,
  skillsById: Map<number, Skill>
): (number | null)[] {
  const mainIds = mainWeapon ? resolveWeaponSkillIds(mainWeapon, environment, skillsById) : [null, null, null, null, null]
  const offIds = offWeapon ? resolveWeaponSkillIds(offWeapon, environment, skillsById) : [null, null, null, null, null]
  return [mainIds[0], mainIds[1], mainIds[2], offIds[3], offIds[4]]
}
