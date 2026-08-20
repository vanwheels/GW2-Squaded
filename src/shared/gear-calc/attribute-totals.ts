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
    /** Rune-derived only in practice (the only source with a structured "Movement Speed" bonus
     *  line — see `PERCENT_BONUS_ALIASES`'s doc comment) — unlike its 3 siblings above, movement
     *  speed does NOT stack additively in GW2 (wiki-confirmed on Relic of the Wayfinder: "does not
     *  stack with other increases and only the highest value is used"), so this raw total is never
     *  added directly onto a derived stat the way `boonDuration`/`conditionDuration`/`magicFind`
     *  are — it's one candidate `combat-state.ts`'s `resolveMovementSpeedPercent` maxes against
     *  every curated trait/relic source. Safe to sum here regardless, since a build can only ever
     *  have one 6-piece rune bonus active at all. */
    movementSpeed: number
  }
}

export function emptyTotals(): AttributeTotals {
  return { points: {}, bonusPercent: { boonDuration: 0, conditionDuration: 0, magicFind: 0, movementSpeed: 0 } }
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
  'magic find': 'magicFind',
  // Only 4 runes carry this line (Traveler/Snowfall/Surging/Cavalier's shared 6th-piece bonus,
  // confirmed via a full `runes.json` scan 2026-08-20) — no food/utility/sigil ever does. See
  // `AttributeTotals.bonusPercent.movementSpeed`'s doc comment for why this doesn't stack the way
  // its 3 siblings above do.
  'movement speed': 'movementSpeed'
}

/** Free-text attribute name (case-insensitive, e.g. "Ferocity", "Healing Power") -> the
 *  `ItemStat`/API attribute key it corresponds to, or `null` if it's not one of the 9 core
 *  attributes (see `FLAT_ATTRIBUTE_ALIASES`'s doc comment for what's intentionally excluded).
 *  Exported so `activeConsumableConversions` below can resolve a "Gain X Equal to N% of Your Y"
 *  line's source/target names through the same table `addBonus` uses for ordinary flat bonuses. */
export function resolveFlatAttributeKey(name: string): string | null {
  return FLAT_ATTRIBUTE_ALIASES[name.trim().toLowerCase()] ?? null
}

/** A `Rune`/`Consumable` bonus line's contribution — exported so `gear-optimize.ts` can fold a
 *  candidate food/utility choice's bonuses into a search option's delta the same way runes/food/
 *  utility already contribute to `computeGearAttributeTotals` below. */
