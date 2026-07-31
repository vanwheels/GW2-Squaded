import type { Environment, ProfessionWeapon, ProfessionWeaponSkillSlot, Skill } from '../types'

const LAND_ONLY_FLAG = 'NoUnderwater'

/**
 * Resolves a `Weapon_1`-`Weapon_5`-slotted skill-id list (a weapon type's own `skills`, or an
 * Engineer Kit's `Skill.bundleSkills` — both use the identical slot-naming/land-underwater-
 * duplication shape) down to one id per slot, scoped to the given environment. Most weapons/kits
 * have exactly one entry per slot (used as-is). A few complications exist in the raw
 * `/v2/professions`/`/v2/skills` data that this function deliberately does NOT fully solve:
 *
 * - Land/underwater dual-use weapons/kits (e.g. the `Spear` weapon type; every Engineer Kit, which
 *   the API always lists with 10 entries — 5 land + 5 underwater) have 2 entries for some/every
 *   slot — disambiguated via each candidate skill's own `Skill.flags`: the GW2 API tags a skill's
 *   land variant with `"NoUnderwater"`, so that's the pick for `environment: 'land'` and the other
 *   (non-`NoUnderwater`) candidate is the `'underwater'` pick.
 * - Other duplicate-slot cases exist for unrelated reasons this app doesn't model yet: auto-attack
 *   chain steps sharing one slot label, hand-context variants (e.g. a weapon whose 4th skill
 *   differs when placed main-hand vs. off-hand), and Elementalist's per-attunement skill sets
 *   (up to 26 entries for one weapon type). None of these are recoverable from data this app
 *   fetches today, so they fall back to the first matching entry — a documented known limitation
 *   (see TODO.md), not a silent guess presented as correct.
 */
export function resolveSkillBarIds(
  candidateSkills: ProfessionWeaponSkillSlot[],
  environment: Environment,
  skillsById: Map<number, Skill>
): (number | null)[] {
  const slots = ['Weapon_1', 'Weapon_2', 'Weapon_3', 'Weapon_4', 'Weapon_5']
  return slots.map((slotName) => {
    const candidates = candidateSkills.filter((s) => s.slot === slotName)
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
  const mainIds = mainWeapon ? resolveSkillBarIds(mainWeapon.skills, environment, skillsById) : [null, null, null, null, null]
  const offIds = offWeapon ? resolveSkillBarIds(offWeapon.skills, environment, skillsById) : [null, null, null, null, null]
  return [mainIds[0], mainIds[1], mainIds[2], offIds[3], offIds[4]]
}
