import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build, GameData } from '../types'
import { computeCharacterStats } from './derived-stats'
import { DEFAULT_COMBAT_STATE } from './combat-state'

/**
 * Tier 3 — hand-verified reference builds (TODO.md's "Automated testing strategy", final tier,
 * picked up 2026-08-13). Unlike Tier 1 (formula arithmetic against wiki-quoted constants) or Tier 2
 * (golden-snapshot drift protection), this is the actual manual-verification oracle: 3 real WvW
 * builds the user hand-built and independently verified two ways — gw2skills.net's own Attributes
 * panel AND a live in-game hero-panel check (same build, both confirmed 2026-08-13) — asserted
 * against this app's `computeCharacterStats` output. Used sparingly (3 builds, not a sweep) because
 * each one requires that external manual verification; it exists to catch exactly the class of bug
 * Tier 1/2 structurally cannot (a value that's wrong in a way consistent with itself, so there's
 * nothing in-repo to diff against).
 *
 * All 3 builds came from the user directly (gw2skills.net editor links + screenshots of the Gear/
 * Traits/Skills tabs), decoded using the trait-pick shorthand "[Specialization] x-x-x" (1/2/3 =
 * top/mid/bottom choice per tier — see traits.json's `order` field, memory note
 * `trait_notation_shorthand`). All 3 are WvW, all Ascended gear (this app's only modeled rarity).
 *
 * Building this surfaced 2 genuine, previously-unmodeled bugs (both real "silent omission" gaps —
 * fixed in `combat-state.ts`/`derived-stats.ts` this same session, not just documented):
 * 1. `HEALTH_THRESHOLD_CONSUMABLE_BONUSES` — the WvW "Writ of X"/"Thesis on X" consumable family
 *    ("Gain N Power/Precision/Condition Damage When Health above 90%") parsed to `{attribute:
 *    null}` and silently contributed nothing; no infra existed for a health-threshold-gated
 *    *consumable* bonus (only traits had one, `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES`).
 * 2. `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES` — Renegade's Brutal Momentum trait (+33% critical
 *    chance at full Endurance, overriding its own +10%/+15% baseline) had no full-Endurance combat
 *    state dimension anywhere in the app at all.
 * The Renegade build below is what actually caught both — its Power/Critical Chance didn't match
 * the external oracle until both were fixed. See TODO.md and COMPLETED.md for the full writeup.
 *
 * Tolerances: targets are the *displayed* (rounded) gw2skills.net/in-game numbers, while this app's
 * raw computed values carry full float precision — small diffs (a fraction of a stat point, a
 * hundredth of a percent) are expected display-rounding noise, not a real mismatch. `EXPECT_*`
 * below are generous enough to absorb that while still catching a real regression (any of these
 * builds' totals are wrong by single-digit-percent margins when even one gear piece/trait/rune is
 * mis-modeled, far outside these tolerances).
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
function loadGameData(name: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/' + name), 'utf-8'))
}

const gameData: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'infusions' | 'runes' | 'sigils' | 'food' | 'utility' | 'traits'> = {
  itemStats: loadGameData('itemstats.json') as GameData['itemStats'],
  itemStatLegalIds: loadGameData('itemstat-legal-ids.json') as GameData['itemStatLegalIds'],
  infusions: loadGameData('infusions.json') as GameData['infusions'],
  runes: loadGameData('runes.json') as GameData['runes'],
  sigils: loadGameData('sigils.json') as GameData['sigils'],
  food: loadGameData('food.json') as GameData['food'],
  utility: loadGameData('utility.json') as GameData['utility'],
  traits: loadGameData('traits.json') as GameData['traits']
}

function repeat(infusionId: number, count: number): number[] {
  return Array.from({ length: count }, () => infusionId)
}

function baseBuild(overrides: Partial<Build>): Build {
  return {
    id: 'tier3-test',
    name: 'Tier 3 test',
    notes: '',
    profession: 'Guardian',
    specializations: [null, null, null],
    skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: null },
    equipment: {},
    relicId: null,
    foodId: null,
    utilityId: null,
    environment: 'land',
    activeWeaponSet: 'A',
    activeUnderwaterSet: 'U1',
    equippedPetIds: [null, null],
    activePetIndex: 0,
    activeBundleSkillId: null,
    rangerUnleashed: false,
    familiarId: null,
    activeAttunement: 'Fire',
    weaverPreviousAttunement: null,
    thiefStolenSkillId: null,
    vindicatorAspectFlipped: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedAtGw2Build: null,
    tags: [],
    order: 0,
    favorite: false,
    ...overrides
  }
}

// Infusion ids — one per build (all "Mighty x20" / "Concentration x20" / "Healing x20" per the
// user, spread across every armor/trinket infusion slot plus both active weapon set's slots — 16 +
// 2 (Spear, active set A) + 2 (the build's own inactive set B, 2 more slots either way) = 20 total
// physically equipped, matching the user's own count, even though only the 18 on the active set
// actually contribute to the totals asserted below).
const MIGHTY_INFUSION = 43254
const CONCENTRATION_INFUSION = 86986
const HEALING_INFUSION = 43250

/**
 * "DPS Strip Renegade" — gw2skills.net: https://gw2skills.net/editor/?PmgEQrU2ChwyIImGFx2IJ2IByMIBm0XavXA-DWZYBRFKcIkaezhqcGVIF6WFIzPEBIg9wrpKLYAA-w
 * Traits: Invocation 2-2-3 (Rising Tide, Rapid Flow, Roiling Mists), Devastation 2-2-1 (Unsuspecting
 * Strikes, Notoriety, Brutality), Renegade 3-3-2 (Wrought-Iron Will, All for One, Lasting Legacy).
 * Legends: Legendary Renegade Stance (Kalla) + Legendary Demon Stance (Shiro). Gear: Helm/Chest/
 * Leggings Dragon's, Shoulders/Gloves/Boots Valkyrie, Amulet/Back Berserker's, Rings/Accessories
 * Valkyrie, Spear + Shortbow Berserker's w/ Absorption & Force. Rune of the Dragonhunter x6. Food:
 * Mists-Infused Peppercorn-Crusted Sous-Vide Steak. Utility: Writ of Masterful Strength. Relic of
 * the Claw. 20x Mighty WvW Infusion.
 */
