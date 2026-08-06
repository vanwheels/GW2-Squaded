import type { AttributeBonusText, Build, Consumable, EquipmentSlotKey, GameData, ItemStat, ItemStatLegalIds, Rune, Sigil } from '../types'
import { RUNE_SLOT_KEYS } from './upgrade-slots'

/**
 * attribute_adjustment constants for level-80 Exotic/Ascended gear, quoted directly from the
 * wiki's `API:2/itemstats` "Notes" table (wiki.guildwars2.com/wiki/API:2/itemstats, fetched raw
 * wikitext this session — not reconstructed from memory). Formula (same source): an item's
 * contribution to an attribute is `attribute_adjustment * multiplier + value`, where multiplier
 * and value come from the equipped stat combo's `ItemStat.attributes`.
 */
const ATTRIBUTE_ADJUSTMENT = {
  armorLight: { exotic: 128.04, ascended: 134.442 }, // Shoulders / Gloves / Boots
  armorHelm: { exotic: 170.72, ascended: 179.256 },
  armorLeggings: { exotic: 256.08, ascended: 268.884 },
  armorCoat: { exotic: 384.12, ascended: 403.326 },
  back: { exotic: 85.36, ascended: 89.628 },
  trinketAccessory: { exotic: 213.4, ascended: 224.07 },
  trinketRing: { exotic: 256.08, ascended: 268.884 },
  trinketAmulet: { exotic: 341.44, ascended: 358.512 },
  weaponOneHanded: { exotic: 341.44, ascended: 358.512 },
  weaponTwoHanded: { exotic: 682.88, ascended: 717.024 }
} as const

export type AdjustmentKey = keyof typeof ATTRIBUTE_ADJUSTMENT

/**
 * Every equipment slot this app models defaults to level-80 Ascended, the realistic gear tier
 * for the target WvW meta comp (see TODO.md) — not user-selectable yet (would need a rarity
 * field on `EquipmentSlot`).
 *
 * Armor/trinket slots map to a fixed adjustment key. Weapon slots are resolved dynamically in
 * `computeGearAttributeTotals` instead (see below) now that `EquipmentSlot.weaponType` exists.
 */
export const SLOT_ADJUSTMENT_KEY: Partial<Record<EquipmentSlotKey, AdjustmentKey>> = {
  helm: 'armorHelm',
  shoulders: 'armorLight',
  chest: 'armorCoat',
  gloves: 'armorLight',
  leggings: 'armorLeggings',
  boots: 'armorLight',
  backpiece: 'back',
  accessory1: 'trinketAccessory',
  accessory2: 'trinketAccessory',
  ring1: 'trinketRing',
  ring2: 'trinketRing',
  amulet: 'trinketAmulet'
}

const UNDERWATER_WEAPON_SLOTS: EquipmentSlotKey[] = ['weaponU1', 'weaponU2']

/**
 * The 4 equipment slots whose legal stat-combo ids come from `ItemStatLegalIds.trinket` — every
 * other slot (armor + every weapon slot) draws from `ItemStatLegalIds.armorWeapon` instead. The
 * two lists are **disjoint**: a stat combo with the same display name (e.g. "Minstrel's") is a
 * genuinely different API entry per category — the trinket entry carries an extra flat `value`
 * bonus on top of the same `multiplier` that the armor/weapon entry doesn't have (confirmed live
 * against gw2skills.net's own per-item tooltips, 2026-08-02: e.g. Minstrel's Toughness is
 * `adjustment * 0.3` on a helm/weapon but `adjustment * 0.3 + 25` on a ring/amulet/accessory/back).
 * See `resolveItemStatId` for why this distinction matters beyond just which options are offered.
 */
const TRINKET_CATEGORY_SLOT_KEYS = new Set<EquipmentSlotKey>(['backpiece', 'accessory1', 'accessory2', 'ring1', 'ring2', 'amulet'])

export function itemStatCategoryForSlot(slotKey: EquipmentSlotKey): keyof ItemStatLegalIds {
  return TRINKET_CATEGORY_SLOT_KEYS.has(slotKey) ? 'trinket' : 'armorWeapon'
}

