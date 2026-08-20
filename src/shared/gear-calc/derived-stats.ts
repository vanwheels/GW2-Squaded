import type { Build, EquipmentSlotKey, GameData, ProfessionId } from '../types'
import {
  activeConsumableConversions,
  addPoints,
  applyConversions,
  boonDurationPercent,
  computeGearAttributeTotals,
  conditionDurationPercent,
  emptyTotals,
  magicFindPercent
} from './attribute-totals'
import { RUNE_SLOT_KEYS } from './upgrade-slots'
import {
  combatStatePoints,
  CURATED_RELIC_DAMAGE_BONUSES,
  DEFAULT_COMBAT_STATE,
  flatCritChanceTraitBonus,
  fullEnduranceCritChanceTraitBonus,
  furyCritChanceTraitBonus,
  FURY_CRITICAL_CHANCE_PERCENT,
  healthThresholdConsumableBonus,
  highHealthCritChanceTraitBonus,
  kallaFervorPercentPerStack,
  mechanicActiveCritChanceTraitBonus,
  risingMomentumMovementSpeedPercent,
  type CombatState
} from './combat-state'
import { applyTraitBonuses, maxHealthPercentTraitBonus } from './trait-attributes'

/** A level-80 character's base attributes before any gear/upgrade contribution. Precision/
 *  Toughness/Vitality/Power all start at 1000 (confirmed via wiki.guildwars2.com/wiki/Ferocity,
 *  wiki.guildwars2.com/wiki/Precision — both formulas below are stated relative to a 1000
 *  baseline); every other core attribute starts at 0. */