const dpsStripRenegade = baseBuild({
  name: 'DPS Strip Renegade',
  profession: 'Revenant',
  specializations: [
    { specializationId: 3, chosenTraitIds: [1761, 1760, 1719] }, // Invocation 2-2-3
    { specializationId: 15, chosenTraitIds: [1767, 1765, 1715] }, // Devastation 2-2-1
    { specializationId: 63, chosenTraitIds: [2120, 2108, 2100] } // Renegade 3-3-2
  ],
  skills: { kind: 'revenant', legends: ['Legend5', 'Legend4'], activeLegendIndex: 0 },
  equipment: {
    helm: { itemStatId: 1681, runeId: 74978, infusionIds: repeat(MIGHTY_INFUSION, 1) }, // Dragon's
    shoulders: { itemStatId: 157, runeId: 74978, infusionIds: repeat(MIGHTY_INFUSION, 1) }, // Valkyrie
    chest: { itemStatId: 1681, runeId: 74978, infusionIds: repeat(MIGHTY_INFUSION, 1) },
    gloves: { itemStatId: 157, runeId: 74978, infusionIds: repeat(MIGHTY_INFUSION, 1) },
    leggings: { itemStatId: 1681, runeId: 74978, infusionIds: repeat(MIGHTY_INFUSION, 1) },
    boots: { itemStatId: 157, runeId: 74978, infusionIds: repeat(MIGHTY_INFUSION, 1) },
    backpiece: { itemStatId: 584, infusionIds: repeat(MIGHTY_INFUSION, 2) }, // Berserker's (trinket)
    accessory1: { itemStatId: 1119, infusionIds: repeat(MIGHTY_INFUSION, 1) }, // Valkyrie (trinket)
    accessory2: { itemStatId: 1119, infusionIds: repeat(MIGHTY_INFUSION, 1) },
    ring1: { itemStatId: 1119, infusionIds: repeat(MIGHTY_INFUSION, 3) },
    ring2: { itemStatId: 1119, infusionIds: repeat(MIGHTY_INFUSION, 3) },
    amulet: { itemStatId: 584, infusionIds: [] }, // amulet has no infusion slot
    weaponA1: { itemStatId: 161, weaponType: 'Spear', sigilIds: [72872, 24615], infusionIds: repeat(MIGHTY_INFUSION, 2) }, // Absorption, Force
    weaponA2: { itemStatId: 161, weaponType: 'Spear' }, // mirrored stat combo for the 2H weapon, see EquipmentEditor.tsx
    weaponB1: { itemStatId: 161, weaponType: 'Shortbow', sigilIds: [72872, 24615], infusionIds: repeat(MIGHTY_INFUSION, 2) },
    weaponB2: { itemStatId: 161, weaponType: 'Shortbow' }
  },
  relicId: 103574, // Relic of the Claw
  foodId: 99785, // Mists-Infused Peppercorn-Crusted Sous-Vide Steak
  utilityId: 73191 // Writ of Masterful Strength
})