/**
 * Resolves a slot's stored `itemStatId` to the id that's actually legal for that slot's category,
 * correcting builds saved before `EquipmentEditor`'s stat-prefix picker was category-aware
 * (2026-08-02 fix): the picker used to offer one shared id per combo name across every slot type,
 * which for combos with a trinket-only variant (see `TRINKET_CATEGORY_SLOT_KEYS`'s doc comment)
 * meant an armor/weapon slot could end up with the trinket-flavored id saved in `itemStatId`,
 * silently inflating every affected attribute. This is a pure read-time correction (never mutates
 * the stored build) — every stat-total consumer (`computeGearAttributeTotals`) and the picker's
 * own displayed selection resolve through this, so already-saved builds self-heal the moment
 * they're computed or viewed, with no separate migration step. A stored id that's already legal
 * for its slot, or that has no same-named counterpart in the correct category, passes through
 * unchanged.
 */
export function resolveItemStatId(
  itemStatId: number,
  statsById: Map<number, ItemStat>,
  legalIds: ItemStatLegalIds,
  category: keyof ItemStatLegalIds
): number {
  const stat = statsById.get(itemStatId)
  if (!stat) return itemStatId
  const legalSet = legalIds[category]
  if (legalSet.includes(itemStatId)) return itemStatId
  for (const [id, candidate] of statsById) {
    if (candidate.name === stat.name && legalSet.includes(id)) return id
  }
  return itemStatId
}

/**
 * Unlike the boon/condition calculator (`sources.ts`), which deliberately counts both weapon-swap
 * sets' *skills* as always-available (a player carries both sets into a fight and can swap
 * anytime), a raw attribute total is a snapshot of what's affecting the character right now — only
 * one weapon (and, underwater, only one of the 2 underwater sets) is actually equipped at a time.
 * `build.environment` picks land vs. underwater; `activeWeaponSet`/`activeUnderwaterSet` pick which
 * of that environment's 2 sets. Non-weapon slots (armor/trinkets) aren't swap-setted, so they're
 * always active.
 */
export function isActiveWeaponSlot(slotKey: EquipmentSlotKey, build: Build): boolean {
  if (!slotKey.startsWith('weapon')) return true
  if (build.environment === 'underwater') {
    return slotKey === (build.activeUnderwaterSet === 'U1' ? 'weaponU1' : 'weaponU2')
  }
  return slotKey === 'weaponA1' || slotKey === 'weaponA2'
    ? build.activeWeaponSet === 'A'
    : slotKey === 'weaponB1' || slotKey === 'weaponB2'
      ? build.activeWeaponSet === 'B'
      : false
}

export const RARITY: 'exotic' | 'ascended' = 'ascended'

/**
 * Gear/upgrade-derived attribute totals. `points` holds the 9 core GW2 attributes, keyed by their
 * `ItemStat`/API attribute name — including the two that reuse their *derived percentage's* name
 * as the raw-stat key (`BoonDuration` = raw Concentration points, `ConditionDuration` = raw
 * Expertise points; `CritDamage` = raw Ferocity points), same convention the game's own item data
 * uses (confirmed: `data/game-data/itemstats.json` has no separate "Concentration"/"Expertise"/
 * "Ferocity" attribute keys at all). `bonusPercent` holds rune/food/utility bonus text that's
 * already expressed as a direct percentage (e.g. "+5% Boon Duration") rather than raw attribute
 * points — these add on top of the points-derived percentage rather than being converted again.
 */
export interface AttributeTotals {
  points: Record<string, number>
  bonusPercent: {
    boonDuration: number
    conditionDuration: number
    magicFind: number
  }
}

export function emptyTotals(): AttributeTotals {
  return { points: {}, bonusPercent: { boonDuration: 0, conditionDuration: 0, magicFind: 0 } }
}

