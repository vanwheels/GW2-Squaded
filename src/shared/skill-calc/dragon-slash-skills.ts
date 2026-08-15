import type { Skill } from '../types'

/**
 * Bladesworn's Dragon Slash bundle — the 5 skills shown while "Dragon Trigger" (Warrior's
 * Profession_2 F2 button, id 62803, a REAL API skill: it resolves fine through the normal
 * `professionMechanicBar` per-spec resolver) is channeling: 3 alternative finishers (Dragon
 * Slash—Force/Boost/Reach, one of which the player picks to end the channel) plus 2 skills that
 * DON'T end the channel (Triggerguard, Flicker Step) — live-verified against the wiki 2026-08-15
 * (`wiki.guildwars2.com/wiki/Dragon_Trigger`'s own "Skills" table). Same data-gap shape as
 * `gunsaber-skills.ts` (see that file's doc comment for the full writeup of the underlying API
 * gap): every one of these 5 ids resolves "all ids provided are invalid" against the live
 * `/v2/skills?ids=...` endpoint even though each has a real, wiki-documented `id =` infobox field
 * and a real in-game tooltip — confirmed live 2026-08-15 for all 5 (62797, 62980, 62951, 62893,
 * 62926), same as Gunsaber's cluster. Hand-authored here and merged into `skillsById` at load time
 * (`game-data-store.tsx`), same mechanism.
 *
 * Unlike Gunsaber's kit (deliberately left with NO Damage facts at all, since none of its 5 skills'
 * damage is a single unambiguous coefficient — see that file's doc comment), Dragon Slash—Force/
 * Boost/Reach DO get real `Damage` facts here: each has a clean, unambiguous wiki-quoted Minimum/
 * Maximum Damage pair (Minimum = using the skill at the lowest charge level, Maximum = at full
 * charge, "consumes all charges to deal more damage" per each skill's own description) — the same
 * shape already curated for plenty of real API skills (e.g. Engineer's Blunderbuss, id 6153) via
 * `CURATED_DAMAGE_COEFFICIENTS` in `damage-calc.ts`, which is where these 3 ids' actual coefficients
 * live (search that file for "Dragon Slash"). Both `coefficient-snapshots.test.ts` and
 * `game-data-store.tsx` merge `DRAGON_SLASH_SKILLS` into their own local `skillsById` for this
 * reason — the snapshot test's own "fail loudly if a curated id has no matching skill" safety net
 * would otherwise throw on these 3 ids, same fix needed the first time a hand-authored id got a
 * damage curation entry.
 *
 * Bladesworn's 2 traits that reflavor Dragon Slash entirely (Sharp as the Wind, id 2260 — a
 * condi-damage branch; River's Flow, id 2237 — a support/boon branch) are also hand-authored here
 * (`DRAGON_SLASH_SHARP_AS_THE_WIND_SKILLS`/`DRAGON_SLASH_RIVERS_FLOW_SKILLS` below, curated
 * 2026-08-15), each swapping in a differently-named, differently-described id per Dragon Slash
 * skill (e.g. "Dragon Slash—Force (Sharp as the Wind)", id 80199) per the wiki's own Dragon_Trigger
 * skill table (wiki-verified via raw wikitext for all 6 variant ids plus both trait pages).
 * Triggerguard/Flicker Step are untouched by either trait (same 2 ids, `TRIGGERGUARD_ID`/
 * `FLICKER_STEP_ID`, in all 3 of the game's own skill-table rows) — only Force/Boost/Reach get
 * reflavored. `bundle-skills.ts`'s `dragonSlashBarSkillIdsForBuild` picks among the 3 five-skill
 * bars (base/Sharp as the Wind/River's Flow) by which trait (if either) a build has chosen, same
 * "just check `chosenTraitIds` membership" shape as `skill-variants.ts`'s
 * `GADGETEER_GATED_SKILL_IDS` resolution.
 *
 * Each variant keeps the same "consumes all charges to increase X" shape as the base skill, except
 * X is no longer Damage (which stays flat/unscaled by charge level on these 2 branches) but
 * whatever the branch is themed around instead:
 * - **Sharp as the Wind** (Force/Boost/Reach all inflict Burning): the wiki gives explicit
 *   Minimum/Maximum Burning Duration numbers per skill (min = lowest charge, max = full charge,
 *   same "two real, mutually exclusive per-cast outcomes" shape Otherworldly Bond's Enemy/Ally
 *   Target split already established) — curated via `branch-conditional-facts.ts`'s
 *   `dragonSlashSharpAsTheWindBranches` as "Minimum Charge"/"Maximum Charge" labeled sections
 *   rather than 2 flat `Buff` facts directly on the skill, since Burning IS a tracked
 *   `CONDITION_NAMES` entry (unlike Damage) — 2 real facts on one skill would double-count into
 *   `computeBoonConditionSources`'s aggregate totals as if both applications happen on the same
 *   cast, same reasoning Otherworldly Bond's doc comment already spells out. WvW+PvP Maximum value
 *   used per this app's convention (PvE's own higher stack count/lower duration noted in each
 *   variant's own comment below); Minimum has no game-mode split on the wiki, used as-is.
 * - **River's Flow** (support branch): Boost's Healing gets an explicit Minimum/Maximum pair too,
 *   but Healing tooltip lines are pure per-fact display (no aggregate total to double-count into,
 *   same as the base skill's own Minimum/Maximum Damage facts) — curated directly via
 *   `CURATED_HEALING_COEFFICIENTS`, no branch treatment needed. Reach's Daze isn't a tracked
 *   `CONDITION_NAMES`/`BOON_NAMES` entry at all (see `constants.ts`'s own note that Control/Hard-CC
 *   doesn't fit the `Buff`-status shape), so its Minimum/Maximum Daze Duration are plain `Time`
 *   facts, informational only, no double-count risk either way. Force's Might grant
 *   (`{{skill fact|Might|stacks=2|alt=Boons per Charge}}`) is the one genuinely ambiguous case — the
 *   wiki gives a flat per-charge rate with no total-charges-consumed number to multiply it by (the
 *   same open-ended shape Otherworldly Bond's own "Might Stacks per Level" flat text was left
 *   unscaled for) — kept as a plain `Number` fact rather than a real `Buff` fact, honest about not
 *   claiming a specific total Might grant per cast.
 *
 * Icons are wiki-hosted (`wiki.guildwars2.com`, not `render.guildwars2.com`), same one deliberate
 * inconsistency as Gunsaber's icons, for the same reason (no official CDN render exists for an id
 * the public API doesn't recognize) — each trait variant's own wiki page gives `icon =` as the bare
 * same filename as its base-skill sibling (GW2 doesn't render a distinct icon per trait variant),
 * so these reuse the base 3 skills' own `wikiIcon(...)` calls rather than sourcing new hashes.
 */
