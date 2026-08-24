import type { Build, Consumable, EquipmentSlot, EquipmentSlotKey, GameData, Infusion, ItemStat, Rune, Trait } from '../types'
import {
  activeConsumableConversions,
  addBonus,
  addPoints,
  applyConversions,
  boonDurationPercent,
  conditionDurationPercent,
  computeGearAttributeTotals,
  emptyTotals,
  isActiveWeaponSlot,
  SLOT_ADJUSTMENT_KEY,
  statComboContribution,
  type AdjustmentKey,
  type AttributeTotals
} from './attribute-totals'
import {
  BASE_ATTRIBUTES,
  BASE_CRITICAL_CHANCE_PERCENT,
  BASE_CRITICAL_DAMAGE_PERCENT,
  BASE_HEALTH_BY_PROFESSION,
  FEROCITY_PER_CRITICAL_DAMAGE_PERCENT,
  fullArmorDefense,
  HEALTH_PER_VITALITY,
  PRECISION_PER_CRITICAL_CHANCE_PERCENT,
  WEIGHT_CLASS_BY_PROFESSION
} from './derived-stats'
import { combatStatePoints, furyCritChanceTraitBonus, FURY_CRITICAL_CHANCE_PERCENT, type CombatState } from './combat-state'
import { formatItemStatName } from './format-description'
import { activeAttunementAttributeTraitBonus, activeLegendAttributeTraitBonus, activeTraitFlatBonuses, activeWeaponEquippedAttributeTraitBonus, applyTraitBonuses } from './trait-attributes'
import { armorTrinketInfusionCapacity, RUNE_SLOT_KEYS, weaponUpgradeCapacity } from './upgrade-slots'

/**
 * The 9 stat metrics the Gear Optimizer can be given as a floor and/or a maximize-priority tier.
 * All entered/displayed in the same unit `StatsPanel` shows each in — translated stats (Health,
 * Armor, Critical Chance, Critical Damage) rather than their raw attribute (Vitality, Toughness,
 * Precision, Ferocity), per user direction: nobody thinks in raw Precision, they think in Critical
 * Chance %. Magic Find is deliberately not offered — it has no gear-legal source at all (only
 * runes/food/utility, all fixed inputs to this search), so it can never be a search variable here.
 */
export type OptimizerMetricId =
  | 'Power'
  | 'Health'
  | 'Armor'
  | 'CriticalChancePercent'
  | 'CriticalDamagePercent'
  | 'Healing'
  | 'ConditionDamage'
  | 'BoonDurationPercent'
  | 'ConditionDurationPercent'

export interface OptimizerMetric {
  id: OptimizerMetricId
  label: string
  unit: 'points' | 'percent'
}

export const OPTIMIZER_METRICS: OptimizerMetric[] = [
  { id: 'Power', label: 'Power', unit: 'points' },
  { id: 'Health', label: 'Health', unit: 'points' },
  { id: 'Armor', label: 'Armor', unit: 'points' },
  { id: 'CriticalChancePercent', label: 'Critical Chance', unit: 'percent' },
  { id: 'CriticalDamagePercent', label: 'Critical Damage', unit: 'percent' },
  { id: 'Healing', label: 'Healing Power', unit: 'points' },
  { id: 'ConditionDamage', label: 'Condition Damage', unit: 'points' },
  { id: 'BoonDurationPercent', label: 'Boon Duration', unit: 'percent' },
  { id: 'ConditionDurationPercent', label: 'Condition Duration', unit: 'percent' }
]

const METRIC_IDS: OptimizerMetricId[] = OPTIMIZER_METRICS.map((m) => m.id)

interface MetricContext {
  furyFlatCritBonus: number
  baseHealth: number
  defense: number
}

/**
 * A metric's value purely from a *delta* (no baseline/base-attribute or profession-constant
 * offset) — used during search to score candidate slot choices against each other. Health/Armor's
 * constant part (base health, Defense) doesn't vary with which stat combo is chosen, so it's
 * folded into `evaluateMetric`'s baseline instead of here.
 */
function metricDelta(id: OptimizerMetricId, delta: AttributeTotals): number {
  switch (id) {
    case 'Health':
      return (delta.points.Vitality ?? 0) * HEALTH_PER_VITALITY
    case 'Armor':
      return delta.points.Toughness ?? 0
    case 'BoonDurationPercent':
      return boonDurationPercent(delta)
    case 'ConditionDurationPercent':
      return conditionDurationPercent(delta)
    case 'CriticalChancePercent':
      return (delta.points.Precision ?? 0) / PRECISION_PER_CRITICAL_CHANCE_PERCENT
    case 'CriticalDamagePercent':
      return (delta.points.CritDamage ?? 0) / FEROCITY_PER_CRITICAL_DAMAGE_PERCENT
    default:
      return delta.points[id] ?? 0
  }
}

/** A metric's real, final value against full accumulated totals (baseline + every chosen delta) —
 *  matches exactly what `computeCharacterStats`/`StatsPanel` would show for the resulting build. */
function evaluateMetric(id: OptimizerMetricId, totals: AttributeTotals, ctx: MetricContext): number {
  switch (id) {
    case 'Health':
      return ctx.baseHealth + (totals.points.Vitality ?? 0) * HEALTH_PER_VITALITY
    case 'Armor':
      return ctx.defense + (totals.points.Toughness ?? 0)
    case 'CriticalChancePercent':
      return (
        BASE_CRITICAL_CHANCE_PERCENT +
        ((totals.points.Precision ?? 0) - 1000) / PRECISION_PER_CRITICAL_CHANCE_PERCENT +
        ctx.furyFlatCritBonus
      )
    case 'CriticalDamagePercent':
      return BASE_CRITICAL_DAMAGE_PERCENT + (totals.points.CritDamage ?? 0) / FEROCITY_PER_CRITICAL_DAMAGE_PERCENT
    default:
      return metricDelta(id, totals)
  }
}

