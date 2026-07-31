import type { Environment, ProfessionWeapon, ProfessionWeaponSkillSlot, Skill } from '../types'

const LAND_ONLY_FLAG = 'NoUnderwater'

/**
 * Thief-only, wiki-verified 2026-07-31 (no API field distinguishes these — every candidate is
 * tagged `categories: ["DualWield"]` with no other differentiator): the off-hand weapon type each
 * "Dual Wield" Weapon_3 skill actually requires, or `null` for the weapon's off-hand-agnostic
 * default (the wiki's own "off hand empty" infobox value — used whenever the build's off-hand
 * doesn't match a more specific entry below, including before an off-hand is chosen at all). Keyed
 * by skill id directly rather than by (weapon, off-hand) pair since ids are globally unique, so no
 * profession/weapon-type scoping is needed. See `resolveSkillBarIds`'s hand-context step.
 */
const THIEF_DUAL_WIELD_OFFHAND: Record<number, string | null> = {
  13006: 'Dagger', // Death Blossom (main hand dagger, off hand dagger)
  13040: 'Pistol', // Shadow Shot (main hand dagger, off hand pistol)
  13110: null, // Twisting Fangs (main hand dagger, off hand empty/default)
  71965: 'Pistol', // Orchestrated Assault (main hand axe, off hand pistol)
  71895: null, // Recall Axes (main hand axe, off hand empty/default)
  13011: 'Pistol', // Unload (main hand pistol, off hand pistol)
  13010: 'Dagger', // Shadow Strike (main hand pistol, off hand dagger)
  63254: 'Dagger', // Twilight Combo (main hand scepter, off hand dagger)
  63154: null, // Triple Threat (main hand scepter, off hand empty/default)
  13016: 'Dagger', // Flanking Strike (main hand sword, off hand dagger)
  80244: 'Pistol', // Flawless Execution (main hand sword, off hand pistol)
  13112: null // Stab (main hand sword, off hand empty/default)
}

/**
 * Resolves a `Weapon_1`-`Weapon_5`-slotted skill-id list (a weapon type's own `skills`, or an
 * Engineer Kit's `Skill.bundleSkills` — both use the identical slot-naming/land-underwater-
 * duplication shape) down to one id per slot, scoped to the given environment. Most weapons/kits
 * have exactly one entry per slot (used as-is); the rest resolve via these signals, tried in order
 * per slot until one narrows to a single id:
 *
 * 1. **Flip-target removal**: a candidate that's another same-slot candidate's `flipSkill` target
 *    (e.g. Revenant off-hand Sword's "Duelist's Preparation" (28571) flips to "Shackling Wave"
 *    (28472), both raw candidates for Weapon_4) is never itself the bar's starting skill — dropped
 *    before anything else, same reasoning as `skill-calc/skill-variants.ts`'s flip-root signal.
 * 2. **Land/underwater `NoUnderwater`-flag disambiguation** (e.g. the `Spear` weapon type; every
 *    Engineer Kit, always 10 raw entries — 5 land + 5 underwater): only fires when exactly 2
 *    candidates remain and they cleanly split land-only vs. not.
 * 3. **`specializationId` match against `equippedSpecializationIds`** (e.g. Engineer Sword's two
 *    "Sun Edge" ids — `43476` requires Holosmith, `70514` doesn't; Weaponmaster Training means
 *    Sword is equippable on Engineer with or without Holosmith equipped — see `EquipmentEditor`'s
 *    weapon-type options, no longer elite-spec-gated): prefers spec-matched candidates, falling
 *    back to the spec-less (`specializationId === null`) ones if none match — same rule
 *    `skill-calc/skill-variants.ts`/`skill-calc/profession-mechanic.ts` already use elsewhere.
 * 4. **Thief's `THIEF_DUAL_WIELD_OFFHAND` hand-context table** (`offWeaponType` param): only
 *    applies when every remaining candidate is a key in that table — matches the id whose required
 *    off-hand equals the build's actual paired weapon, falling back to the off-hand-agnostic
 *    default entry if no specific match applies.
 * 5. **`attunement` filtering** (Elementalist only, `attunement` param): applied first, before any
 *    of the above — narrows straight to the candidates tagged for the build's currently-displayed
 *    attunement (every Elementalist weapon-skill candidate carries a non-null `attunement`, unlike
 *    every other profession's, which are all `null`). This alone resolves every non-Weaver-gated
 *    slot to exactly 1. For Weaver's per-slot "Dual Attack" replacements specifically: multiple
 *    Weaver-gated ids can still share one attunement (Weaver's dual-attunement system picks between
 *    them by which *second* attunement is also active, a combat-state axis this app's static
 *    loadout model has no equivalent for — same shape of gap as the Familiar/Legend items before
 *    they got their own modeling pass) — falls through to the deterministic first-candidate
 *    fallback below for that specific case, a documented known limitation, not a silent guess.
 *
 * Remaining ambiguity (only Slick Shoes/Rocket Boots' old-vs-reworked land pair, per TODO.md, plus
 * Weaver's dual-attack sub-choice above) falls back to the first matching entry — a documented
 * known limitation, not a silent guess presented as correct.
 */
