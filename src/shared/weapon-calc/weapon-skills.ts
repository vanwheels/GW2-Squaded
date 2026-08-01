import type { Environment, ProfessionWeapon, ProfessionWeaponSkillSlot, Skill } from '../types'

const LAND_ONLY_FLAG = 'NoUnderwater'

/**
 * Elementalist-only, live-API-verified 2026-08-01 while chasing the "Staff skill 4-5 stuck" bug
 * (TODO.md): every Weapon_4/Weapon_5 candidate for every Elementalist weapon (Dagger, Focus,
 * Hammer, Spear, Staff, Trident, Warhorn — every weapon type with off-hand or two-handed slots
 * 4-5) comes back from `/v2/skills` with `attunement: null` and `specialization: 56` (Weaver),
 * even for skills that need no elite spec at all (e.g. "Ride the Lightning", core off-hand Dagger
 * since launch). Root cause of the bug: with `attunement` null, `resolveSkillBarIds`'s attunement
 * filter matches nothing and silently no-ops, so resolution falls all the way through to the
 * final `candidates[0]` fallback — always the same fixed skill regardless of the build's active
 * attunement OR equipped specialization, which reads as "stuck" (worse than Weaver-specific: this
 * hits every Elementalist form, Weaver equipped or not, once a Weapon_4/5-bearing weapon is
 * equipped). Hand-patches the correct attunement per id (wiki/name-verified, e.g. Meteor
 * Shower/Healing Rain/Static Field/Shock Wave are Staff's iconic Fire/Water/Air/Earth skill 5s) so
 * the attunement filter narrows to exactly 1 before ever reaching the spec-match step — the
 * `specialization: 56` mistag is never consulted once that happens, so it's left as-is rather than
 * also overridden.
 */
const ELEMENTALIST_WEAPON_4_5_ATTUNEMENT: Record<number, string> = {
  // Dagger (off-hand)
  5691: 'Fire', // Ring of Fire
  5520: 'Water', // Frost Aura
  5529: 'Air', // Ride the Lightning
  5690: 'Earth', // Earthquake
  5557: 'Fire', // Fire Grab
  5558: 'Water', // Cleansing Wave
  5687: 'Air', // Updraft
  5522: 'Earth', // Churning Earth
  // Focus
  5497: 'Fire', // Flamewall
  5556: 'Water', // Freezing Gust
  5530: 'Air', // Swirling Winds
  5555: 'Earth', // Magnetic Wave
  5678: 'Fire', // Fire Shield
  5490: 'Water', // Comet
  5562: 'Air', // Gale
  5521: 'Earth', // Obsidian Flesh
  // Hammer (Catalyst)
  62807: 'Fire', // Triple Sear
  62948: 'Water', // Crashing Font
  62947: 'Air', // Wind Storm
  62992: 'Earth', // Immutable Stone
  62910: 'Fire', // Molten End
  62843: 'Water', // Cleansing Typhoon
  62716: 'Air', // Shock Blast
  62778: 'Earth', // Ground Pound
  // Spear
  72988: 'Fire', // Meteor
  73148: 'Water', // Undertow
  72998: 'Air', // Twister
  73010: 'Earth', // Fissure
  73054: 'Fire', // Etching: Volcano
  72982: 'Water', // Etching: Jökulhlaup
  72915: 'Air', // Etching: Derecho
  72900: 'Earth', // Etching: Haboob
  // Staff
  5680: 'Fire', // Burning Retreat
  5515: 'Water', // Frozen Ground
  5682: 'Air', // Windborne Speed
  5683: 'Earth', // Unsteady Ground
  5501: 'Fire', // Meteor Shower
  5551: 'Water', // Healing Rain
  5671: 'Air', // Static Field
  5686: 'Earth', // Shock Wave
  // Trident
  5599: 'Fire', // Lava Chains
  5748: 'Water', // Undercurrent
  5648: 'Air', // Air Bubble
  5659: 'Earth', // Rock Anchor
  5600: 'Fire', // Heat Wave
  5607: 'Water', // Tidal Wave
  5650: 'Air', // Lightning Cage
  5661: 'Earth', // Murky Water
  // Warhorn
  29548: 'Fire', // Heat Sync
  30864: 'Water', // Tidal Surge
  30008: 'Air', // Cyclone
  29453: 'Earth', // Sand Squall
  29533: 'Fire', // Wildfire
  30446: 'Water', // Water Globe
  30795: 'Air', // Lightning Orb
  30336: 'Earth' // Dust Storm
}

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
 *    attunement. Every Elementalist weapon-skill candidate carries a non-null `attunement` from the
 *    API *except* every weapon's Weapon_4/Weapon_5 candidates, which come back `attunement: null`
 *    live (see `ELEMENTALIST_WEAPON_4_5_ATTUNEMENT` above for the hand-verified per-id patch this
 *    step also consults) — without that patch this signal silently no-ops for slots 4-5 on every
 *    weapon, not just Weaver's, and resolution falls all the way to the `candidates[0]` fallback
 *    below, always the same fixed skill regardless of attunement (the original shape of the "Staff
 *    skill 4-5 stuck" bug in TODO.md). With the patch, this alone resolves every non-Weaver-gated
 *    slot to exactly 1. For Weaver's per-slot "Dual Attack" replacements specifically (Weapon_3
 *    only): multiple Weaver-gated ids can still share one attunement (Weaver's dual-attunement
 *    system picks between them by which *second* attunement is also active, a combat-state axis
 *    this app's static loadout model has no equivalent for — same shape of gap as the
 *    Familiar/Legend items before they got their own modeling pass) — falls through to the
 *    deterministic first-candidate fallback below for that specific case, a documented known
 *    limitation, not a silent guess.
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
      const attuned = candidates.filter(
        (c) => (skillsById.get(c.id)?.attunement ?? ELEMENTALIST_WEAPON_4_5_ATTUNEMENT[c.id]) === attunement
      )
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
