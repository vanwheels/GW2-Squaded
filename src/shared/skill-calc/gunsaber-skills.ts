import type { Skill } from '../types'

/**
 * Bladesworn's Gunsaber weapon-skill-bar (Weapon_1-5, shown while "Unsheathe Gunsaber" is active —
 * see `GUNSABER_SLOT_SKILLS` below and `bundle-skills.ts`): the 5 ids ARE real, live, in-game
 * skills (live-verified 2026-07-31 against tooltip screenshots from a real client, description
 * text matched word-for-word against the wiki) but, uniquely among everything else this app
 * sources from the API, are entirely absent from the public `/v2/skills` endpoint — confirmed by
 * querying the live API directly for each id (`ids=62966,62930,62732,62789,62885` and others in
 * this cluster), which returns "all ids provided are invalid" for every single one, even though
 * `/v2/skills` (the bare id index) lists no gap at all around them. Every other Bladesworn id in
 * this same small id range (Unsheathe/Sheathe Gunsaber 62745/62861, Dragon Trigger 62803) resolves
 * fine — only the Gunsaber weapon bar itself is excluded, apparently deliberately on ArenaNet's
 * side. A prior investigation session (see COMPLETED.md, session on 2026-07-31) tried to identify
 * these ids via 2 separate wiki fetches and got contradictory names for slots 4-5 — that turned out
 * to be because the WRONG ids were being cross-referenced (a coincidental same-name collision with
 * unrelated Cantha Living World NPC boss skills, e.g. "Artillery Slash" also being a Minister Li
 * attack) rather than a genuine wiki ambiguity; this pass re-verified every id directly against a
 * live client's own tooltips first, then confirmed the matching wiki page by exact description
 * text, sidestepping that trap entirely.
 *
 * Since these ids don't exist in `data/game-data/skills.json` at all, they're hand-authored here
 * and merged into `skillsById` at load time (`game-data-store.tsx`) so every normal consumer
 * (tooltip rendering, icon rendering, boon/condition extraction) works unmodified, same as any
 * other `Skill`. Icons are wiki-hosted (`wiki.guildwars2.com`, not `render.guildwars2.com`) since
 * these ids have no official CDN render either — the one deliberate inconsistency with the rest of
 * this app's icon sourcing, a tradeoff confirmed with the user rather than silently introduced.
 *
 * Facts are deliberately limited to non-damage structural data (Range, Recharge/Count Recharge/
 * Maximum Count, Number of Targets, Combo Finisher, Explosion) plus the 2 real self-applied boons
 * (Cyclone Trigger's Aegis, Break Step's Fury) that actually matter for this app's boon/condition
 * calculator. Raw damage numbers shown in a tooltip are a function of the viewing player's own
 * power stat at that moment, not a portable value — this app already has an established, deliberate
 * policy of never reconstructing those (see `skill-calc/fact-numbers.ts`'s doc comment on why
 * `Damage.dmg_multiplier` is never turned into a shown number), so none are fabricated here either.
 * Steel Divide/Explosive Thrust (the 2nd/3rd hits of slot 1's auto-attack chain) aren't modeled as
 * their own `Skill` objects — same "entry point only" convention already used for Reaper's Shroud's
 * own 3-hit chain in `NECRO_SHROUD_SLOT_SKILLS` (`bundle-skills.ts`), since a chain's later hits
 * are never independently equippable or separately displayed.
 */
export const GUNSABER_SWIFT_CUT_ID = 62966
const GUNSABER_BLOOMING_FIRE_ID = 62930
const GUNSABER_ARTILLERY_SLASH_ID = 62732
const GUNSABER_CYCLONE_TRIGGER_ID = 62789
const GUNSABER_BREAK_STEP_ID = 62885

function wikiIcon(file: string): string {
  const fileName = file.split('/').pop()
  return `https://wiki.guildwars2.com/images/thumb/${file}/64px-${fileName}`
}