/**
 * "Shattered Aegis Firebrand" — gw2skills.net: https://gw2skills.net/editor/?PWwEQ7srMC2DDjdxMxx6q6pC-DWJYnR9/h0oEITRV6KBP+aIEh5vGNcpBA-w
 * Traits: Zeal 3-2-2 (Zealous Scepter, Zealous Blade, Shattered Aegis), Virtues 1-1-1 (Unscathed
 * Contender, Inspiring Virtue, Permeating Wrath), Firebrand 2-2-2 (Liberator's Vow, Stalwart Speed,
 * Quickfire). Skills: Mantra of Solace (heal), Mantra of Potence / "Stand Your Ground!" / "Advance!"
 * (utility), Mantra of Liberation (elite). Gear: all Wanderer's. Spear w/ Concentration & Vision,
 * Axe/Shield w/ Energy & Concentration. Rune of Leadership x6. Food: Spiced Peppercorn Cheesecake.
 * Utility: Magnanimous Maintenance Oil. Relic of Febe. 20x Concentration WvW Infusion.
 */
const shatteredAegisFirebrand = baseBuild({
  name: 'Shattered Aegis Firebrand',
  profession: 'Guardian',
  specializations: [
    { specializationId: 42, chosenTraitIds: [1925, 653, 637] }, // Zeal 3-2-2
    { specializationId: 46, chosenTraitIds: [624, 603, 622] }, // Virtues 1-1-1
    { specializationId: 62, chosenTraitIds: [2101, 2076, 2179] } // Firebrand 2-2-2
  ],
  skills: { kind: 'standard', heal: 41714, utility: [40915, 9153, 9084], elite: 43357 },
  equipment: {
    helm: { itemStatId: 1140, runeId: 70600, infusionIds: repeat(CONCENTRATION_INFUSION, 1) }, // Wanderer's
    shoulders: { itemStatId: 1140, runeId: 70600, infusionIds: repeat(CONCENTRATION_INFUSION, 1) },
    chest: { itemStatId: 1140, runeId: 70600, infusionIds: repeat(CONCENTRATION_INFUSION, 1) },
    gloves: { itemStatId: 1140, runeId: 70600, infusionIds: repeat(CONCENTRATION_INFUSION, 1) },
    leggings: { itemStatId: 1140, runeId: 70600, infusionIds: repeat(CONCENTRATION_INFUSION, 1) },
    boots: { itemStatId: 1140, runeId: 70600, infusionIds: repeat(CONCENTRATION_INFUSION, 1) },
    backpiece: { itemStatId: 1162, infusionIds: repeat(CONCENTRATION_INFUSION, 2) }, // Wanderer's (trinket)
    accessory1: { itemStatId: 1162, infusionIds: repeat(CONCENTRATION_INFUSION, 1) },
    accessory2: { itemStatId: 1162, infusionIds: repeat(CONCENTRATION_INFUSION, 1) },
    ring1: { itemStatId: 1162, infusionIds: repeat(CONCENTRATION_INFUSION, 3) },
    ring2: { itemStatId: 1162, infusionIds: repeat(CONCENTRATION_INFUSION, 3) },
    amulet: { itemStatId: 1162, infusionIds: [] },
    weaponA1: { itemStatId: 1140, weaponType: 'Spear', sigilIds: [72339, 24600], infusionIds: repeat(CONCENTRATION_INFUSION, 2) }, // Concentration, Vision
    weaponA2: { itemStatId: 1140, weaponType: 'Spear' },
    weaponB1: { itemStatId: 1140, weaponType: 'Axe', sigilIds: [24607], infusionIds: repeat(CONCENTRATION_INFUSION, 1) }, // Energy
    weaponB2: { itemStatId: 1140, weaponType: 'Shield', sigilIds: [72339], infusionIds: repeat(CONCENTRATION_INFUSION, 1) } // Concentration
  },
  relicId: 101116, // Relic of Febe
  foodId: 91835, // Spiced Peppercorn Cheesecake
  utilityId: 81157 // Magnanimous Maintenance Oil
})