export const BASE_ATTRIBUTES: Record<string, number> = {
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
export const BASE_CRITICAL_CHANCE_PERCENT = 5
export const PRECISION_PER_CRITICAL_CHANCE_PERCENT = 21

// wiki.guildwars2.com/wiki/Ferocity: "every 15 points of ferocity adds 1% to critical damage",
// base critical damage (0 bonus Ferocity) is 150% per wiki.guildwars2.com/wiki/Critical_hit.
export const BASE_CRITICAL_DAMAGE_PERCENT = 150
export const FEROCITY_PER_CRITICAL_DAMAGE_PERCENT = 15

// wiki.guildwars2.com/wiki/Health: base health at level 80 (before Vitality), by profession
// tier — confirmed live against this app's own Revenant example (5,922 + 1000*10 = 15,922,
// matching a reference screenshot's baseline Health value, see TODO.md).
export const HEALTH_PER_VITALITY = 10
export const BASE_HEALTH_BY_PROFESSION: Record<ProfessionId, number> = {
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

export type ArmorWeightClass = 'Light' | 'Medium' | 'Heavy'

// wiki.guildwars2.com/wiki/Profession: "scholars wear light armor, adventurers wear medium
// armor, and soldiers wear heavy armor" (Scholars: Elementalist/Mesmer/Necromancer; Adventurers:
// Engineer/Ranger/Thief; Soldiers: Guardian/Revenant/Warrior) — a fixed profession-design rule,
// not a balance number, so not expected to drift between patches.
export const WEIGHT_CLASS_BY_PROFESSION: Record<ProfessionId, ArmorWeightClass> = {
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

/** Every armor slot's Defense rating summed unconditionally (not gated on `itemStatId !== null`
 *  like `armorDefenseTotal` above) — for the Gear Optimizer (`gear-optimize.ts`), which always
 *  assigns every one of the 6 armor slots a stat combo by construction, so by the time a result
 *  exists Defense is already at this fixed total regardless of which specific combos were chosen. */
export function fullArmorDefense(weightClass: ArmorWeightClass): number {
  const perPiece = ARMOR_PIECE_DEFENSE[weightClass]
  return RUNE_SLOT_KEYS.reduce((sum, slotKey) => sum + (perPiece[slotKey] ?? 0), 0)
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
  /** Outgoing strike-damage-% bonus: `CombatState.relicActive`'s curated relic bonus (0 when no
   *  curated relic/inactive, see `CURATED_RELIC_DAMAGE_BONUSES`) plus Kalla's Fervor's per-stack
   *  strike-damage share (`CombatState.kallaFervorStacks`, 2%/stack or 3%/stack with Lasting Legacy
   *  chosen — see `kallaFervorPercentPerStack` in `combat-state.ts`). */
  outgoingDamagePercent: number
  /** Outgoing condition-damage-% bonus — distinct from the raw `ConditionDamage` attribute total.
   *  Currently only Kalla's Fervor's per-stack condition-damage share contributes (see
   *  `outgoingDamagePercent`'s doc comment for the Lasting Legacy upgrade). */
  outgoingConditionDamagePercent: number
  /** Life-steal-%, first/only field for this stat anywhere in the app — currently only Kalla's
   *  Fervor's per-stack life-steal share contributes (see `outgoingDamagePercent`'s doc comment for
   *  the Lasting Legacy upgrade). */
  lifeStealPercent: number
  /** Movement-speed-%, first/only field for this stat anywhere in the app — currently only
   *  Revenant/Herald's Rising Momentum contributes, scaling with `CombatState.upkeepPoints` (see
   *  `risingMomentumMovementSpeedPercent` in `combat-state.ts`). 0 for every build without that
   *  trait chosen. */
  movementSpeedPercent: number
}

export interface CharacterStats {
  attributes: CharacterAttributes
  derived: DerivedStats
}

export function computeCharacterStats(
  build: Build,
  gameData: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'infusions' | 'runes' | 'sigils' | 'food' | 'utility' | 'traits' | 'legends'>,
  combatState: CombatState = DEFAULT_COMBAT_STATE
): CharacterStats {
  const gearTotals = computeGearAttributeTotals(build, gameData)
  const traitsById = new Map(gameData.traits.map((t) => [t.id, t]))
  const foodById = new Map(gameData.food.map((f) => [f.id, f]))
  const utilityById = new Map(gameData.utility.map((u) => [u.id, u]))
  const combatPoints = combatStatePoints(build, combatState, traitsById)

  // Single unified totals: base + gear/rune/food/utility + combat state, then every active
  // trait's flat AttributeAdjust bonus and BuffConversion (e.g. Revenant/Salvation's "Life
  // Attunement": +120 Healing Power, 7% of Healing Power -> Concentration) applied on top —
  // traits weren't factored into attribute totals anywhere before this, confirmed missing via a
  // user cross-check against gw2skills.net. Conversions need the *final* source-attribute value
  // (after gear etc.), so `applyTraitBonuses` must run last. See `trait-attributes.ts`.
  const totals = emptyTotals()
  for (const [k, v] of Object.entries(BASE_ATTRIBUTES)) addPoints(totals, k, v)
  for (const [k, v] of Object.entries(gearTotals.points)) addPoints(totals, k, v)
  for (const [k, v] of Object.entries(combatPoints)) addPoints(totals, k, v)
  totals.bonusPercent = { ...gearTotals.bonusPercent }
  // Food/utility "Gain X Equal to N% of Your Y" conversions (Superior Sharpening Stone, Tuning
  // Crystals — the dominant WvW Utility-consumable shape, see `AttributeBonusText`'s doc comment)
  // resolve against this same base+gear+combat snapshot, before trait bonuses stack on top —
  // `addBonus` intentionally no-ops on these during `computeGearAttributeTotals` since a
  // single-pass point add can't see the source attribute's final value yet.
  applyConversions(totals, activeConsumableConversions(build, foodById, utilityById))
  for (const [k, v] of Object.entries(healthThresholdConsumableBonus(build, combatState.healthTier, foodById, utilityById))) addPoints(totals, k, v)
  applyTraitBonuses(totals, build, traitsById, gameData.legends)

  const attributes: CharacterAttributes = {
    power: totals.points.Power ?? 0,
    toughness: totals.points.Toughness ?? 0,
    vitality: totals.points.Vitality ?? 0,
    precision: totals.points.Precision ?? 0,
    ferocity: totals.points.CritDamage ?? 0,
    healingPower: totals.points.Healing ?? 0,
    conditionDamage: totals.points.ConditionDamage ?? 0,
    expertise: totals.points.ConditionDuration ?? 0,
    concentration: totals.points.BoonDuration ?? 0
  }

  const weightClass = WEIGHT_CLASS_BY_PROFESSION[build.profession]
  const defense = weightClass ? armorDefenseTotal(build, weightClass) : 0
  const baseHealth = BASE_HEALTH_BY_PROFESSION[build.profession] ?? 0
  const kallaFervorPerStack = kallaFervorPercentPerStack(build, traitsById)

  const maxHealthPercent = maxHealthPercentTraitBonus(build, traitsById)

  const derived: DerivedStats = {
    armor: attributes.toughness + defense,
    health: (baseHealth + attributes.vitality * HEALTH_PER_VITALITY) * (1 + maxHealthPercent / 100),
    criticalChance:
      BASE_CRITICAL_CHANCE_PERCENT +
      (attributes.precision - 1000) / PRECISION_PER_CRITICAL_CHANCE_PERCENT +
      (combatState.furyActive
        ? FURY_CRITICAL_CHANCE_PERCENT + furyCritChanceTraitBonus(build, traitsById)
        : 0) +
      fullEnduranceCritChanceTraitBonus(build, traitsById, combatState.fullEnduranceActive) +
      flatCritChanceTraitBonus(build, traitsById) +
      highHealthCritChanceTraitBonus(build, combatState.healthTier, traitsById) +
      (combatState.mechanicActive ? mechanicActiveCritChanceTraitBonus(build, traitsById) : 0),
    criticalDamage: BASE_CRITICAL_DAMAGE_PERCENT + attributes.ferocity / FEROCITY_PER_CRITICAL_DAMAGE_PERCENT,
    boonDuration: boonDurationPercent(totals),
    conditionDuration: conditionDurationPercent(totals),
    magicFind: magicFindPercent(totals),
    outgoingDamagePercent:
      (combatState.relicActive && build.relicId !== null ? (CURATED_RELIC_DAMAGE_BONUSES[build.relicId] ?? 0) : 0) +
      combatState.kallaFervorStacks * kallaFervorPerStack.strikeDamage,
    outgoingConditionDamagePercent: combatState.kallaFervorStacks * kallaFervorPerStack.conditionDamage,
    lifeStealPercent: combatState.kallaFervorStacks * kallaFervorPerStack.lifeSteal,
    movementSpeedPercent: risingMomentumMovementSpeedPercent(build, combatState.upkeepPoints, traitsById)
  }

  return { attributes, derived }
}