export const GUNSABER_SKILLS: Skill[] = [
  {
    id: GUNSABER_SWIFT_CUT_ID,
    name: 'Swift Cut',
    description: 'Chain. Slash your foe, then fire off a ranged shot. Foes hit by the initial attack take less damage from the follow-up shot.',
    icon: wikiIcon('e/e3/Swift_Cut.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_1',
    flags: [],
    categories: [],
    facts: [
      { text: 'Number of Targets', type: 'Number', value: 3 },
      { text: 'Range', type: 'Range', value: 900 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: GUNSABER_BLOOMING_FIRE_ID,
    name: 'Blooming Fire',
    description: 'Slash with your blade and fire a grenade shell that shatters on impact, releasing a series of explosions.',
    icon: wikiIcon('d/d0/Blooming_Fire.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_2',
    flags: [],
    categories: [],
    facts: [
      { text: 'Number of Targets', type: 'Number', value: 3 },
      { text: 'Maximum Count', type: 'Number', value: 2 },
      { text: 'Count Recharge', type: 'Time', duration: 10 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Range', type: 'Range', value: 900 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: GUNSABER_ARTILLERY_SLASH_ID,
    name: 'Artillery Slash',
    description:
      'Consume all charges to launch a single shell from your sword that explodes on the first enemy hit. Deals bonus damage and applies different effects based on the amount of charges consumed.',
    icon: wikiIcon('6/68/Artillery_Slash.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_3',
    flags: [],
    categories: [],
    facts: [
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { text: 'Maximum Count', type: 'Number', value: 2 },
      { text: 'Count Recharge', type: 'Time', duration: 8 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Combo Finisher', type: 'ComboFinisher', percent: 100, finisher_type: 'Projectile' },
      { text: 'Range', type: 'Range', value: 900 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: GUNSABER_CYCLONE_TRIGGER_ID,
    name: 'Cyclone Trigger',
    description: 'Spin and block enemy projectiles. Strikes all foes in melee range, and then fires shots at foes out of melee range.',
    icon: wikiIcon('6/6c/Cyclone_Trigger.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_4',
    flags: [],
    categories: [],
    facts: [
      { text: 'Number of Targets', type: 'Number', value: 5 },
      { type: 'Buff', status: 'Aegis', duration: 3, description: 'Block the next incoming attack.', apply_count: 1 },
      { text: 'Blocks Missiles', type: 'NoData' },
      { text: 'Missile Block Duration', type: 'Time', duration: 1.5 },
      { text: 'Maximum Count', type: 'Number', value: 2 },
      { text: 'Count Recharge', type: 'Time', duration: 20 },
      { text: 'Range', type: 'Range', value: 600 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  },
  {
    id: GUNSABER_BREAK_STEP_ID,
    name: 'Break Step',
    description: 'Lunge forward with explosive force, damaging enemies at your starting position.',
    icon: wikiIcon('7/76/Break_Step.png'),
    chatLink: '',
    type: 'Weapon',
    weaponType: 'None',
    professions: ['Warrior'],
    slot: 'Weapon_5',
    flags: [],
    categories: [],
    facts: [
      { type: 'Buff', status: 'Fury', duration: 5, description: '+20% Critical Chance', apply_count: 1 },
      { text: 'Removes Immobile', type: 'NoData' },
      { text: 'Number of Targets', type: 'Number', value: 3 },
      { text: 'Maximum Count', type: 'Number', value: 2 },
      { text: 'Count Recharge', type: 'Time', duration: 20 },
      { text: 'Radius', type: 'Distance', distance: 180 },
      { text: 'Explosion', type: 'NoData' },
      { text: 'Combo Finisher', type: 'ComboFinisher', percent: 100, finisher_type: 'Leap' },
      { text: 'Range', type: 'Range', value: 450 }
    ],
    traitedFacts: [],
    attunement: null,
    specializationId: 68,
    flipSkill: null,
    toolbeltSkill: null,
    bundleSkills: null
  }
]

/** Keyed by the 5 ids above, in `Weapon_1`-`Weapon_5` order — see `bundle-skills.ts`'s
 *  `GUNSABER_SLOT_SKILLS`, which maps Gunsaber's F1 toggle id to this list the same way
 *  `NECRO_SHROUD_SLOT_SKILLS` maps Shroud's F1 to its own 5 ids. */
export const GUNSABER_WEAPON_BAR_SKILL_IDS: number[] = [
  GUNSABER_SWIFT_CUT_ID,
  GUNSABER_BLOOMING_FIRE_ID,
  GUNSABER_ARTILLERY_SLASH_ID,
  GUNSABER_CYCLONE_TRIGGER_ID,
  GUNSABER_BREAK_STEP_ID
]