export function addBonus(totals: AttributeTotals, bonus: AttributeBonusText): void {
  // A "Gain X Equal to N% of Your Y" conversion line (see `AttributeBonusText`'s doc comment) —
  // needs the source attribute's *final* value, which isn't known during this single-pass point
  // add. Handled separately by `activeConsumableConversions`/`applyConversions`, applied once the
  // rest of the build's totals are assembled (`computeCharacterStats`). A truthy check (not
  // `!== null`) so this stays backward-compatible with rune/sigil bonus data that predates this
  // field and simply has no `sourceAttribute` key at all, not an explicit `null`.
  if (bonus.sourceAttribute) return
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

/** `AttributeTotals.bonusPercent` key -> the player-facing name it's searched/shown under —
 *  `boonDuration`/`conditionDuration` reuse the same rename `ATTRIBUTE_DISPLAY_NAME` applies to
 *  their flat-attribute counterparts (`BoonDuration`/`ConditionDuration`) so a rune/food/utility
 *  bonus line resolves to the identical stats-panel wording regardless of whether it happened to
 *  be phrased as a flat point value or a direct percent in the API's own text. Magic Find isn't
 *  one of the 9 core combat attributes `computeCharacterStats` tracks, but it's still a real
 *  "#<stat>" search term a food/utility bonus line can resolve to. */
const BONUS_PERCENT_DISPLAY_NAME: Record<keyof AttributeTotals['bonusPercent'], string> = {
  boonDuration: 'Concentration',
  conditionDuration: 'Expertise',
  magicFind: 'Magic Find',
  movementSpeed: 'Movement Speed'
}

/**
 * Every stats-panel display name (see `ATTRIBUTE_DISPLAY_NAME`) one `Rune`/`Sigil`/`Consumable`
 * bonus line affects — the data `UpgradePicker`'s "#<stat>" search filter matches against (see
 * `EquipmentEditor.tsx`'s `*Options` builders). Mirrors `addBonus`'s alias resolution (same three
 * shapes: flat/percent single-attribute, "to all stats", and a conversion line) but collects
 * display names instead of mutating a running total, and — unlike `addBonus` — also surfaces a
 * "Gain X Equal to N% of Your Y" conversion line's resolvable target *and* source names, since a
 * player searching "#power" reasonably expects a Superior Sharpening Stone-style line that grants
 * Power from Precision to show up alongside plain flat-Power bonuses.
 */
export function bonusStatDisplayNames(bonus: AttributeBonusText): string[] {
  if (bonus.sourceAttribute) {
    const names: string[] = []
    const target = bonus.attribute ? resolveFlatAttributeKey(bonus.attribute) : null
    const source = resolveFlatAttributeKey(bonus.sourceAttribute)
    if (target) names.push(ATTRIBUTE_DISPLAY_NAME[target])
    if (source) names.push(ATTRIBUTE_DISPLAY_NAME[source])
    return names
  }
  if (bonus.attribute === null || bonus.value === null) return []
  const key = bonus.attribute.trim().toLowerCase()
  if (bonus.isPercent) {
    const percentKey = PERCENT_BONUS_ALIASES[key]
    return percentKey ? [BONUS_PERCENT_DISPLAY_NAME[percentKey]] : []
  }
  if (ALL_STATS_ALIASES.has(key)) return ALL_CORE_ATTRIBUTE_KEYS.map((attr) => ATTRIBUTE_DISPLAY_NAME[attr])
  const attr = FLAT_ATTRIBUTE_ALIASES[key]
  return attr ? [ATTRIBUTE_DISPLAY_NAME[attr]] : []
}

/** A resolved source->target percent conversion — same shape as `TraitConversion`
 *  (`trait-attributes.ts`), reused here (and applied via the same `applyConversions`) so food/
 *  utility "Gain X Equal to N% of Your Y" bonuses (Superior Sharpening Stone, Tuning Crystals —
 *  confirmed 2026-08-06 to be the dominant WvW Utility-consumable shape) go through the identical
 *  resolve-late-against-final-totals path traits already use, rather than a second parallel one. */
export interface AttributeConversion {
  source: string
  target: string
  percent: number
}

/** Every source->target conversion from the build's currently-picked food and utility, resolved
 *  from free text to internal `ItemStat` keys — unresolved (the source attribute's final value
 *  isn't known until the rest of the totals are assembled), same convention as
 *  `activeTraitConversions`. A line whose source or target isn't one of the 9 core attributes
 *  (not currently observed in the data, but not guaranteed to stay that way after a future patch)
 *  is silently dropped rather than guessed. */
export function activeConsumableConversions(
  build: Build,
  foodById: Map<number, Consumable>,
  utilityById: Map<number, Consumable>
): AttributeConversion[] {
  const conversions: AttributeConversion[] = []
  const food = build.foodId !== null ? foodById.get(build.foodId) : undefined
  const utility = build.utilityId !== null ? utilityById.get(build.utilityId) : undefined
  for (const consumable of [food, utility]) {
    if (!consumable) continue
    for (const bonus of consumable.bonuses) {
      if (!bonus.sourceAttribute || bonus.attribute === null || bonus.value === null) continue
      const source = resolveFlatAttributeKey(bonus.sourceAttribute)
      const target = resolveFlatAttributeKey(bonus.attribute)
      if (source && target) conversions.push({ source, target, percent: bonus.value })
    }
  }
  return conversions
}

/** Applies a list of source->target percent conversions against `totals`'s *current* snapshot —
 *  every conversion reads the same pre-application values (not chained/compounding), matching how
 *  the game itself computes simultaneous conversions. Shared by trait conversions
 *  (`trait-attributes.ts`) and consumable conversions (`activeConsumableConversions` above); call
 *  after every other additive contribution this snapshot should reflect is already in `totals`. */
export function applyConversions(totals: AttributeTotals, conversions: AttributeConversion[]): void {
  const conversionBonus: Record<string, number> = {}
  for (const c of conversions) {
    conversionBonus[c.target] = (conversionBonus[c.target] ?? 0) + ((totals.points[c.source] ?? 0) * c.percent) / 100
  }
  for (const [target, bonus] of Object.entries(conversionBonus)) addPoints(totals, target, bonus)
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
      // underwater set while on land, etc.) does not contribute. Confirmed correct directly by the
      // user 2026-08-06: inactive weapons do NOT apply their passive sigil bonus in-game — only
      // stacking sigils (e.g. Bloodlust) persist their accrued stacks across a weapon swap, which
      // is a separate mechanic already (`STACKING_SIGILS`/`combatStatePoints` in
      // `combat-state.ts`), not something this per-slot loop needs to special-case.
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

/** `computeGearAttributeTotals` + `boonDurationPercent`/`conditionDurationPercent`, bundled for the
 *  two call sites (`SkillsEditor.tsx`'s `useDurationContext`, `TraitsEditor.tsx`'s own tooltip prep)
 *  that only need the duration-% pair, not the full `AttributeTotals`. */
export function boonConditionDurationPercent(
  build: Build,
  gameData: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'infusions' | 'runes' | 'sigils' | 'food' | 'utility'>
): { boon: number; condition: number } {
  const totals = computeGearAttributeTotals(build, gameData)
  return { boon: boonDurationPercent(totals), condition: conditionDurationPercent(totals) }
}

/**
 * Magic Find has no equippable core-attribute form in GW2 (no `ItemStat` combo grants it) — every
 * point comes from rune/food/utility bonus text already expressed as a direct percentage, so
 * there's no points-to-percent conversion to apply, unlike Boon/Condition Duration above.
 */
export function magicFindPercent(totals: AttributeTotals): number {
  return totals.bonusPercent.magicFind
}