function deltaSignature(delta: AttributeTotals, relevant: OptimizerMetricId[]): string {
  return relevant.map((id) => Math.round(metricDelta(id, delta) * 100)).join('|')
}

const DOMINANCE_EPS = 1e-6

/** Drops any option that's Pareto-dominated by another surviving option in the same slot — at
 *  least as good on every relevant metric, strictly better on at least one — so the solver never
 *  has to branch on a choice that can never be part of an optimal assignment. Complements (runs
 *  after) the exact-signature dedup each `*OptionsFor` already does: that only merges options whose
 *  relevant-metric deltas are identical, so e.g. Rampager's (Power/Precision/ConditionDamage) used
 *  to survive right alongside Assassin's (Power/Precision/CritDamage) on a run that isn't tracking
 *  Condition Damage — same Power, same Precision, but Assassin's also gives CritDamage for free.
 *  Found 2026-08-23 diagnosing a truncated search that returned Rampager's pieces a fully-run search
 *  never should have picked. Unlike the node-budget cap, this is a correctness fix, not a
 *  performance one — it applies regardless of whether the search ends up truncated. */
export function pruneDominated(options: SearchOption[]): SearchOption[] {
  return options.filter((option) => !options.some((other) => other !== option && dominates(other, option)))
}

/** True if `a` is at least as good as `b` on every relevant metric and strictly better on at least
 *  one. Post-dedup, two surviving options never have identical deltas (they'd have collided into
 *  the same signature and been merged already), so no tie-breaking beyond the epsilon is needed —
 *  but this function makes no such assumption itself (two options with truly identical deltas
 *  correctly dominate neither each other, so both survive). */
export function dominates(a: SearchOption, b: SearchOption): boolean {
  let strictlyBetter = false
  for (let i = 0; i < a.deltas.length; i++) {
    if (a.deltas[i] < b.deltas[i] - DOMINANCE_EPS) return false
    if (a.deltas[i] > b.deltas[i] + DOMINANCE_EPS) strictlyBetter = true
  }
  return strictlyBetter
}

export interface SearchOption {
  /** `ItemStat.id`, `Consumable.id`, or `null` for a food/utility slot's "none" option. */
  id: number | null
  label: string
  /** Precomputed `metricDelta` per entry of the run's `relevant` metric list (same order), so the
   *  solver never has to re-derive a metric value from a raw `AttributeTotals` while searching. */
  deltas: number[]
}

export interface OptimizerSlot {
  /** Stable id for result reporting, e.g. `'helm'`, `'weaponA1'`, `'food'`. */
  id: string
  label: string
  /** Empty for the food/utility slots, which aren't tied to an `EquipmentSlotKey`. */
  equipmentKeys: EquipmentSlotKey[]
  options: SearchOption[]
  /** How this slot's chosen option gets written back onto the result build, in `optimizeGear`'s
   *  result-assembly loop — everything but the default writes somewhere other than `itemStatId`.
   *  Omitted (defaults to an ordinary gear slot) for every armor/trinket/weapon stat-combo slot. */
  kind?: 'food' | 'utility' | 'rune' | 'infusion'
  /** `kind: 'infusion'` only — which index into `equipmentKeys[0]`'s `infusionIds` array this slot
   *  writes (each physical infusion slot on a piece of gear is searched independently, since e.g. a
   *  ring's 3 slots can legally hold 3 different infusions). */
  infusionIndex?: number
}

const ARMOR_SLOTS: { key: EquipmentSlotKey; label: string }[] = [
  { key: 'helm', label: 'Helm' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'leggings', label: 'Leggings' },
  { key: 'boots', label: 'Boots' }
]

const TRINKET_SLOTS: { key: EquipmentSlotKey; label: string }[] = [
  { key: 'backpiece', label: 'Back' },
  { key: 'accessory1', label: 'Accessory 1' },
  { key: 'accessory2', label: 'Accessory 2' },
  { key: 'ring1', label: 'Ring 1' },
  { key: 'ring2', label: 'Ring 2' },
  { key: 'amulet', label: 'Amulet' }
]

/** One legal stat-combo option per unique delta shape (over the run's `relevant` metrics only —
 *  see `optimizeGear`) for a given slot category+adjustment tier — collapses the ~40 legal ids per
 *  category down to a handful of distinct "shapes" before the solver ever sees them. Deliberately
 *  NOT deduped over the full 9-metric space: that sounds more precise but in practice barely
 *  dedupes anything (most combos differ on *some* untracked attribute), which multiplies the
 *  search's branching factor and was measured to blow well past the node budget even for a single
 *  floor. Restricting to metrics actually in play (floors ∪ every maximize tier, fixed for the
 *  whole multi-tier run before any solving starts) keeps options-per-slot small without losing any
 *  precision that could actually affect the result. */
function statOptionsFor(itemStats: ItemStat[], legalIds: Set<number>, adjustmentKey: AdjustmentKey, relevant: OptimizerMetricId[]): SearchOption[] {
  const seen = new Map<string, SearchOption>()
  for (const stat of itemStats) {
    if (!legalIds.has(stat.id) || stat.name.trim() === '') continue
    const delta = statComboContribution(stat, adjustmentKey)
    const sig = deltaSignature(delta, relevant)
    if (seen.has(sig)) continue
    seen.set(sig, { id: stat.id, label: formatItemStatName(stat.name), deltas: relevant.map((id) => metricDelta(id, delta)) })
  }
  return pruneDominated([...seen.values()])
}

function consumableOptionsFor(catalog: Consumable[], relevant: OptimizerMetricId[]): SearchOption[] {
  const seen = new Map<string, SearchOption>()
  seen.set('none', { id: null, label: 'None', deltas: relevant.map(() => 0) })
  for (const item of catalog) {
    const delta = emptyTotals()
    for (const bonus of item.bonuses) addBonus(delta, bonus)
    const sig = deltaSignature(delta, relevant)
    if (seen.has(sig)) continue
    seen.set(sig, { id: item.id, label: item.name, deltas: relevant.map((id) => metricDelta(id, delta)) })
  }
  return pruneDominated([...seen.values()])
}