/**
 * "Heal Druid" — gw2skills.net: https://gw2skills.net/editor/?POwEYKNssCGCDjtwIxk3yqVWir3C-DWJYjR9/hkkQITVQMTAdddIEB4vl23sAA-w
 * Traits: Nature Magic 2-3-1 (Wellspring, Windborne Notes, Nature's Vengeance), Beastmastery 2-1-1
 * (Natural Healing, Wilting Strike, Beastly Warden), Druid 1-1-2 (Druidic Clarity, Celestial Shadow,
 * Lingering Light). Skills: Healing Spring (heal), Frost Spirit / Signet of Renewal / Glyph of
 * Alignment (utility), Spirit of Nature (elite). Pets: Brown Bear + Polar Bear. Gear: all
 * Minstrel's. Staff w/ Energy & Frenzy, Mace/Warhorn w/ Energy & Benevolence. Rune of the Water x6.
 * Food: Bowl of Fruit Salad with Mint Garnish. Utility: Bountiful Maintenance Oil. Relic of
 * Karakosa. 20x Healing WvW Infusion.
 */
const healDruid = baseBuild({
  name: 'Heal Druid',
  profession: 'Ranger',
  specializations: [
    { specializationId: 25, chosenTraitIds: [978, 964, 1038] }, // Nature Magic 2-3-1
    { specializationId: 32, chosenTraitIds: [1072, 975, 1945] }, // Beastmastery 2-1-1
    { specializationId: 5, chosenTraitIds: [1868, 2053, 2058] } // Druid 1-1-2
  ],
  skills: { kind: 'standard', heal: 12489, utility: [12497, 12502, 31322], elite: 12569 },
  equippedPetIds: [5, 24], // Brown Bear, Polar Bear
  equipment: {
    helm: { itemStatId: 1123, runeId: 24839, infusionIds: repeat(HEALING_INFUSION, 1) }, // Minstrel's
    shoulders: { itemStatId: 1123, runeId: 24839, infusionIds: repeat(HEALING_INFUSION, 1) },
    chest: { itemStatId: 1123, runeId: 24839, infusionIds: repeat(HEALING_INFUSION, 1) },
    gloves: { itemStatId: 1123, runeId: 24839, infusionIds: repeat(HEALING_INFUSION, 1) },
    leggings: { itemStatId: 1123, runeId: 24839, infusionIds: repeat(HEALING_INFUSION, 1) },
    boots: { itemStatId: 1123, runeId: 24839, infusionIds: repeat(HEALING_INFUSION, 1) },
    backpiece: { itemStatId: 1134, infusionIds: repeat(HEALING_INFUSION, 2) }, // Minstrel's (trinket)
    accessory1: { itemStatId: 1134, infusionIds: repeat(HEALING_INFUSION, 1) },
    accessory2: { itemStatId: 1134, infusionIds: repeat(HEALING_INFUSION, 1) },
    ring1: { itemStatId: 1134, infusionIds: repeat(HEALING_INFUSION, 3) },
    ring2: { itemStatId: 1134, infusionIds: repeat(HEALING_INFUSION, 3) },
    amulet: { itemStatId: 1134, infusionIds: [] },
    weaponA1: { itemStatId: 1123, weaponType: 'Staff', sigilIds: [24607, 82876], infusionIds: repeat(HEALING_INFUSION, 2) }, // Energy, Frenzy
    weaponA2: { itemStatId: 1123, weaponType: 'Staff' },
    weaponB1: { itemStatId: 1123, weaponType: 'Mace', sigilIds: [24607], infusionIds: repeat(HEALING_INFUSION, 1) }, // Energy
    weaponB2: { itemStatId: 1123, weaponType: 'Warhorn', sigilIds: [24584], infusionIds: repeat(HEALING_INFUSION, 1) } // Benevolence
  },
  relicId: 101268, // Relic of Karakosa
  foodId: 91690, // Bowl of Fruit Salad with Mint Garnish
  utilityId: 67528 // Bountiful Maintenance Oil
})

