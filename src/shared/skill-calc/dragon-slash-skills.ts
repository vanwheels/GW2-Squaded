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
 * Deliberately NOT covered by this pass: Bladesworn's 2 traits that reflavor Dragon Slash entirely
 * (Sharp as the Wind — a condi-damage branch; River's Flow — a support/boon branch), each swapping
 * in a differently-named, differently-described id per Dragon Slash skill (e.g. "Dragon Slash—Force
 * (Sharp as the Wind)") per the wiki's own Dragon_Trigger skill table. Same shape as
 * `branch-conditional-facts.ts`'s existing Otherworldly Bond/Blossoming Aura treatment (mutually
 * exclusive per-trait branches) — left as a follow-up, logged in TODO.md, not attempted here.
 *
 * Icons are wiki-hosted (`wiki.guildwars2.com`, not `render.guildwars2.com`), same one deliberate
 * inconsistency as Gunsaber's icons, for the same reason (no official CDN render exists for an id
 * the public API doesn't recognize).
 */
export const DRAGON_TRIGGER_SKILL_ID = 62803
const DRAGON_SLASH_FORCE_ID = 62797
const DRAGON_SLASH_BOOST_ID = 62980
const DRAGON_SLASH_REACH_ID = 62951
const TRIGGERGUARD_ID = 62893
const FLICKER_STEP_ID = 62926

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
 *  `GUNSABER_WEAPON_BAR_SKILL_IDS` — see `bundle-skills.ts`'s `DRAGON_SLASH_SLOT_SKILLS`, which maps
 *  Dragon Trigger's own mechanic-bar id (62803) to this list. */
export const DRAGON_SLASH_BAR_SKILL_IDS: number[] = [DRAGON_SLASH_FORCE_ID, DRAGON_SLASH_BOOST_ID, DRAGON_SLASH_REACH_ID, TRIGGERGUARD_ID, FLICKER_STEP_ID]