/** One option per rune (plus "None"), each option's delta the SUM of every stage up to and
 *  including the one unlocked at 6 pieces (`bonuses[0..5]`) — this app models rune choice as a
 *  single search slot applied uniformly across all 6 armor pieces, matching the "usually 6x one
 *  rune" WvW convention (see TODO.md's scoping note), rather than 6 independently-searched rune
 *  slots. Mirrors `addRuneBonuses`' own "count by rune id, credit `bonuses[0..count-1]`" logic for
 *  a uniform 6-piece set. */
function runeOptionsFor(runes: Rune[], relevant: OptimizerMetricId[]): SearchOption[] {
  const seen = new Map<string, SearchOption>()
  seen.set('none', { id: null, label: 'None', deltas: relevant.map(() => 0) })
  for (const rune of runes) {
    const delta = emptyTotals()
    for (const bonus of rune.bonuses) addBonus(delta, bonus)
    const sig = deltaSignature(delta, relevant)
    if (seen.has(sig)) continue
    seen.set(sig, { id: rune.id, label: rune.name, deltas: relevant.map((id) => metricDelta(id, delta)) })
  }
  return pruneDominated([...seen.values()])
}

/** One option per core-attribute WvW infusion (plus "None") — every attribute infusion is a flat
 *  +5 to a single attribute (see `Infusion`'s doc comment in `types/game-data.ts`), so unlike
 *  `statOptionsFor` there's no adjustment-tier math here. Non-attribute infusions
 *  (`attribute === null` — not currently fetched, see that same doc comment) are skipped. Shared
 *  across every physical infusion slot (`armorTrinketInfusionSlots`/`buildWeaponInfusionSlots`)
 *  since infusions aren't slot-restricted — computed once rather than once per slot. */
function infusionOptionsFor(infusions: Infusion[], relevant: OptimizerMetricId[]): SearchOption[] {
  const seen = new Map<string, SearchOption>()
  seen.set('none', { id: null, label: 'None', deltas: relevant.map(() => 0) })
  for (const infusion of infusions) {
    if (!infusion.attribute || infusion.value === null) continue
    const delta = emptyTotals()
    addPoints(delta, infusion.attribute, infusion.value)
    const sig = deltaSignature(delta, relevant)
    if (seen.has(sig)) continue
    seen.set(sig, { id: infusion.id, label: infusion.name, deltas: relevant.map((id) => metricDelta(id, delta)) })
  }
  return pruneDominated([...seen.values()])
}

/** One `OptimizerSlot` per physical infusion slot on armor/trinkets (helm..boots, back, both
 *  accessories, both rings — amulet has none) — capacity per key from
 *  `armorTrinketInfusionCapacity`. Every slot shares the same option list (infusions aren't
 *  slot-restricted) but is searched independently. */
function armorTrinketInfusionSlots(options: SearchOption[]): OptimizerSlot[] {
  const slots: OptimizerSlot[] = []
  for (const { key, label } of [...ARMOR_SLOTS, ...TRINKET_SLOTS]) {
    const capacity = armorTrinketInfusionCapacity(key)
    for (let i = 0; i < capacity; i++) {
      slots.push({
        id: `${key}Infusion${i}`,
        label: capacity > 1 ? `${label} Infusion ${i + 1}` : `${label} Infusion`,
        equipmentKeys: [key],
        kind: 'infusion',
        infusionIndex: i,
        options
      })
    }
  }
  return slots
}

/** Which land/underwater weapon slots actually count right now — mirrors `isActiveWeaponSlot`'s
 *  "only the currently-active set contributes" rule, so the optimizer only touches slots that
 *  actually affect the totals it's constraining. The inactive set's `itemStatId` is left untouched
 *  in the result. */
function buildWeaponSlots(
  build: Build,
  gameData: Pick<GameData, 'professions'>,
  legalArmorWeapon: Set<number>,
  itemStats: ItemStat[],
  relevant: OptimizerMetricId[]
): OptimizerSlot[] {
  const profession = gameData.professions.find((p) => p.id === build.profession)

  function isTwoHanded(weaponType: string | null | undefined): boolean {
    return Boolean(weaponType && profession?.weapons[weaponType]?.flags.includes('TwoHand'))
  }

  function gearOptions(adjustmentKey: AdjustmentKey): SearchOption[] {
    return statOptionsFor(itemStats, legalArmorWeapon, adjustmentKey, relevant)
  }

  const slots: OptimizerSlot[] = []

  function addPair(mainKey: EquipmentSlotKey, offKey: EquipmentSlotKey, setLabel: string): void {
    const main = build.equipment[mainKey]
    const off = build.equipment[offKey]
    if (main?.weaponType && isTwoHanded(main.weaponType)) {
      slots.push({
        id: `${mainKey}+${offKey}`,
        label: `${setLabel} (2-handed)`,
        equipmentKeys: [mainKey, offKey],
        options: gearOptions('weaponTwoHanded')
      })
      return
    }
    if (main?.weaponType) {
      slots.push({ id: mainKey, label: `${setLabel} main hand`, equipmentKeys: [mainKey], options: gearOptions('weaponOneHanded') })
    }
    if (off?.weaponType) {
      slots.push({ id: offKey, label: `${setLabel} off hand`, equipmentKeys: [offKey], options: gearOptions('weaponOneHanded') })
    }
  }

  function addUnderwater(key: EquipmentSlotKey, label: string): void {
    if (!build.equipment[key]?.weaponType) return
    slots.push({ id: key, label, equipmentKeys: [key], options: gearOptions('weaponTwoHanded') })
  }

  if (build.environment === 'land') {
    if (isActiveWeaponSlot('weaponA1', build)) addPair('weaponA1', 'weaponA2', 'Weapon I')
    if (isActiveWeaponSlot('weaponB1', build)) addPair('weaponB1', 'weaponB2', 'Weapon II')
  } else {
    if (isActiveWeaponSlot('weaponU1', build)) addUnderwater('weaponU1', 'Underwater Set 1')
    if (isActiveWeaponSlot('weaponU2', build)) addUnderwater('weaponU2', 'Underwater Set 2')
  }

  return slots
}

