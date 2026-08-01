import type { Build, EquipmentSlotKey, GameData, ProfessionId } from '../types'
import {
  boonDurationPercent,
  computeGearAttributeTotals,
  conditionDurationPercent,
  magicFindPercent
} from './attribute-totals'
import { RUNE_SLOT_KEYS } from './upgrade-slots'
import {
  combatStatePoints,
  CURATED_RELIC_DAMAGE_BONUSES,
  DEFAULT_COMBAT_STATE,
  FURY_CRITICAL_CHANCE_PERCENT,
  type CombatState
} from './combat-state'

/** A level-80 character's base attributes before any gear/upgrade contribution. Precision/
 *  Toughness/Vitality/Power all start at 1000 (confirmed via wiki.guildwars2.com/wiki/Ferocity,
 *  wiki.guildwars2.com/wiki/Precision — both formulas below are stated relative to a 1000
 *  baseline); every other core attribute starts at 0. */
const BASE_ATTRIBUTES: Record<string, number> = {
  Power: 1000,
  Precision: 1000,
  Toughness: 1000,
  Vitality: 1000,
  CritDamage: 0,
  Healing: 0,
  ConditionDamage: 0,
  BoonDuration: 0,
  ConditionDuration: 0
}

// wiki.guildwars2.com/wiki/Precision: "Critical Chance (%) = 5 + [ (Precision - 1000) / 21 ]"
const BASE_CRITICAL_CHANCE_PERCENT = 5
const PRECISION_PER_CRITICAL_CHANCE_PERCENT = 21

// wiki.guildwars2.com/wiki/Ferocity: "every 15 points of ferocity adds 1% to critical damage",
// base critical damage (0 bonus Ferocity) is 150% per wiki.guildwars2.com/wiki/Critical_hit.
const BASE_CRITICAL_DAMAGE_PERCENT = 150
const FEROCITY_PER_CRITICAL_DAMAGE_PERCENT = 15

// wiki.guildwars2.com/wiki/Health: base health at level 80 (before Vitality), by profession
// tier — confirmed live against this app's own Revenant example (5,922 + 1000*10 = 15,922,
// matching a reference screenshot's baseline Health value, see TODO.md).
const HEALTH_PER_VITALITY = 10
const BASE_HEALTH_BY_PROFESSION: Record<ProfessionId, number> = {
  Warrior: 9212,
  Necromancer: 9212,
  Revenant: 5922,
  Engineer: 5922,
  Ranger: 5922,
  Mesmer: 5922,
  Guardian: 1645,
  Thief: 1645,
  Elementalist: 1645
}

type ArmorWeightClass = 'Light' | 'Medium' | 'Heavy'

// wiki.guildwars2.com/wiki/Profession: "scholars wear light armor, adventurers wear medium
// armor, and soldiers wear heavy armor" (Scholars: Elementalist/Mesmer/Necromancer; Adventurers:
// Engineer/Ranger/Thief; Soldiers: Guardian/Revenant/Warrior) — a fixed profession-design rule,
// not a balance number, so not expected to drift between patches.
const WEIGHT_CLASS_BY_PROFESSION: Record<ProfessionId, ArmorWeightClass> = {
  Guardian: 'Heavy',
  Revenant: 'Heavy',
  Warrior: 'Heavy',
  Engineer: 'Medium',
  Ranger: 'Medium',
  Thief: 'Medium',
  Elementalist: 'Light',
  Mesmer: 'Light',
  Necromancer: 'Light'
}

/**
 * Per-armor-piece Defense rating at level 80 Ascended (matches this app's existing Ascended-only
 * assumption, see `RARITY` in attribute-totals.ts), quoted directly from the wiki's "Armor class"
 * page defense-rating table (fetched this session). This is a *separate* attribute from
 * `Toughness` — `Armor (attribute) = Defense + Toughness` per wiki.guildwars2.com/wiki/Armor_(attribute)
 * — and unlike Toughness (which comes from a chosen stat combo's `multiplier`/`value`), Defense is
 * inherent to the physical armor piece's weight class, so it's gated on a slot having *any*
 * stat combo chosen (`itemStatId !== null`, "this slot has an item") rather than depending on
 * which stat combo was picked.
 */