/**
 * Land weapon slots (`weaponA1/A2/B1/B2`) always use the one-handed constant, even when a
 * two-handed weapon is equipped: `EquipmentEditor` mirrors a two-handed weapon's `weaponType`+
 * `itemStatId` onto BOTH its main- and off-hand slot keys, and `weaponOneHanded.ascended * 2 ===
 * weaponTwoHanded.ascended` exactly (same for exotic) — so crediting the one-handed constant to
 * each of the two mirrored slots already sums to the correct two-handed total, no special-casing
 * needed. Underwater slots (`weaponU1/U2`) are single, non-paired slots and every aquatic weapon
 * is confirmed two-handed, so they always use the two-handed constant directly.
 */
export function weaponAdjustmentKey(slotKey: EquipmentSlotKey): AdjustmentKey {
  return UNDERWATER_WEAPON_SLOTS.includes(slotKey) ? 'weaponTwoHanded' : 'weaponOneHanded'
}

export function addPoints(totals: AttributeTotals, attribute: string, value: number): void {
  totals.points[attribute] = (totals.points[attribute] ?? 0) + value
}

/**
 * One stat combo's raw attribute-point contribution when equipped in a slot of the given
 * adjustment tier — the same `adjustment * multiplier + value` formula
 * `computeGearAttributeTotals` applies per-slot, factored out so the Gear Optimizer's search
 * (`gear-optimize.ts`) can precompute each legal combo's contribution once per slot without
 * duplicating the formula.
 */
export function statComboContribution(stat: ItemStat, adjustmentKey: AdjustmentKey): AttributeTotals {
  const totals = emptyTotals()
  const adjustment = ATTRIBUTE_ADJUSTMENT[adjustmentKey][RARITY]
  for (const attr of stat.attributes) addPoints(totals, attr.attribute, adjustment * attr.multiplier + attr.value)
  return totals
}

/**
 * Free-text attribute name (from `Rune`/`Consumable` bonus lines, e.g. "Ferocity", "Concentration",
 * case-insensitive) -> the `ItemStat`/API attribute key it corresponds to. Only the 9 core GW2
 * combat attributes are mapped; everything else (Karma, Gold from Monsters, per-faction damage
 * bonuses, "on Kill"/conditional procs, seasonal Magic Find, per-condition duration bonuses like
 * "Burning Duration") is intentionally left unmapped — confirmed via a full scan of
 * data/game-data/{runes,food,utility}.json's bonus attribute strings (see docs/game-data.md) that
 * these fall well outside the stats panel's confirmed scope (aggregate Boon/Condition Duration
 * only, not per-condition). Unmapped bonuses stay display-only (already shown via tooltip text
 * from a prior session) rather than being guessed into a bucket.
 */
const FLAT_ATTRIBUTE_ALIASES: Record<string, string> = {
  power: 'Power',
  precision: 'Precision',
  toughness: 'Toughness',
  vitality: 'Vitality',
  ferocity: 'CritDamage',
  healing: 'Healing',
  'healing power': 'Healing',
  'condition damage': 'ConditionDamage',
  concentration: 'BoonDuration',
  expertise: 'ConditionDuration'
}

/** The 9 core GW2 combat attributes, by their `ItemStat`-convention key — what a "+N to All
 *  Stats"/"+N to All Attributes" bonus (e.g. Superior Rune of Divinity, Superior Sigil of the
 *  Stars) distributes across. */
export const ALL_CORE_ATTRIBUTE_KEYS = [
  'Power',
  'Precision',
  'Toughness',
  'Vitality',
  'CritDamage',
  'Healing',
  'ConditionDamage',
  'BoonDuration',
  'ConditionDuration'
]

const ALL_STATS_ALIASES = new Set(['to all stats', 'to all attributes'])

/** Raw `ItemStat`/API attribute key -> the player-facing name it's shown as on the Stats panel
 *  (`StatsPanel.tsx`) — the 3 that rename (`CritDamage`/`Healing`/`BoonDuration`/`ConditionDuration`)
 *  match the same raw-key convention documented on `AttributeTotals` above. Used anywhere a raw
 *  per-item point breakdown is shown to the user (e.g. the gear-slot picker's hover tooltip). */