interface WeaponItem {
  key: EquipmentSlotKey
  label: string
  isTwoHanded: boolean
}

/** Every physically-equipped weapon item in the build's currently-active set (land: Set A or B,
 *  whichever `isActiveWeaponSlot` says; underwater: U1 or U2) — one entry per real item, not per
 *  slot key: a two-handed weapon is a single item living on its main-hand key only (its upgrade
 *  picks never live on the mirrored off-hand key — see `EquipmentEditor.tsx`'s `setMainItemStat`),
 *  a one-handed main/off pair is two independent items. Kept separate from `buildWeaponSlots`' own
 *  pair-merging (one *stat-search* slot per pair, since a two-handed weapon's stat combo IS shared
 *  across both keys) — that shape doesn't apply here, since each item's infusion slots are searched
 *  independently regardless of stat-combo mirroring. Shared by `buildWeaponInfusionSlots` below. */
function activeWeaponItems(build: Build, gameData: Pick<GameData, 'professions'>): WeaponItem[] {
  const profession = gameData.professions.find((p) => p.id === build.profession)

  function isTwoHanded(weaponType: string | null | undefined): boolean {
    return Boolean(weaponType && profession?.weapons[weaponType]?.flags.includes('TwoHand'))
  }

  const items: WeaponItem[] = []

  function addPair(mainKey: EquipmentSlotKey, offKey: EquipmentSlotKey, setLabel: string): void {
    const main = build.equipment[mainKey]
    const off = build.equipment[offKey]
    if (main?.weaponType && isTwoHanded(main.weaponType)) {
      items.push({ key: mainKey, label: `${setLabel} (2-handed)`, isTwoHanded: true })
      return
    }
    if (main?.weaponType) items.push({ key: mainKey, label: `${setLabel} main hand`, isTwoHanded: false })
    if (off?.weaponType) items.push({ key: offKey, label: `${setLabel} off hand`, isTwoHanded: false })
  }

  function addUnderwater(key: EquipmentSlotKey, label: string): void {
    if (build.equipment[key]?.weaponType) items.push({ key, label, isTwoHanded: true })
  }

  if (build.environment === 'land') {
    if (isActiveWeaponSlot('weaponA1', build)) addPair('weaponA1', 'weaponA2', 'Weapon I')
    if (isActiveWeaponSlot('weaponB1', build)) addPair('weaponB1', 'weaponB2', 'Weapon II')
  } else {
    if (isActiveWeaponSlot('weaponU1', build)) addUnderwater('weaponU1', 'Underwater Set 1')
    if (isActiveWeaponSlot('weaponU2', build)) addUnderwater('weaponU2', 'Underwater Set 2')
  }

  return items
}

/** One `OptimizerSlot` per physical infusion slot on the currently-equipped, currently-active
 *  weapon item(s) — capacity per item from `weaponUpgradeCapacity` (2 for a two-handed weapon, 1
 *  for a one-handed main/off-hand or underwater weapon). Mirrors `armorTrinketInfusionSlots`'
 *  shape for the weapon side of the equipment set. */
function buildWeaponInfusionSlots(build: Build, gameData: Pick<GameData, 'professions'>, options: SearchOption[]): OptimizerSlot[] {
  const slots: OptimizerSlot[] = []
  for (const item of activeWeaponItems(build, gameData)) {
    const capacity = weaponUpgradeCapacity(true, item.isTwoHanded)
    for (let i = 0; i < capacity; i++) {
      slots.push({
        id: `${item.key}Infusion${i}`,
        label: capacity > 1 ? `${item.label} Infusion ${i + 1}` : `${item.label} Infusion`,
        equipmentKeys: [item.key],
        kind: 'infusion',
        infusionIndex: i,
        options
      })
    }
  }
  return slots
}

export interface OptimizerFloor {
  metric: OptimizerMetricId
  /** Minimum required value, in the metric's natural unit (points or percent). */
  value: number
}

export interface OptimizerInput {
  build: Build
  gameData: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'professions' | 'infusions' | 'runes' | 'sigils' | 'food' | 'utility' | 'traits' | 'legends'>
  combatState: CombatState
  floors: OptimizerFloor[]
  /**
   * 1-3 metrics, in priority order: the search first maximizes `targets[0]`, then — among every
   * assignment that ties its best-possible `targets[0]` value — maximizes `targets[1]`, and so on.
   * This is lexicographic, not a weighted blend: a lower-priority tier can never trade away any of
   * a higher-priority tier's achieved value to improve itself.
   */
  targets: OptimizerMetricId[]
  /** When true, food and utility choice are search variables too (in addition to gear); when
   *  false, the build's current food/utility (if any) are treated as fixed inputs. */
  optimizeFoodUtility: boolean
  /** When true, rune choice (applied uniformly across all 6 armor slots, matching the WvW "6x one
   *  rune" convention — see `runeOptionsFor`) and every individual infusion slot (searched
   *  per-slot, not uniformly — see `armorTrinketInfusionSlots`/`buildWeaponInfusionSlots`) become
   *  search variables too; when false, the build's current runes/infusions are fixed inputs, same
   *  as sigils/relic (sigils are procs, not a stat lever this floor/maximize model fits — see
   *  TODO.md's scoping note). */
  optimizeRunesInfusions: boolean
}