export const DRAGON_TRIGGER_SKILL_ID = 62803
const DRAGON_SLASH_FORCE_ID = 62797
const DRAGON_SLASH_BOOST_ID = 62980
const DRAGON_SLASH_REACH_ID = 62951
const TRIGGERGUARD_ID = 62893
const FLICKER_STEP_ID = 62926

/** Bladesworn's 2 traits that reflavor the whole Dragon Slash chain — see this file's own doc
 *  comment. Exported so `bundle-skills.ts`'s `dragonSlashBarSkillIdsForBuild` can gate on them. */
export const SHARP_AS_THE_WIND_TRAIT_ID = 2260
export const RIVERS_FLOW_TRAIT_ID = 2237

const DRAGON_SLASH_FORCE_SHARP_AS_THE_WIND_ID = 80199
const DRAGON_SLASH_BOOST_SHARP_AS_THE_WIND_ID = 80281
const DRAGON_SLASH_REACH_SHARP_AS_THE_WIND_ID = 80246
const DRAGON_SLASH_FORCE_RIVERS_FLOW_ID = 80250
const DRAGON_SLASH_BOOST_RIVERS_FLOW_ID = 80228
const DRAGON_SLASH_REACH_RIVERS_FLOW_ID = 80236

function wikiIcon(file: string): string {
  const fileName = file.split('/').pop()
  return `https://wiki.guildwars2.com/images/thumb/${file}/64px-${fileName}`
}