export const ATTRIBUTE_DISPLAY_NAME: Record<string, string> = {
  Power: 'Power',
  Precision: 'Precision',
  Toughness: 'Toughness',
  Vitality: 'Vitality',
  CritDamage: 'Ferocity',
  Healing: 'Healing Power',
  ConditionDamage: 'Condition Damage',
  BoonDuration: 'Concentration',
  ConditionDuration: 'Expertise'
}

/** Free-text attribute name for a bonus already expressed as a direct percentage (e.g. "+5% Boon
 *  Duration", "+20% Magic Find") -> which `bonusPercent` bucket it adds to. Exact-match only (not
 *  substring) so conditional variants like "Magic Find while under the Effect of a Boon" or
 *  "Magic Find during Lunar New Year" are correctly excluded as not being a build-always-on bonus. */
const PERCENT_BONUS_ALIASES: Record<string, keyof AttributeTotals['bonusPercent']> = {
  'boon duration': 'boonDuration',
  'condition duration': 'conditionDuration',
  'magic find': 'magicFind'
}

/** A `Rune`/`Consumable` bonus line's contribution — exported so `gear-optimize.ts` can fold a
 *  candidate food/utility choice's bonuses into a search option's delta the same way runes/food/
 *  utility already contribute to `computeGearAttributeTotals` below. */
export function addBonus(totals: AttributeTotals, bonus: AttributeBonusText): void {
  if (bonus.attribute === null || bonus.value === null) return
  const key = bonus.attribute.trim().toLowerCase()

  if (bonus.isPercent) {
    const percentKey = PERCENT_BONUS_ALIASES[key]
    if (percentKey) totals.bonusPercent[percentKey] += bonus.value
    return
  }

  if (ALL_STATS_ALIASES.has(key)) {
    for (const attr of ALL_CORE_ATTRIBUTE_KEYS) addPoints(totals, attr, bonus.value)
    return
  }

  const attr = FLAT_ATTRIBUTE_ALIASES[key]
  if (attr) addPoints(totals, attr, bonus.value)
}

/**
 * Runes are stage-gated by how many armor pieces carry the *same* rune id (standard GW2
 * mechanic): equipping a rune on 3 pieces unlocks stages 1-3 (`bonuses[0..2]`), not stage 3 three
 * times. Counts every armor slot independently (not deduped by stat combo), matching the 6
 * armor slots that carry a rune slot (`RUNE_SLOT_KEYS`).
 */
function addRuneBonuses(totals: AttributeTotals, build: Build, runesById: Map<number, Rune>): void {
  const countByRuneId = new Map<number, number>()
  for (const slotKey of RUNE_SLOT_KEYS) {
    const runeId = build.equipment[slotKey]?.runeId
    if (runeId != null) countByRuneId.set(runeId, (countByRuneId.get(runeId) ?? 0) + 1)
  }
  for (const [runeId, count] of countByRuneId) {
    const rune = runesById.get(runeId)
    if (!rune) continue
    for (const bonus of rune.bonuses.slice(0, count)) addBonus(totals, bonus)
  }
}

/**
 * Infusions are optional (this function is called from several places, some without an
 * `infusions` list handy) and default to `[]` so gear-only totals still work — infusions simply
 * don't contribute in that case, same as an unequipped slot.
 */
