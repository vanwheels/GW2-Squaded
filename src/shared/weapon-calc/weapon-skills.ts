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
 * Raw candidate skill ids that are retired/historical content the live API still returns for a
 * weapon slot alongside its current replacement — flagged 2026-08-19 by the user ("rev sword 4 is
 * displaying a flip skill for a skill that doesn't exist, it should just be Shackling Wave").
 *
 * Revenant off-hand Sword's "Duelist's Preparation" (28571): per the wiki, this skill "has been
 * removed from the game as of November 7, 2017" — its November 2017 rework replaced the whole
 * block/flip pair with Shackling Wave (28472) standing alone as skill 4. The API still returns
 * 28571 as a Weapon_4 candidate, still carrying its old `flipSkill: 28472` pointer (and a bogus
 * leftover `specializationId: 61`, Warrior's Spellbreaker — further evidence this id is stale,
 * unmaintained data, not live content). Left in raw candidates, `resolveSkillBarIds`'s own
 * flip-target-removal step (see its doc comment, signal 1) reads that stale pointer backwards: it
 * assumes a flip TARGET is never the bar's real starting skill, so it drops Shackling Wave (28472)
 * and keeps the retired Duelist's Preparation as the base — the opposite of today's actual skill 4,
 * with a "flip" to a skill (Shackling Wave, correctly) that no longer exists as a preceding step in
 * live content. Filtering 28571 out before any other signal runs leaves Shackling Wave as the sole
 * Weapon_4 candidate, standalone with no flip stack — matching the current live tooltip.
 */
const RETIRED_WEAPON_SKILL_IDS: ReadonlySet<number> = new Set([
  28571 // Duelist's Preparation (Revenant off-hand Sword 4) — removed from the game 2017-11-07
])

/**
 * Elementalist Weaver (specialization id 56). Weaver tracks two simultaneously-active attunements
 * — "current" (`Build.activeAttunement`, main-hand, weapon skills 1-2) and "previous"
 * (`Build.weaverPreviousAttunement`, off-hand, weapon skills 4-5) — and weapon skill 3 depends on
 * *both* (wiki: "Dual Attack", order-independent — Fire+Water and Water+Fire are the same skill;
 * attuning to the same element twice, e.g. Fire+Fire, gives the normal single-attunement skill 3).
 */
export const WEAVER_SPEC_ID = 56

/** Fire > Water > Air > Earth — matches the priority order the GW2 API itself uses when tagging a
 *  Dual Attack skill's single `attunement` field (see `WEAVER_WEAPON_3_SKILLS`'s doc comment) and
 *  `ELEMENTALIST_ATTUNEMENT_SLOTS`'/`ELEMENTALIST_ATTUNEMENTS`' existing F1-F4 ordering. Used only
 *  to canonicalize an unordered attunement pair into one lookup-table key. */
const WEAVER_ATTUNEMENT_PRIORITY: Record<string, number> = { Fire: 0, Water: 1, Air: 2, Earth: 3 }

/**
 * Weaver's weapon-skill-3 "Dual Attack" table — hand-verified 2026-08-06 against the wiki's own
 * Dual Attack skill list, cross-referenced to real ids via `data/game-data/skills.json`/
 * `professions.json` (not guessed). Resolves the exact ambiguity `resolveSkillBarIds`'s doc comment
 * above flags as unresolved: every weapon's raw Weapon_3 pool has up to 6 ids sharing
 * `specializationId: 56` and, per the API's own priority-order tagging convention, up to 3 of them
 * sharing the same single `attunement` value (e.g. Dagger's "Steam Surge"/"Plasma Burst"/"Ashen
 * Blast" are all tagged `Fire`, being Fire+Water/Fire+Air/Fire+Earth respectively) — no raw field
 * distinguishes the *second* attunement, so the actual combo has to be hand-matched by name against
 * the wiki instead.
 *
 * Covers every weapon with a Weapon_3 slot Weaver can wield — not just Weaver's own weapons
 * (Dagger/Focus/Scepter/Staff/Sword/Warhorn) but also Hammer/Pistol/Spear/Trident, reachable via
 * Weaponmaster Training; confirmed each still carries its own full 6-combo Dual Attack set. Both the
 * 6 genuine dual (differing-element) combos *and* the 4 same-element ones are listed explicitly
 * (rather than leaving same-element to fall through to the generic resolver) because that resolver's
 * `specializationId`-match step actively picks the *wrong* id once Weaver's spec id is in
 * `equippedSpecializationIds`: it prefers any spec-56 candidate over the true single-attunement
 * default, even for a same-element pair, since 2-3 spec-56 Dual Attack ids usually share that
 * pair's attunement tag too. Same-element ids are the plain pre-existing single-attunement skill for
 * every weapon except Sword (Weaver-exclusive, no non-Weaver form, so its 4 same-element ids are
 * themselves spec-56) and Hammer (shares Catalyst's spec-67-tagged single-attunement set — verified
 * these aren't Weaver-gated in-game, just tagged with the spec that "owns" Hammer's kit).
 *
 * Keyed `${weaponType}|${higherPriorityAttunement}+${lowerPriorityAttunement}` (see
 * `WEAVER_ATTUNEMENT_PRIORITY`) so the two orderings of a differing-element pair collapse to one
 * entry, matching the wiki's stated order-independence.
 */
const WEAVER_WEAPON_3_SKILLS: Record<string, number> = {
  // Dagger
  'Dagger|Fire+Water': 42330, // Steam Surge
  'Dagger|Fire+Air': 44652, // Plasma Burst
  'Dagger|Fire+Earth': 42379, // Ashen Blast
  'Dagger|Water+Air': 46140, // Katabatic Wind
  'Dagger|Water+Earth': 46018, // Mud Slide
  'Dagger|Air+Earth': 40963, // Grinding Stones
  'Dagger|Fire+Fire': 5644, // Burning Speed
  'Dagger|Water+Water': 5487, // Frozen Burst
  'Dagger|Air+Air': 5527, // Shocking Aura
  'Dagger|Earth+Earth': 5559, // Earthen Rush
  // Staff
  'Staff|Fire+Water': 40332, // Pressure Blast
  'Staff|Fire+Air': 41125, // Plasma Blast
  'Staff|Fire+Earth': 43762, // Pyroclastic Blast
  'Staff|Water+Air': 41184, // Monsoon
  'Staff|Water+Earth': 44550, // Lahar
  'Staff|Air+Earth': 42321, // Pile Driver
  'Staff|Fire+Fire': 5679, // Flame Burst
  'Staff|Water+Water': 5681, // Geyser
  'Staff|Air+Air': 5553, // Gust
  'Staff|Earth+Earth': 5685, // Magnetic Aura
  // Scepter
  'Scepter|Fire+Water': 42181, // Fiery Frost
  'Scepter|Fire+Air': 43576, // Plasma Beam
  'Scepter|Fire+Earth': 42954, // Fracturing Strike
  'Scepter|Water+Air': 45742, // Glacial Drift
  'Scepter|Water+Earth': 46014, // Stone Tide
  'Scepter|Air+Earth': 40794, // Earthen Synergy
  'Scepter|Fire+Fire': 5675, // Phoenix
  'Scepter|Water+Water': 5510, // Water Trident
  'Scepter|Air+Air': 5694, // Blinding Flash
  'Scepter|Earth+Earth': 5696, // Dust Devil
  // Sword
  'Sword|Fire+Water': 42271, // Twin Strike
  'Sword|Fire+Air': 43074, // Pyro Vortex
  'Sword|Fire+Earth': 46447, // Lava Skin
  'Sword|Water+Air': 42867, // Shearing Edge
  'Sword|Water+Earth': 40170, // Natural Frenzy
  'Sword|Air+Earth': 46295, // Gale Strike
  'Sword|Fire+Fire': 44451, // Cauterizing Strike
  'Sword|Water+Water': 41167, // Aqua Siphon
  'Sword|Air+Air': 43803, // Quantum Strike
  'Sword|Earth+Earth': 40139, // Rust Frenzy
  // Hammer
  'Hammer|Fire+Water': 69184, // Dual Orbits: Fire and Water
  'Hammer|Fire+Air': 69341, // Dual Orbits: Fire and Air
  'Hammer|Fire+Earth': 69164, // Dual Orbits: Fire and Earth
  'Hammer|Water+Air': 69211, // Dual Orbits: Water and Air
  'Hammer|Water+Earth': 69413, // Dual Orbits: Water and Earth
  'Hammer|Air+Earth': 69246, // Dual Orbits: Air and Earth
  'Hammer|Fire+Fire': 62758, // Flame Wheel
  'Hammer|Water+Water': 62834, // Icy Coil
  'Hammer|Air+Air': 62887, // Crescent Wind
  'Hammer|Earth+Earth': 62975, // Rocky Loop
  // Pistol
  'Pistol|Fire+Water': 71863, // Frostfire Flurry
  'Pistol|Fire+Air': 71898, // Purblinding Plasma
  'Pistol|Fire+Earth': 71993, // Molten Meteor
  'Pistol|Water+Air': 71960, // Flowing Finesse
  'Pistol|Water+Earth': 72062, // Echoing Erosion
  'Pistol|Air+Earth': 72023, // Enervating Earth
  'Pistol|Fire+Fire': 71940, // Searing Salvo
  'Pistol|Water+Water': 71935, // Frozen Fusillade
  'Pistol|Air+Air': 71857, // Aerial Agility
  'Pistol|Earth+Earth': 71842, // Boulder Blast
  // Spear
  'Spear|Fire+Water': 72916, // Frostfire Ward
  'Spear|Fire+Air': 73104, // Galvanize
  'Spear|Fire+Earth': 72914, // Fiery Impact
  'Spear|Water+Air': 73052, // Elutriate
  'Spear|Water+Earth': 73062, // Soothing Burst
  'Spear|Air+Earth': 72906, // Shale Storm
  'Spear|Fire+Fire': 73137, // Seethe
  'Spear|Water+Water': 72967, // Ripple
  'Spear|Air+Air': 73037, // Energize
  'Spear|Earth+Earth': 73019, // Harden
  // Trident
  'Trident|Fire+Water': 40378, // Hydrothermal Vent
  'Trident|Fire+Air': 41712, // Plasmic Strike
  'Trident|Fire+Earth': 46185, // Molten Burst
  'Trident|Water+Air': 46360, // Absolute Zero
  'Trident|Water+Earth': 41001, // Elemental Compression
  'Trident|Air+Earth': 39981, // Sodden Swath
  'Trident|Fire+Fire': 5566, // Steam
  'Trident|Water+Water': 5606, // Ice Wall
  'Trident|Air+Air': 5652, // Air Pocket
  'Trident|Earth+Earth': 5662 // Magnetic Current
}

/**
 * Looks up Weaver's weapon-skill-3 "Dual Attack" (or same-element default) id for a given weapon
 * type and current+previous attunement pair — see `WEAVER_WEAPON_3_SKILLS`. Order-independent (the
 * pair is canonicalized before lookup). Returns `null` for a weapon type not in the table (no
 * Weapon_3 slot, e.g. Focus/Warhorn, or a weapon Weaver can't wield) rather than throwing, so callers
 * can fall back gracefully.
 */
export function weaverWeaponThreeSkillId(
  weaponType: string,
  currentAttunement: string,
  previousAttunement: string
): number | null {
  const [first, second] =
    (WEAVER_ATTUNEMENT_PRIORITY[currentAttunement] ?? 99) <= (WEAVER_ATTUNEMENT_PRIORITY[previousAttunement] ?? 99)
      ? [currentAttunement, previousAttunement]
      : [previousAttunement, currentAttunement]
  return WEAVER_WEAPON_3_SKILLS[`${weaponType}|${first}+${second}`] ?? null
}

/**
 * Resolves a `Weapon_1`-`Weapon_5`-slotted skill-id list (a weapon type's own `skills`, or an
 * Engineer Kit's `Skill.bundleSkills` — both use the identical slot-naming/land-underwater-
 * duplication shape) down to one id per slot, scoped to the given environment. Most weapons/kits
 * have exactly one entry per slot (used as-is); the rest resolve via these signals, tried in order
 * per slot until one narrows to a single id — but first, every candidate in
 * `RETIRED_WEAPON_SKILL_IDS` (see its own doc comment) is dropped unconditionally, before any
 * numbered signal below runs:
 *
 * 1. **Flip-target removal**: a candidate that's another same-slot candidate's `flipSkill` target
 *    is never itself the bar's starting skill — dropped before anything else, same reasoning as
 *    `skill-calc/skill-variants.ts`'s flip-root signal. (Revenant off-hand Sword's Weapon_4 used to
 *    be the textbook example here — "Duelist's Preparation" (28571) flips to "Shackling Wave"
 *    (28472) — until 2026-08-19 found that pairing itself was stale: 28571 is retired content, now
 *    excluded up front by `RETIRED_WEAPON_SKILL_IDS` instead of reaching this step at all.)
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
 *    slot to exactly 1. Weaver's Weapon_3 "Dual Attack" replacements are the one case this signal
 *    (and every other signal below it) can't resolve on their own — up to 3 Weaver-gated ids can
 *    share one `attunement` tag, since it only ever encodes *one* of the combo's two elements (see
 *    `WEAVER_WEAPON_3_SKILLS`'s doc comment) — so `weaponSkillIdsForPair`'s `previousAttunement`
 *    param bypasses this function's own Weapon_3 result entirely for Weaver, substituting
 *    `weaverWeaponThreeSkillId`'s lookup instead; this function's fallback below is never actually
 *    reached for that slot once Weaver is equipped.
 *
 * Remaining ambiguity (Slick Shoes/Rocket Boots' old-vs-reworked land pair, per TODO.md) falls back
 * to the first matching entry — a documented known limitation, not a silent guess presented as
 * correct.
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

    const live = candidates.filter((c) => !RETIRED_WEAPON_SKILL_IDS.has(c.id))
    if (live.length > 0) candidates = live

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
 *
 * `previousAttunement` switches to Weaver's dual-attunement resolution (only meaningful — and only
 * ever passed — when Weaver is equipped, see `Build.weaverPreviousAttunement`'s doc comment): skills
 * 1-2 still resolve off `attunement` (current, main-hand) as normal, but skills 4-5 resolve off
 * `previousAttunement` instead (off-hand) — a real Weaver's off-hand slots track whichever
 * attunement it swapped *out of*, not the currently-displayed one — and skill 3 is looked up
 * directly via `weaverWeaponThreeSkillId` rather than `resolveSkillBarIds`' own slot-3 resolution,
 * which is known to pick the wrong id once Weaver's spec id is equipped (see that function's doc
 * comment). Falls back to `mainIds[2]` if the weapon type isn't in `WEAVER_WEAPON_3_SKILLS` (e.g.
 * no main weapon chosen yet) rather than showing nothing.
 */
export function weaponSkillIdsForPair(
  mainWeapon: ProfessionWeapon | undefined,
  offWeapon: ProfessionWeapon | undefined,
  environment: Environment,
  skillsById: Map<number, Skill>,
  equippedSpecializationIds: ReadonlySet<number> = new Set(),
  mainWeaponType?: string | null,
  offWeaponType?: string | null,
  attunement?: string | null,
  previousAttunement?: string | null
): (number | null)[] {
  const mainIds = mainWeapon
    ? resolveSkillBarIds(mainWeapon.skills, environment, skillsById, equippedSpecializationIds, offWeaponType, attunement)
    : [null, null, null, null, null]
  if (previousAttunement && attunement) {
    const offIds = offWeapon
      ? resolveSkillBarIds(offWeapon.skills, environment, skillsById, equippedSpecializationIds, mainWeaponType, previousAttunement)
      : [null, null, null, null, null]
    const dualAttackId = mainWeaponType ? weaverWeaponThreeSkillId(mainWeaponType, attunement, previousAttunement) : null
    return [mainIds[0], mainIds[1], dualAttackId ?? mainIds[2], offIds[3], offIds[4]]
  }
  const offIds = offWeapon
    ? resolveSkillBarIds(offWeapon.skills, environment, skillsById, equippedSpecializationIds, mainWeaponType, attunement)
    : [null, null, null, null, null]
  return [mainIds[0], mainIds[1], mainIds[2], offIds[3], offIds[4]]
}