export const DRAGON_SLASH_SKILLS: Skill[] = [
  {
    id: DRAGON_SLASH_FORCE_ID,
    name: 'Dragon Slash—Force',
    description: 'Slash foes in front of you, ending Dragon Trigger. This attack consumes all charges to deal more damage.',
    icon: wikiIcon('b/b5/Dragon_Slash—Force.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_1',
    flags: [],
    categories: ['Burst'],
    facts: [
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Maximum Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 20.4 },
      { text: 'Minimum Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 1.16 },
      { text: 'Range', type: 'Range', value: 300 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: DRAGON_SLASH_BOOST_ID,
    name: 'Dragon Slash—Boost',
    description: 'Dash forward while slashing all foes in a line, ending Dragon Trigger. This attack consumes all charges to deal more damage.',
    icon: wikiIcon('7/75/Dragon_Slash—Boost.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_2',
    flags: ['GroundTargeted'],
    categories: ['Burst'],
    facts: [
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Maximum Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 16.3 },
      { text: 'Minimum Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 0.92 },
      { text: 'Range', type: 'Range', value: 750 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: DRAGON_SLASH_REACH_ID,
    name: 'Dragon Slash—Reach',
    description: 'Slash to create a blade of air that strikes foes in a line in front of you, ending Dragon Trigger. This attack consumes all charges to deal more damage.',
    icon: wikiIcon('e/eb/Dragon_Slash—Reach.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_3',
    flags: [],
    categories: ['Burst'],
    facts: [
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Pierces', type: 'NoData' },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Unblockable', type: 'NoData' },
      { text: 'Maximum Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 10.21 },
      { text: 'Minimum Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 0.58 },
      { text: 'Range', type: 'Range', value: 900 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: TRIGGERGUARD_ID,
    name: 'Triggerguard',
    description: 'Gain aegis.\nUsing this skill will not end Dragon Trigger.',
    icon: wikiIcon('4/4e/Triggerguard.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_4',
    flags: [],
    categories: [],
    facts: [
      { type: 'Buff', status: 'Aegis', duration: 2, description: 'Block the next incoming attack.', apply_count: 1 },
      { text: 'Maximum Count', type: 'Number', value: 2 },
      // WvW/PvP value (40s) — PvE is 30s; this sweep's established convention uses the WvW value.
      { text: 'Count Recharge', type: 'Time', duration: 40 },
      { text: 'Range', type: 'Range', value: 900 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: FLICKER_STEP_ID,
    name: 'Flicker Step',
    description: 'Blink to a location.\nUsing this skill will not end Dragon Trigger.',
    icon: wikiIcon('d/de/Flicker_Step.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_5',
    flags: [],
    categories: [],
    facts: [
      // WvW/PvP values (2 charges / 60s recharge) — PvE is 3 charges / 20s. This sweep's
      // established convention uses the WvW value.
      { text: 'Maximum Count', type: 'Number', value: 2 },
      { text: 'Count Recharge', type: 'Time', duration: 60 },
      { text: 'Range', type: 'Range', value: 300 },
      { text: 'Recharge', type: 'Recharge', value: 0.5 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  }
]

/** Keyed in `Weapon_1`-`Weapon_5` order, same convention as `gunsaber-skills.ts`'s
 *  `GUNSABER_WEAPON_BAR_SKILL_IDS` — see `bundle-skills.ts`'s `dragonSlashBarSkillIdsForBuild`,
 *  which picks this array (untraited) or one of the 2 below (Sharp as the Wind/River's Flow
 *  chosen) for Dragon Trigger's own mechanic-bar id (62803). */
export const DRAGON_SLASH_BAR_SKILL_IDS: number[] = [DRAGON_SLASH_FORCE_ID, DRAGON_SLASH_BOOST_ID, DRAGON_SLASH_REACH_ID, TRIGGERGUARD_ID, FLICKER_STEP_ID]

/**
 * Sharp as the Wind's 3 reflavored Force/Boost/Reach ids — Triggerguard/Flicker Step are untouched
 * (same ids as the base bar). Each Damage fact is now a single flat "Damage" (no Minimum/Maximum
 * split — charge level instead scales Burning duration, see `branch-conditional-facts.ts`'s
 * `dragonSlashSharpAsTheWindBranches`) curated in `CURATED_DAMAGE_COEFFICIENTS`
 * (`damage-calc.ts`, search "Sharp as the Wind"). Wiki-verified via raw wikitext 2026-08-15.
 */
export const DRAGON_SLASH_SHARP_AS_THE_WIND_SKILLS: Skill[] = [
  {
    id: DRAGON_SLASH_FORCE_SHARP_AS_THE_WIND_ID,
    name: 'Dragon Slash—Force',
    description: 'Slash foes in an arc in front of you, inflicting burning on enemies and ending Dragon Trigger. This attack consumes all charges to increase burning duration.',
    icon: wikiIcon('b/b5/Dragon_Slash—Force.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_1',
    flags: [],
    categories: ['Burst'],
    facts: [
      { text: 'Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 3.0 },
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Range', type: 'Range', value: 300 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: DRAGON_SLASH_BOOST_SHARP_AS_THE_WIND_ID,
    name: 'Dragon Slash—Boost',
    description: 'Dash forward while slashing all foes in a line, inflicting burning and ending Dragon Trigger. This attack consumes all charges to increase burning duration.',
    icon: wikiIcon('7/75/Dragon_Slash—Boost.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_2',
    flags: ['GroundTargeted'],
    categories: ['Burst'],
    facts: [
      { text: 'Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 2.4 },
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Range', type: 'Range', value: 750 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: DRAGON_SLASH_REACH_SHARP_AS_THE_WIND_ID,
    name: 'Dragon Slash—Reach',
    description: 'Slash to create a blade of air that strikes and burns foes in a line in front of you, ending Dragon Trigger. This attack consumes all charges to increase burning duration.',
    icon: wikiIcon('e/eb/Dragon_Slash—Reach.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_3',
    flags: [],
    categories: ['Burst'],
    facts: [
      { text: 'Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 1.5 },
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Pierces', type: 'NoData' },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Range', type: 'Range', value: 900 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  }
  // Triggerguard/Flicker Step deliberately NOT repeated here — same 2 ids as the base bar
  // (`TRIGGERGUARD_ID`/`FLICKER_STEP_ID`), already provided by `DRAGON_SLASH_SKILLS`, which every
  // caller merges into `skillsById` alongside this array regardless of which bar is active.
]

export const DRAGON_SLASH_SHARP_AS_THE_WIND_BAR_SKILL_IDS: number[] = [
  DRAGON_SLASH_FORCE_SHARP_AS_THE_WIND_ID,
  DRAGON_SLASH_BOOST_SHARP_AS_THE_WIND_ID,
  DRAGON_SLASH_REACH_SHARP_AS_THE_WIND_ID,
  TRIGGERGUARD_ID,
  FLICKER_STEP_ID
]

/**
 * River's Flow's 3 reflavored Force/Boost/Reach ids — same shape as the Sharp as the Wind set
 * above, minus its Burning branches: Force's Might grant is a flat, unscaled `Number` fact (see
 * this file's own doc comment for why); Boost's Healing is a real Minimum/Maximum pair curated in
 * `CURATED_HEALING_COEFFICIENTS`; Reach's Daze is a plain informational `Time` pair. None of the 3
 * Damage facts carry a PvE/WvW+PvP split on the wiki (unlike Sharp as the Wind's), used as-is.
 */
export const DRAGON_SLASH_RIVERS_FLOW_SKILLS: Skill[] = [
  {
    id: DRAGON_SLASH_FORCE_RIVERS_FLOW_ID,
    name: 'Dragon Slash—Force',
    description: 'Slash foes in front of you, applying boons to nearby allies and ending Dragon Trigger. This attack consumes all charges to increase the number of boons applied to allies.',
    icon: wikiIcon('b/b5/Dragon_Slash—Force.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_1',
    flags: [],
    categories: ['Burst'],
    facts: [
      { text: 'Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 3.0 },
      // Flat per-charge rate, no total-charges-consumed number on the wiki to multiply it by — see
      // this file's own doc comment (same shape as Otherworldly Bond's unscaled "Might Stacks per
      // Level"). Deliberately not a real `Buff` fact.
      { text: 'Might Stacks per Charge Consumed', type: 'Number', value: 2 },
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Number of Allied Targets', type: 'Number', value: 5 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Range', type: 'Range', value: 300 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: DRAGON_SLASH_BOOST_RIVERS_FLOW_ID,
    name: 'Dragon Slash—Boost',
    description: 'Dash forward while slashing all foes in a line, healing allies you pass through and ending Dragon Trigger. This attack consumes all charges to increase the healing granted to allies.',
    icon: wikiIcon('7/75/Dragon_Slash—Boost.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_2',
    flags: ['GroundTargeted'],
    categories: ['Burst'],
    facts: [
      { text: 'Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 2.4 },
      { text: 'Minimum Healing', type: 'AttributeAdjust', target: 'Healing', value: 3215 },
      { text: 'Maximum Healing', type: 'AttributeAdjust', target: 'Healing', value: 6558 },
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Number of Allied Targets', type: 'Number', value: 5 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Range', type: 'Range', value: 750 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: DRAGON_SLASH_REACH_RIVERS_FLOW_ID,
    name: 'Dragon Slash—Reach',
    description: 'Slash to create a blade of air that strikes and dazes foes in a line in front of you, ending Dragon Trigger. This attack consumes all charges to increase the duration of daze inflicted.',
    icon: wikiIcon('e/eb/Dragon_Slash—Reach.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_3',
    flags: [],
    categories: ['Burst'],
    facts: [
      { text: 'Damage', type: 'Damage', hit_count: 1, dmg_multiplier: 1.5 },
      // Daze isn't a tracked `CONDITION_NAMES`/`BOON_NAMES` entry (see `constants.ts`), so a plain
      // `Time` pair carries no double-count risk the way Burning's `Buff` facts would.
      { text: 'Minimum Daze Duration', type: 'Time', duration: 2 },
      { text: 'Maximum Daze Duration', type: 'Time', duration: 4 },
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Pierces', type: 'NoData' },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Unblockable', type: 'NoData' },
      { text: 'Defiance Break', type: 'Number', value: 600 },
      { text: 'Range', type: 'Range', value: 900 },
      { text: 'Recharge', type: 'Recharge', value: 1 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  }
  // Triggerguard/Flicker Step deliberately NOT repeated here — see the same note on
  // `DRAGON_SLASH_SHARP_AS_THE_WIND_SKILLS` above.
]

export const DRAGON_SLASH_RIVERS_FLOW_BAR_SKILL_IDS: number[] = [
  DRAGON_SLASH_FORCE_RIVERS_FLOW_ID,
  DRAGON_SLASH_BOOST_RIVERS_FLOW_ID,
  DRAGON_SLASH_REACH_RIVERS_FLOW_ID,
  TRIGGERGUARD_ID,
  FLICKER_STEP_ID
]