export function computeGearAttributeTotals(
  build: Build,
  gameData: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'infusions' | 'runes' | 'sigils' | 'food' | 'utility'>
): AttributeTotals {
  const statsById = new Map<number, ItemStat>(gameData.itemStats.map((s) => [s.id, s]))
  const infusionsById = new Map(gameData.infusions.map((i) => [i.id, i]))
  const runesById = new Map(gameData.runes.map((r) => [r.id, r]))
  const sigilsById = new Map<number, Sigil>(gameData.sigils.map((s) => [s.id, s]))
  const foodById = new Map<number, Consumable>(gameData.food.map((f) => [f.id, f]))
  const utilityById = new Map<number, Consumable>(gameData.utility.map((u) => [u.id, u]))
  const totals = emptyTotals()

  for (const slotKey of Object.keys(build.equipment) as EquipmentSlotKey[]) {
    const slot = build.equipment[slotKey]
    if (!slot) continue
    if (!isActiveWeaponSlot(slotKey, build)) continue

    const isWeaponSlot = slotKey.startsWith('weapon')
    const weaponEquipped = !isWeaponSlot || Boolean(slot.weaponType)

    if (weaponEquipped && slot.itemStatId !== null) {
      const adjustmentKey = SLOT_ADJUSTMENT_KEY[slotKey] ?? weaponAdjustmentKey(slotKey)
      const resolvedId = resolveItemStatId(slot.itemStatId, statsById, gameData.itemStatLegalIds, itemStatCategoryForSlot(slotKey))
      const stat = statsById.get(resolvedId)
      if (stat) {
        const adjustment = ATTRIBUTE_ADJUSTMENT[adjustmentKey][RARITY]
        for (const attr of stat.attributes) {
          addPoints(totals, attr.attribute, adjustment * attr.multiplier + attr.value)
        }
      }
    }

    // Infusion attribute names (see Infusion in game-data.ts) are confirmed to match ItemStat
    // attribute names verbatim (Power, Toughness, Vitality, Precision, Healing, ConditionDamage,
    // BoonDuration, ConditionDuration — all 8 core-attribute WvW infusions), so no name mapping
    // is needed here, unlike Rune.bonuses' free-text attribute names.
    if (weaponEquipped) {
      for (const infusionId of slot.infusionIds ?? []) {
        if (infusionId === null) continue
        const infusion = infusionsById.get(infusionId)
        if (!infusion?.attribute || infusion.value === null) continue
        addPoints(totals, infusion.attribute, infusion.value)
      }

      // Only the handful of "stat sigils" (see `Sigil.bonuses` doc comment) contribute here —
      // procs/stacking sigils parse to `{attribute: null}` and `addBonus` no-ops on those. Like
      // the itemStat/infusion contributions above, this only runs for `isActiveWeaponSlot` slots
      // reached this loop iteration — i.e. a sigil on the currently-stowed weapon set (or the
      // underwater set while on land, etc.) does not contribute, matching how this function
      // already treats every other per-weapon-slot bonus as active-set-only.
      for (const sigilId of slot.sigilIds ?? []) {
        if (sigilId === null) continue
        const sigil = sigilsById.get(sigilId)
        if (!sigil) continue
        for (const bonus of sigil.bonuses) addBonus(totals, bonus)
      }
    }
  }

  addRuneBonuses(totals, build, runesById)

  const food = build.foodId !== null ? foodById.get(build.foodId) : undefined
  if (food) for (const bonus of food.bonuses) addBonus(totals, bonus)

  const utility = build.utilityId !== null ? utilityById.get(build.utilityId) : undefined
  if (utility) for (const bonus of utility.bonuses) addBonus(totals, bonus)

  return totals
}

/**
 * Concentration (API attribute name `BoonDuration`) and Expertise (`ConditionDuration`) each
 * convert to a duration percentage at a flat rate of 15 points per 1% — quoted directly from
 * the wiki's Concentration and Expertise pages ("Every 15 points of Concentration/Expertise
 * adds 1% to boon/condition duration"), fetched raw wikitext this session. Rune/food/utility
 * bonuses already expressed as a direct percentage (`bonusPercent`) add on top, unconverted.
 */
const DURATION_POINTS_PER_PERCENT = 15

export function boonDurationPercent(totals: AttributeTotals): number {
  return (totals.points.BoonDuration ?? 0) / DURATION_POINTS_PER_PERCENT + totals.bonusPercent.boonDuration
}

export function conditionDurationPercent(totals: AttributeTotals): number {
  return (totals.points.ConditionDuration ?? 0) / DURATION_POINTS_PER_PERCENT + totals.bonusPercent.conditionDuration
}

/**
 * Magic Find has no equippable core-attribute form in GW2 (no `ItemStat` combo grants it) — every
 * point comes from rune/food/utility bonus text already expressed as a direct percentage, so
 * there's no points-to-percent conversion to apply, unlike Boon/Condition Duration above.
 */
export function magicFindPercent(totals: AttributeTotals): number {
  return totals.bonusPercent.magicFind
}