const ATTRIBUTE_TOLERANCE = 3
const HEALTH_TOLERANCE = 15
const PERCENT_TOLERANCE = 0.2

interface ExpectedStats {
  power: number
  toughness: number
  vitality: number
  precision: number
  ferocity: number
  concentration: number
  armor: number
  health: number
  criticalChance: number
  criticalDamage: number
  boonDuration: number
  magicFind: number
}

const CASES: Array<{ build: Build; expected: ExpectedStats }> = [
  {
    build: dpsStripRenegade,
    // gw2skills.net Attributes panel + live in-game hero-panel check, both 2026-08-13.
    expected: {
      power: 2830, toughness: 1000, vitality: 1561, precision: 1468, ferocity: 1373,
      concentration: 0, armor: 2271, health: 21532,
      criticalChance: 60.29, criticalDamage: 241.53, boonDuration: 0, magicFind: 20
    }
  },
  {
    build: shatteredAegisFirebrand,
    // gw2skills.net Attributes panel, 2026-08-13 (not separately in-game-verified, unlike the
    // Renegade above — cross-checked here only against this app's own computed output).
    expected: {
      power: 2328, toughness: 1669, vitality: 2208, precision: 1036, ferocity: 36,
      concentration: 975, armor: 2940, health: 23725,
      criticalChance: 6.71, criticalDamage: 152.4, boonDuration: 100, magicFind: 20
    }
  },
  {
    build: healDruid,
    expected: {
      power: 1000, toughness: 2172, vitality: 1633, precision: 1000, ferocity: 0,
      concentration: 823, armor: 3290, health: 22252,
      criticalChance: 5, criticalDamage: 150, boonDuration: 79.87, magicFind: 20
    }
  }
]

describe('Tier 3 — hand-verified reference builds', () => {
  for (const { build, expected } of CASES) {
    describe(build.name, () => {
      const { attributes, derived } = computeCharacterStats(build, gameData, DEFAULT_COMBAT_STATE)

      it('matches every flat core attribute', () => {
        for (const [key, target] of [
          ['power', expected.power],
          ['toughness', expected.toughness],
          ['vitality', expected.vitality],
          ['precision', expected.precision],
          ['ferocity', expected.ferocity],
          ['concentration', expected.concentration]
        ] as const) {
          expect(Math.abs(attributes[key] - target), `${key}: expected ~${target}, got ${attributes[key]}`).toBeLessThanOrEqual(ATTRIBUTE_TOLERANCE)
        }
      })

      it('matches armor and health', () => {
        expect(Math.abs(derived.armor - expected.armor), `armor: expected ~${expected.armor}, got ${derived.armor}`).toBeLessThanOrEqual(ATTRIBUTE_TOLERANCE)
        expect(Math.abs(derived.health - expected.health), `health: expected ~${expected.health}, got ${derived.health}`).toBeLessThanOrEqual(HEALTH_TOLERANCE)
      })

      it('matches every derived percentage', () => {
        for (const [key, target] of [
          ['criticalChance', expected.criticalChance],
          ['criticalDamage', expected.criticalDamage],
          ['boonDuration', expected.boonDuration],
          ['magicFind', expected.magicFind]
        ] as const) {
          expect(Math.abs(derived[key] - target), `${key}: expected ~${target}, got ${derived[key]}`).toBeLessThanOrEqual(PERCENT_TOLERANCE)
        }
      })
    })
  }
})