export function resolveSkillBarIds(
  candidateSkills: ProfessionWeaponSkillSlot[],
  environment: Environment,
  skillsById: Map<number, Skill>,
  equippedSpecializationIds: ReadonlySet<number> = new Set(),
  offWeaponType?: string | null,
  attunement?: string | null
): (number | null)[] {
  const slots = ['Weapon_1', 'Weapon_2', 'Weapon_3', 'Weapon_4', 'Weapon_5']
  return slots.map((slotName) => {
    let candidates = candidateSkills.filter((s) => s.slot === slotName)
    if (candidates.length === 0) return null

    if (attunement) {
      const attuned = candidates.filter((c) => skillsById.get(c.id)?.attunement === attunement)
      if (attuned.length > 0) candidates = attuned
    }
    if (candidates.length === 1) return candidates[0].id

    const idSet = new Set(candidates.map((c) => c.id))
    const flipTargetIds = new Set(
      candidates
        .map((c) => skillsById.get(c.id)?.flipSkill ?? null)
        .filter((id): id is number => id !== null && idSet.has(id))
    )
    const withoutFlipTargets = candidates.filter((c) => !flipTargetIds.has(c.id))
    if (withoutFlipTargets.length > 0) candidates = withoutFlipTargets
    if (candidates.length === 1) return candidates[0].id

    if (candidates.length === 2) {
      const withFlags = candidates.map((c) => ({ id: c.id, isLandOnly: skillsById.get(c.id)?.flags.includes(LAND_ONLY_FLAG) ?? false }))
      const landOnly = withFlags.filter((c) => c.isLandOnly)
      const notLandOnly = withFlags.filter((c) => !c.isLandOnly)
      if (landOnly.length === 1 && notLandOnly.length === 1) {
        return environment === 'land' ? landOnly[0].id : notLandOnly[0].id
      }
    }

    const specMatched = candidates.filter((c) => {
      const spec = skillsById.get(c.id)?.specializationId ?? null
      return spec !== null && equippedSpecializationIds.has(spec)
    })
    if (specMatched.length > 0) {
      candidates = specMatched
    } else {
      const ungated = candidates.filter((c) => (skillsById.get(c.id)?.specializationId ?? null) === null)
      if (ungated.length > 0) candidates = ungated
    }
    if (candidates.length === 1) return candidates[0].id

    if (offWeaponType !== undefined && candidates.every((c) => c.id in THIEF_DUAL_WIELD_OFFHAND)) {
      const matched = candidates.filter((c) => THIEF_DUAL_WIELD_OFFHAND[c.id] === offWeaponType)
      if (matched.length === 1) return matched[0].id
      if (matched.length === 0) {
        const fallback = candidates.filter((c) => THIEF_DUAL_WIELD_OFFHAND[c.id] === null)
        if (fallback.length === 1) return fallback[0].id
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
 * `mainWeaponType`/`offWeaponType` (bare weapon-type names, e.g. `"Dagger"`) feed
 * `resolveSkillBarIds`'s Thief hand-context signal — each side's resolution needs to know the
 * *other* hand's weapon type, not its own. `attunement` feeds its Elementalist signal (irrelevant,
 * safely ignored via `resolveSkillBarIds`'s own no-op-when-falsy check, for every other profession).
 */
export function weaponSkillIdsForPair(
  mainWeapon: ProfessionWeapon | undefined,
  offWeapon: ProfessionWeapon | undefined,
  environment: Environment,
  skillsById: Map<number, Skill>,
  equippedSpecializationIds: ReadonlySet<number> = new Set(),
  mainWeaponType?: string | null,
  offWeaponType?: string | null,
  attunement?: string | null
): (number | null)[] {
  const mainIds = mainWeapon
    ? resolveSkillBarIds(mainWeapon.skills, environment, skillsById, equippedSpecializationIds, offWeaponType, attunement)
    : [null, null, null, null, null]
  const offIds = offWeapon
    ? resolveSkillBarIds(offWeapon.skills, environment, skillsById, equippedSpecializationIds, mainWeaponType, attunement)
    : [null, null, null, null, null]
  return [mainIds[0], mainIds[1], mainIds[2], offIds[3], offIds[4]]
}