export interface OptimizerSlotResult {
  label: string
  equipmentKeys: EquipmentSlotKey[]
  chosenId: number | null
  chosenLabel: string
  /** Mirrors `OptimizerSlot.kind` — lets a result list distinguish e.g. an unfilled infusion slot
   *  (`kind: 'infusion'`, `chosenId: null`) worth hiding from a noisy display, from an ordinary
   *  gear slot's `chosenId` being null (never happens today, but not assumed here). */
  kind?: 'food' | 'utility' | 'rune' | 'infusion'
}

export interface OptimizerResult {
  feasible: boolean
  /** True if any tier's node budget was exhausted before that tier's search could prove
   *  optimality — `slots` still holds the best assignment found, just not guaranteed-optimal. */
  truncated: boolean
  /** Populated when `feasible` is false: which floor(s) are mathematically unreachable even
   *  giving every slot its best-possible contribution to that one metric. */
  infeasibleFloors: OptimizerMetricId[]
  slots: OptimizerSlotResult[]
  foodId: number | null
  utilityId: number | null
  /** Final value of every metric, evaluated the same way `computeCharacterStats` would. */
  metricValues: Partial<Record<OptimizerMetricId, number>>
  /** The source build with the result's `itemStatId`s (and `foodId`/`utilityId` if
   *  `optimizeFoodUtility`) applied — ready to feed into `computeCharacterStats` for a full
   *  preview, or to merge into the build editor's draft directly. */
  build: Build
}

const NODE_LIMIT = 500_000
const EPS = 1e-6

interface SolveOutcome {
  choice: number[]
  score: number
  truncated: boolean
  /** Indices into this call's `relevant` list that are mathematically unreachable even giving
   *  every slot its best-possible contribution — empty unless that's exactly why this outcome has
   *  no `choice`. */
  unreachable: number[]
}

/**
 * `requiredDelta[m]` is `-Infinity` for any metric with no floor (including the current tier's
 * target, when it has none) — every comparison below (`accum[m] >= requiredDelta[m]`) is trivially
 * satisfied against `-Infinity`, so unconstrained metrics fall out of every check for free without
 * a separate `m === targetIndex` special case. This also correctly handles a floor set on the same
 * metric currently being maximized, and (see `optimizeGear`) a higher-priority tier's achieved
 * value being pinned in as a floor for every subsequent tier.
 */
function solve(slots: OptimizerSlot[], relevant: OptimizerMetricId[], requiredDelta: number[], targetIndex: number): SolveOutcome {
  const slotCount = slots.length
  const metricCount = relevant.length

  const bestPerSlotPerMetric: number[][] = slots.map((slot) => relevant.map((_, m) => Math.max(...slot.options.map((o) => o.deltas[m]))))
  const totalBest = relevant.map((_, m) => bestPerSlotPerMetric.reduce((sum, row) => sum + row[m], 0))

  // Upfront impossibility check: even with every slot independently maximized per floor metric,
  // some floor still can't be reached — no search can fix that (slots being shared resources only
  // makes the true optimum worse than this, never better).
  const unreachable = relevant.map((_, m) => m).filter((m) => totalBest[m] < requiredDelta[m] - EPS)
  if (unreachable.length > 0) return { choice: [], score: -Infinity, truncated: false, unreachable }

  function isFeasible(accum: number[]): boolean {
    return accum.every((v, m) => v >= requiredDelta[m] - EPS)
  }

  // Greedy warm start: repeatedly assign whichever remaining (slot, option) makes the most
  // combined proportional progress across every still-unmet floor at once (each floor's credit is
  // its fraction of the remaining gap it closes, capped at 1) — not just whichever single slot is
  // best for whichever single floor currently has the largest absolute gap. That single-floor
  // version systematically overlooked multi-attribute stat combos (e.g. a 4-attribute prefix
  // touching Healing/Armor/Health/Boon-Duration all at once): it looks merely "good, not best" on
  // any one dimension in isolation, but is actually the most efficient pick once several floors
  // are active simultaneously. Gives branch-and-bound a real, well-shaped incumbent to prune
  // against from node 1 instead of starting blind.
  const assigned = new Array<number>(slotCount).fill(-1)
  const usedSlot = new Array<boolean>(slotCount).fill(false)
  const remainingGap = requiredDelta.slice()

  function anyUnmetFloor(): boolean {
    return remainingGap.some((gap) => gap > EPS)
  }

  while (anyUnmetFloor()) {
    let bestSlot = -1
    let bestOption = -1
    let bestScore = -Infinity
    for (let s = 0; s < slotCount; s++) {
      if (usedSlot[s]) continue
      slots[s].options.forEach((option, o) => {
        let score = 0
        for (let m = 0; m < metricCount; m++) {
          if (remainingGap[m] <= EPS) continue
          score += Math.max(0, Math.min(option.deltas[m], remainingGap[m])) / remainingGap[m]
        }
        if (score > bestScore) {
          bestScore = score
          bestSlot = s
          bestOption = o
        }
      })
    }
    if (bestSlot === -1 || bestScore <= EPS) break
    usedSlot[bestSlot] = true
    assigned[bestSlot] = bestOption
    for (let m = 0; m < metricCount; m++) remainingGap[m] -= slots[bestSlot].options[bestOption].deltas[m]
  }
  for (let s = 0; s < slotCount; s++) {
    if (usedSlot[s]) continue
    let bestOption = 0
    let bestValue = -Infinity
    slots[s].options.forEach((option, o) => {
      if (option.deltas[targetIndex] > bestValue) {
        bestValue = option.deltas[targetIndex]
        bestOption = o
      }
    })
    assigned[s] = bestOption
  }
  const greedyAccum = relevant.map((_, m) => slots.reduce((sum, slot, s) => sum + slot.options[assigned[s]].deltas[m], 0))

  let best: { choice: number[]; score: number } | null = isFeasible(greedyAccum) ? { choice: assigned.slice(), score: greedyAccum[targetIndex] } : null
  let nodeCount = 0
  let truncated = false

  // Slots with the widest spread in target contribution are branched on first, so a strong
  // incumbent is found quickly and later slots prune hard against it.
  const order = slots
    .map((_, i) => i)
    .sort((a, b) => {
      const spread = (i: number): number => {
        const values = slots[i].options.map((o) => o.deltas[targetIndex])
        return Math.max(...values) - Math.min(...values)
      }
      return spread(b) - spread(a)
    })
  // Suffix best-possible-per-metric sums aligned to `order`: index i holds the sum, over
  // order[i..], of that slot's single best contribution to each metric — an admissible bound for
  // both pruning rules below.
  const suffixBest: number[][] = new Array(slotCount + 1).fill(null).map(() => new Array(metricCount).fill(0))
  for (let i = slotCount - 1; i >= 0; i--) {
    const row = bestPerSlotPerMetric[order[i]]
    for (let m = 0; m < metricCount; m++) suffixBest[i][m] = suffixBest[i + 1][m] + row[m]
  }

  const accum = new Array(metricCount).fill(0)
  const choice = new Array<number>(slotCount).fill(-1)

  function dfs(depth: number): void {
    nodeCount++
    if (nodeCount > NODE_LIMIT) {
      truncated = true
      return
    }
    if (depth === slotCount) {
      if (isFeasible(accum) && (!best || accum[targetIndex] > best.score)) best = { choice: choice.slice(), score: accum[targetIndex] }
      return
    }
    // Bound: even taking every remaining slot's best target contribution, can we beat the
    // incumbent? (Only a valid prune once an incumbent exists.)
    if (best !== null && accum[targetIndex] + suffixBest[depth][targetIndex] <= (best as { score: number }).score + EPS) return
    // Feasibility: even taking every remaining slot's best contribution to each floor, can the
    // remaining gap still close?
    for (let m = 0; m < metricCount; m++) {
      if (accum[m] + suffixBest[depth][m] < requiredDelta[m] - EPS) return
    }

    const slotIdx = order[depth]
    const options = slots[slotIdx].options

    // Branch-order options: while any floor is still unmet by `accum` so far, try whichever
    // option makes the most combined proportional progress toward the remaining gaps first (same
    // scoring the greedy warm start uses) — critical while `best` is still null (no incumbent
    // yet, so the target-bound prune above can't cut anything): pure target-first ordering would
    // otherwise spend the whole search exploring "maximize the target" branches that starve a
    // floor the target metric doesn't itself contribute to, and might never reach a feasible leaf
    // before the node budget runs out. Once every floor is already satisfied by `accum`, there's
    // nothing left to chase but the target, so fall back to target-descending as before.
    const floorsRemain = requiredDelta.some((req, m) => req > -Infinity && accum[m] < req - EPS)
    const scored = options.map((option, i) => {
      if (!floorsRemain) return { i, score: option.deltas[targetIndex] }
      let score = 0
      for (let m = 0; m < metricCount; m++) {
        const gap = requiredDelta[m] - accum[m]
        if (gap <= EPS) continue
        score += Math.max(0, Math.min(option.deltas[m], gap)) / gap
      }
      return { i, score }
    })
    scored.sort((a, b) => b.score - a.score)

    for (const { i: optIdx } of scored) {
      const deltas = options[optIdx].deltas
      for (let m = 0; m < metricCount; m++) accum[m] += deltas[m]
      choice[slotIdx] = optIdx
      dfs(depth + 1)
      for (let m = 0; m < metricCount; m++) accum[m] -= deltas[m]
      if (truncated) return
    }
  }

  dfs(0)

  const finalBest = best as { choice: number[]; score: number } | null
  if (finalBest) return { choice: finalBest.choice, score: finalBest.score, truncated, unreachable: [] }
  return { choice: [], score: -Infinity, truncated, unreachable: [] }
}