const ARMOR_PIECE_DEFENSE: Record<ArmorWeightClass, Partial<Record<EquipmentSlotKey, number>>> = {
  Heavy: { helm: 127, shoulders: 127, chest: 381, gloves: 191, leggings: 254, boots: 191 },
  Medium: { helm: 102, shoulders: 102, chest: 355, gloves: 165, leggings: 229, boots: 165 },
  Light: { helm: 77, shoulders: 77, chest: 330, gloves: 140, leggings: 203, boots: 140 }
}

function armorDefenseTotal(build: Build, weightClass: ArmorWeightClass): number {
  const perPiece = ARMOR_PIECE_DEFENSE[weightClass]
  let total = 0
  for (const slotKey of RUNE_SLOT_KEYS) {
    if (build.equipment[slotKey]?.itemStatId != null) total += perPiece[slotKey] ?? 0
  }
  return total
}

/** Raw (non-percentage) attribute totals for the stats panel's left column — base character
 *  value plus every gear/rune/food/utility contribution. */
export interface CharacterAttributes {
  power: number
  toughness: number
  vitality: number
  precision: number
  ferocity: number
  healingPower: number
  conditionDamage: number
  expertise: number
  concentration: number
}

/** Derived/converted stats for the stats panel's right column. */
export interface DerivedStats {
  armor: number
  health: number
  criticalChance: number
  criticalDamage: number
  boonDuration: number
  conditionDuration: number
  magicFind: number
  /** Flat outgoing-damage-% bonus from `CombatState.relicActive`, when the equipped relic has a
   *  curated entry — 0 otherwise. See `CURATED_RELIC_DAMAGE_BONUSES` in combat-state.ts. */
  outgoingDamagePercent: number
}

export interface CharacterStats {
  attributes: CharacterAttributes
  derived: DerivedStats
}

export function computeCharacterStats(
  build: Build,
  gameData: Pick<GameData, 'itemStats' | 'infusions' | 'runes' | 'food' | 'utility'>,
  combatState: CombatState = DEFAULT_COMBAT_STATE
): CharacterStats {
  const gearTotals = computeGearAttributeTotals(build, gameData)
  const combatPoints = combatStatePoints(build, combatState)
  const total = (key: string): number =>
    (BASE_ATTRIBUTES[key] ?? 0) + (gearTotals.points[key] ?? 0) + (combatPoints[key] ?? 0)

  const attributes: CharacterAttributes = {
    power: total('Power'),
    toughness: total('Toughness'),
    vitality: total('Vitality'),
    precision: total('Precision'),
    ferocity: total('CritDamage'),
    healingPower: total('Healing'),
    conditionDamage: total('ConditionDamage'),
    expertise: total('ConditionDuration'),
    concentration: total('BoonDuration')
  }

  const weightClass = WEIGHT_CLASS_BY_PROFESSION[build.profession]
  const defense = weightClass ? armorDefenseTotal(build, weightClass) : 0
  const baseHealth = BASE_HEALTH_BY_PROFESSION[build.profession] ?? 0

  const derived: DerivedStats = {
    armor: attributes.toughness + defense,
    health: baseHealth + attributes.vitality * HEALTH_PER_VITALITY,
    criticalChance:
      BASE_CRITICAL_CHANCE_PERCENT +
      (attributes.precision - 1000) / PRECISION_PER_CRITICAL_CHANCE_PERCENT +
      (combatState.furyActive ? FURY_CRITICAL_CHANCE_PERCENT : 0),
    criticalDamage: BASE_CRITICAL_DAMAGE_PERCENT + attributes.ferocity / FEROCITY_PER_CRITICAL_DAMAGE_PERCENT,
    boonDuration: boonDurationPercent(gearTotals),
    conditionDuration: conditionDurationPercent(gearTotals),
    magicFind: magicFindPercent(gearTotals),
    outgoingDamagePercent:
      combatState.relicActive && build.relicId !== null ? (CURATED_RELIC_DAMAGE_BONUSES[build.relicId] ?? 0) : 0
  }

  return { attributes, derived }
}