export function optimizeGear(input: OptimizerInput): OptimizerResult {
  const { build, gameData, combatState, floors, targets, optimizeFoodUtility, optimizeRunesInfusions } = input
  if (targets.length === 0) throw new Error('optimizeGear requires at least one maximize target')

  // Every metric that can possibly matter for this run, fixed upfront (floors don't change
  // mid-run, and every tier's target is already known before the first tier is solved) — see
  // `statOptionsFor`'s doc comment for why this is a meaningful perf requirement, not just a
  // tidy default.
  const relevant: OptimizerMetricId[] = [...new Set([...floors.map((f) => f.metric), ...targets])]

  const legalArmorWeapon = new Set(gameData.itemStatLegalIds.armorWeapon)
  const legalTrinket = new Set(gameData.itemStatLegalIds.trinket)

  const slots: OptimizerSlot[] = []
  for (const { key, label } of ARMOR_SLOTS) {
    const adjustmentKey = SLOT_ADJUSTMENT_KEY[key]
    if (!adjustmentKey) continue
    slots.push({ id: key, label, equipmentKeys: [key], options: statOptionsFor(gameData.itemStats, legalArmorWeapon, adjustmentKey, relevant) })
  }
  for (const { key, label } of TRINKET_SLOTS) {
    const adjustmentKey = SLOT_ADJUSTMENT_KEY[key]
    if (!adjustmentKey) continue
    slots.push({ id: key, label, equipmentKeys: [key], options: statOptionsFor(gameData.itemStats, legalTrinket, adjustmentKey, relevant) })
  }
  slots.push(...buildWeaponSlots(build, gameData, legalArmorWeapon, gameData.itemStats, relevant))

  // Rune/infusion slots, added to the same search alongside gear — see `OptimizerInput.
  // optimizeRunesInfusions`'s doc comment for the uniform-rune-vs-per-slot-infusion distinction.
  let infusionSlots: OptimizerSlot[] = []
  if (optimizeRunesInfusions) {
    slots.push({ id: 'runes', label: 'Runes', equipmentKeys: RUNE_SLOT_KEYS, kind: 'rune', options: runeOptionsFor(gameData.runes, relevant) })
    const infusionOptions = infusionOptionsFor(gameData.infusions, relevant)
    infusionSlots = [...armorTrinketInfusionSlots(infusionOptions), ...buildWeaponInfusionSlots(build, gameData, infusionOptions)]
    slots.push(...infusionSlots)
  }

  const searchedKeys = new Set(slots.flatMap((s) => s.equipmentKeys))

  if (optimizeFoodUtility) {
    slots.push({ id: 'food', label: 'Food', equipmentKeys: [], kind: 'food', options: consumableOptionsFor(gameData.food, relevant) })
    slots.push({ id: 'utility', label: 'Utility', equipmentKeys: [], kind: 'utility', options: consumableOptionsFor(gameData.utility, relevant) })
  }

  // Baseline: every fixed contribution (runes, infusions, current food/utility if not being
  // searched) with every searched slot's itemStatId nulled out so it contributes nothing here —
  // the search adds its own delta back on top. Nulling itemStatId (not the whole slot) keeps
  // rune/infusion contributions fixed when `optimizeRunesInfusions` is false; when it's true, their
  // own contributions are nulled out too, right below, the same way `searchedKeys` above nulls
  // itemStatId for gear.
  const fixedEquipment: Partial<Record<EquipmentSlotKey, EquipmentSlot>> = { ...build.equipment }
  for (const key of searchedKeys) {
    const slot = fixedEquipment[key]
    if (slot) fixedEquipment[key] = { ...slot, itemStatId: null }
  }
  if (optimizeRunesInfusions) {
    for (const key of RUNE_SLOT_KEYS) {
      const slot = fixedEquipment[key]
      if (slot) fixedEquipment[key] = { ...slot, runeId: null }
    }
    const infusionKeys = new Set(infusionSlots.map((s) => s.equipmentKeys[0]))
    for (const key of infusionKeys) {
      const slot = fixedEquipment[key]
      if (slot) fixedEquipment[key] = { ...slot, infusionIds: (slot.infusionIds ?? []).map(() => null) }
    }
  }
  const fixedBuild: Build = {
    ...build,
    equipment: fixedEquipment,
    foodId: optimizeFoodUtility ? null : build.foodId,
    utilityId: optimizeFoodUtility ? null : build.utilityId
  }

  const gearTotals = computeGearAttributeTotals(fixedBuild, gameData)
  const traitsById = new Map(gameData.traits.map((t: Trait) => [t.id, t]))
  const combatPoints = combatStatePoints(build, combatState, traitsById, gameData.legends)
  const foodById = new Map(gameData.food.map((f) => [f.id, f]))
  const utilityById = new Map(gameData.utility.map((u) => [u.id, u]))

  // Baseline includes active traits' FLAT bonuses (gear-independent, e.g. Revenant/Salvation's
  // "Life Attunement": +120 Healing Power) — safe to fix once like runes/relic. It deliberately
  // does NOT include trait attribute *conversions* (e.g. that same trait's 7% Healing->
  // Concentration) OR food/utility "Gain X Equal to N% of Your Y" conversions (e.g. Superior
  // Sharpening Stone's Power from Precision/Ferocity — confirmed the dominant WvW Utility-consumable
  // shape, see `activeConsumableConversions`'s doc comment): either conversion's source attribute
  // can itself be a searched metric, so its true value isn't known until after the search picks
  // gear — folding it into a pre-search baseline would use an artificially low source value and
  // understate the bonus. The search itself is therefore a slight underestimate of the true
  // achievable value whenever a floor/target's metric is boosted by a conversion sourced from
  // another searched metric (a real but narrow limitation — see TODO.md); the final `metricValues`
  // below are NOT affected, since those are re-derived from the actual resulting build via
  // `applyTraitBonuses`/`applyConversions` (full accuracy, conversions included).
  const baseline = emptyTotals()
  for (const [k, v] of Object.entries(BASE_ATTRIBUTES)) addPoints(baseline, k, v)
  for (const [k, v] of Object.entries(gearTotals.points)) addPoints(baseline, k, v)
  for (const [k, v] of Object.entries(combatPoints)) addPoints(baseline, k, v)
  baseline.bonusPercent = { ...gearTotals.bonusPercent }
  const traitFlat = activeTraitFlatBonuses(build, traitsById)
  for (const [k, v] of Object.entries(traitFlat.points)) addPoints(baseline, k, v)
  // Weapon-equipped-gated trait bonuses (`WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES`) are, like the
  // flat bonuses above, gear-independent from the search's point of view — the optimizer never
  // changes `weaponType` (only `itemStatId`/upgrades per slot), so this value is already fixed by
  // the time the search runs, safe to fold into the baseline the same way (unlike trait
  // *conversions*, whose source attribute a still-being-searched slot could affect).
  for (const [k, v] of Object.entries(activeWeaponEquippedAttributeTraitBonus(build, traitsById))) addPoints(baseline, k, v)
  // Attunement-gated trait bonuses (`ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`) are gear-independent for
  // the same reason — the optimizer never touches `build.activeAttunement`.
  for (const [k, v] of Object.entries(activeAttunementAttributeTraitBonus(build, traitsById))) addPoints(baseline, k, v)
  // Legend-equipped-gated trait bonuses (`LEGEND_ATTRIBUTE_TRAIT_BONUSES`, e.g. Bolstered Bonds)
  // are gear-independent too — the optimizer never touches `build.skills`.
  for (const [k, v] of Object.entries(activeLegendAttributeTraitBonus(build, traitsById, gameData.legends))) addPoints(baseline, k, v)

  const weightClass = WEIGHT_CLASS_BY_PROFESSION[build.profession]
  const ctx: MetricContext = {
    furyFlatCritBonus: combatState.furyActive ? FURY_CRITICAL_CHANCE_PERCENT + furyCritChanceTraitBonus(build, traitsById) : 0,
    baseHealth: BASE_HEALTH_BY_PROFESSION[build.profession] ?? 0,
    defense: weightClass ? fullArmorDefense(weightClass) : 0
  }

  const baselineValues = relevant.map((id) => evaluateMetric(id, baseline, ctx))
  // No matching floor -> -Infinity, i.e. no lower bound to enforce (see `solve`'s doc comment on
  // why that sentinel needs no special-casing elsewhere).
  const requiredDelta = relevant.map((id, i) => {
    const floor = floors.find((f) => f.metric === id)
    return floor ? floor.value - baselineValues[i] : -Infinity
  })

  // Lexicographic multi-tier search: solve for `targets[0]`'s max, pin that achieved value in as
  // an additional floor (so no later tier can trade it away), then solve for `targets[1]`'s max
  // subject to everything so far, and so on. Each tier's `solve()` call still only branches on the
  // *current* target — but because a higher-priority tier's exact achieved value is now a floor,
  // a lower tier can only pick among assignments that already match it.
  let outcome: SolveOutcome | null = null
  let truncatedAny = false
  for (const targetMetric of targets) {
    const targetIndex = relevant.indexOf(targetMetric)
    const tierOutcome = solve(slots, relevant, requiredDelta, targetIndex)
    if (tierOutcome.score === -Infinity) {
      if (!outcome) {
        return {
          feasible: false,
          truncated: tierOutcome.truncated,
          infeasibleFloors: tierOutcome.unreachable.map((m) => relevant[m]),
          slots: [],
          foodId: build.foodId,
          utilityId: build.utilityId,
          metricValues: {},
          build
        }
      }
      // A later tier failing (should only happen on floating-point edge cases, since the previous
      // tier's own assignment trivially satisfies its own pin) — keep the last good tier's result.
      break
    }
    outcome = tierOutcome
    truncatedAny = truncatedAny || tierOutcome.truncated
    requiredDelta[targetIndex] = tierOutcome.score
  }
  const finalOutcome = outcome as SolveOutcome

  const resultEquipment: Partial<Record<EquipmentSlotKey, EquipmentSlot>> = { ...build.equipment }
  const slotResults: OptimizerSlotResult[] = []
  let foodId = build.foodId
  let utilityId = build.utilityId

  slots.forEach((slot, i) => {
    const option = slot.options[finalOutcome.choice[i]]
    switch (slot.kind) {
      case 'food':
        foodId = option.id
        break
      case 'utility':
        utilityId = option.id
        break
      case 'rune':
        for (const key of slot.equipmentKeys) {
          resultEquipment[key] = { ...(resultEquipment[key] ?? { itemStatId: null }), runeId: option.id }
        }
        break
      case 'infusion': {
        // Grows the array as slots for this key are visited (0, 1, 2, ... — the order they were
        // pushed in `armorTrinketInfusionSlots`/`buildWeaponInfusionSlots`), so no pre-known
        // capacity is needed here.
        const key = slot.equipmentKeys[0]
        const idx = slot.infusionIndex ?? 0
        const nextIds = (resultEquipment[key]?.infusionIds ?? []).slice()
        while (nextIds.length <= idx) nextIds.push(null)
        nextIds[idx] = option.id
        resultEquipment[key] = { ...(resultEquipment[key] ?? { itemStatId: null }), infusionIds: nextIds }
        break
      }
      default:
        for (const key of slot.equipmentKeys) {
          resultEquipment[key] = { ...(resultEquipment[key] ?? {}), itemStatId: option.id }
        }
    }
    slotResults.push({ label: slot.label, equipmentKeys: slot.equipmentKeys, chosenId: option.id, chosenLabel: option.label, kind: slot.kind })
  })

  const resultBuild: Build = { ...build, equipment: resultEquipment, foodId, utilityId }

  // Re-derive final totals from `resultBuild` via the same canonical function `StatsPanel` uses
  // (rather than summing `baseline + chosen deltas` by hand) so the reported `metricValues` are
  // guaranteed to match what the Stats panel would show for this exact build, with zero
  // duplicated math to drift out of sync. Unlike `baseline` above, this applies FULL trait
  // bonuses (flat + conversions) AND food/utility conversions since every attribute is now fully
  // known — mirrors `computeCharacterStats`'s own ordering (`applyConversions` before
  // `applyTraitBonuses`) exactly; previously this block reimplemented that function's accumulation
  // by hand and silently dropped the `applyConversions` step, so any build with a "Gain X Equal to
  // N% of Your Y" food/utility item (Superior Sharpening Stone, Tuning Crystals, etc. — 69 WvW
  // utility items alone carry this shape) would show a `metricValues`/`build` that understated the
  // converted stat versus what the Stats panel computes for the identical resulting build (found
  // 2026-08-07 diagnosing the "doesn't function properly" bug report — reproduced a ~100-Power
  // understatement on a Guardian with Superior Sharpening Stone equipped).
  const finalGearTotals = computeGearAttributeTotals(resultBuild, gameData)
  const finalTotals = emptyTotals()
  for (const [k, v] of Object.entries(BASE_ATTRIBUTES)) addPoints(finalTotals, k, v)
  for (const [k, v] of Object.entries(finalGearTotals.points)) addPoints(finalTotals, k, v)
  for (const [k, v] of Object.entries(combatPoints)) addPoints(finalTotals, k, v)
  finalTotals.bonusPercent = { ...finalGearTotals.bonusPercent }
  applyConversions(finalTotals, activeConsumableConversions(resultBuild, foodById, utilityById))
  applyTraitBonuses(finalTotals, build, traitsById, gameData.legends)

  const metricValues: Partial<Record<OptimizerMetricId, number>> = {}
  for (const id of METRIC_IDS) metricValues[id] = evaluateMetric(id, finalTotals, ctx)

  return {
    feasible: true,
    truncated: truncatedAny,
    infeasibleFloors: [],
    slots: slotResults,
    foodId,
    utilityId,
    metricValues,
    build: resultBuild
  }
}
