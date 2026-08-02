import type { Build, Consumable, EquipmentSlot, EquipmentSlotKey, GameData, ItemStat, Trait } from '../types'
import {
  addBonus,
  addPoints,
  boonDurationPercent,
  conditionDurationPercent,
  computeGearAttributeTotals,
  emptyTotals,
  isActiveWeaponSlot,
  magicFindPercent,
  SLOT_ADJUSTMENT_KEY,
  statComboContribution,
  type AdjustmentKey,
  type AttributeTotals
} from './attribute-totals'
import { BASE_ATTRIBUTES, BASE_CRITICAL_CHANCE_PERCENT, PRECISION_PER_CRITICAL_CHANCE_PERCENT } from './derived-stats'
import { combatStatePoints, furyCritChanceTraitBonus, FURY_CRITICAL_CHANCE_PERCENT, type CombatState } from './combat-state'
import { formatItemStatName } from './format-description'

/**
 * The 11 stat metrics the Gear Optimizer can be given as a floor and/or a maximize target. The 7
 * point-based ids match `AttributeTotals.points` keys directly (see `metricDelta`/`evaluateMetric`
 * below); the 4 percent-based ids are derived values with no raw-point equivalent worth exposing
 * (Magic Find has no raw-point form at all; Boon/Condition Duration and Critical Chance all mix a
 * raw-point term with a flat bonus — food/utility/Fury — that a raw-points floor would silently
 * ignore). Entered/displayed in the same unit `StatsPanel` already shows each in.
 */
export type OptimizerMetricId =
  | 'Power'
  | 'Precision'
  | 'Toughness'
  | 'Vitality'
  | 'CritDamage'
  | 'Healing'
  | 'ConditionDamage'
  | 'BoonDurationPercent'
  | 'ConditionDurationPercent'
  | 'MagicFindPercent'
  | 'CriticalChancePercent'

export interface OptimizerMetric {
  id: OptimizerMetricId
  label: string
  unit: 'points' | 'percent'
}

export const OPTIMIZER_METRICS: OptimizerMetric[] = [
  { id: 'Power', label: 'Power', unit: 'points' },
  { id: 'Precision', label: 'Precision', unit: 'points' },
  { id: 'Toughness', label: 'Toughness', unit: 'points' },
  { id: 'Vitality', label: 'Vitality', unit: 'points' },
  { id: 'CritDamage', label: 'Ferocity', unit: 'points' },
  { id: 'Healing', label: 'Healing Power', unit: 'points' },
  { id: 'ConditionDamage', label: 'Condition Damage', unit: 'points' },
  { id: 'BoonDurationPercent', label: 'Boon Duration', unit: 'percent' },
  { id: 'ConditionDurationPercent', label: 'Condition Duration', unit: 'percent' },
  { id: 'MagicFindPercent', label: 'Magic Find', unit: 'percent' },
  { id: 'CriticalChancePercent', label: 'Critical Chance', unit: 'percent' }
]

/**
 * A metric's value purely from a *delta* (no baseline/base-attribute offset) — used during search
 * to score candidate slot choices against each other. Boon/Condition Duration and Magic Find have
 * no baseline offset at all (base value 0), so their normal derived-value functions already double
 * as their delta form; Critical Chance's baseline offset (base 5% + Fury) is stripped out here,
 * leaving just the Precision-per-21 term.
 */
function metricDelta(id: OptimizerMetricId, delta: AttributeTotals): number {
  switch (id) {
    case 'BoonDurationPercent':
      return boonDurationPercent(delta)
    case 'ConditionDurationPercent':
      return conditionDurationPercent(delta)
    case 'MagicFindPercent':
      return magicFindPercent(delta)
    case 'CriticalChancePercent':
      return (delta.points.Precision ?? 0) / PRECISION_PER_CRITICAL_CHANCE_PERCENT
    default:
      return delta.points[id] ?? 0
  }
}

/** A metric's real, final value against full accumulated totals (baseline + every chosen delta) —
 *  matches exactly what `computeCharacterStats`/`StatsPanel` would show for the resulting build. */
function evaluateMetric(id: OptimizerMetricId, totals: AttributeTotals, furyFlatCritBonus: number): number {
  if (id === 'CriticalChancePercent') {
    return (
      BASE_CRITICAL_CHANCE_PERCENT +
      ((totals.points.Precision ?? 0) - 1000) / PRECISION_PER_CRITICAL_CHANCE_PERCENT +
      furyFlatCritBonus
    )
  }
  return metricDelta(id, totals)
}

function deltaSignature(delta: AttributeTotals, relevant: OptimizerMetricId[]): string {
  return relevant.map((id) => Math.round(metricDelta(id, delta) * 100)).join('|')
}

interface SearchOption {
  /** `ItemStat.id`, `Consumable.id`, or `null` for a food/utility slot's "none" option. */
  id: number | null
  label: string
  delta: AttributeTotals
  /** Precomputed `metricDelta` per entry of `relevant` (same order), so the solver never has to
   *  re-derive a metric value from `delta` while searching. */
  relevantDeltas: number[]
}

export interface OptimizerSlot {
  /** Stable id for result reporting, e.g. `'helm'`, `'weaponA1'`, `'food'`. */
  id: string
  label: string
  /** Empty for the food/utility slots, which aren't tied to an `EquipmentSlotKey`. */
  equipmentKeys: EquipmentSlotKey[]
  options: SearchOption[]
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

/** One legal stat-combo option per unique (relevant-metric) delta shape for a given slot
 *  category+adjustment tier — collapses the ~40 legal ids per category down to a handful of
 *  distinct "shapes" before the solver ever sees them. */
function statOptionsFor(itemStats: ItemStat[], legalIds: Set<number>, adjustmentKey: AdjustmentKey, relevant: OptimizerMetricId[]): SearchOption[] {
  const seen = new Map<string, SearchOption>()
  for (const stat of itemStats) {
    if (!legalIds.has(stat.id) || stat.name.trim() === '') continue
    const delta = statComboContribution(stat, adjustmentKey)
    const sig = deltaSignature(delta, relevant)
    if (seen.has(sig)) continue
    seen.set(sig, { id: stat.id, label: formatItemStatName(stat.name), delta, relevantDeltas: relevant.map((id) => metricDelta(id, delta)) })
  }
  return [...seen.values()]
}

function consumableOptionsFor(catalog: Consumable[], relevant: OptimizerMetricId[]): SearchOption[] {
  const seen = new Map<string, SearchOption>()
  seen.set('none', { id: null, label: 'None', delta: emptyTotals(), relevantDeltas: relevant.map(() => 0) })
  for (const item of catalog) {
    const delta = emptyTotals()
    for (const bonus of item.bonuses) addBonus(delta, bonus)
    const sig = deltaSignature(delta, relevant)
    if (seen.has(sig)) continue
    seen.set(sig, { id: item.id, label: item.name, delta, relevantDeltas: relevant.map((id) => metricDelta(id, delta)) })
  }
  return [...seen.values()]
}

/** Which land/underwater weapon slots actually count right now — mirrors `isActiveWeaponSlot`'s
 *  "only the currently-active set contributes" rule, so the optimizer only touches slots that
 *  actually affect the totals it's constraining. The inactive set's `itemStatId` is left untouched
 *  in the result. */
function buildWeaponSlots(build: Build, gameData: Pick<GameData, 'professions'>, relevant: OptimizerMetricId[], legalArmorWeapon: Set<number>, itemStats: ItemStat[]): OptimizerSlot[] {
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

export interface OptimizerFloor {
  metric: OptimizerMetricId
  /** Minimum required value, in the metric's natural unit (points or percent). */
  value: number
}

export interface OptimizerInput {
  build: Build
  gameData: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'professions' | 'infusions' | 'runes' | 'food' | 'utility' | 'traits'>
  combatState: CombatState
  floors: OptimizerFloor[]
  target: OptimizerMetricId
  /** When true, food and utility choice are search variables too (in addition to gear); when
   *  false, the build's current food/utility (if any) are treated as fixed inputs, same as
   *  runes/sigils/relic. */
  optimizeFoodUtility: boolean
}

export interface OptimizerSlotResult {
  label: string
  equipmentKeys: EquipmentSlotKey[]
  chosenId: number | null
  chosenLabel: string
}

export interface OptimizerResult {
  feasible: boolean
  /** True if the node budget was exhausted before the search could prove optimality — `slots`
   *  still holds the best assignment found, just not a guaranteed-optimal one. */
  truncated: boolean
  /** Populated when `feasible` is false: which floor(s) are mathematically unreachable even
   *  giving every slot its best-possible contribution to that one metric. */
  infeasibleFloors: OptimizerMetricId[]
  slots: OptimizerSlotResult[]
  foodId: number | null
  utilityId: number | null
  /** Final value of every metric that was in play (every floor, plus the target), evaluated the
   *  same way `computeCharacterStats` would. */
  metricValues: Partial<Record<OptimizerMetricId, number>>
  /** The source build with the result's `itemStatId`s (and `foodId`/`utilityId` if
   *  `optimizeFoodUtility`) applied — ready to feed into `computeCharacterStats` for a full
   *  preview, or to save directly via `updateBuild`. */
  build: Build
}

const NODE_LIMIT = 200_000

interface SolveOutcome {
  choice: number[]
  score: number
  truncated: boolean
  /** Indices into `relevant` that are mathematically unreachable even giving every slot its best
   *  possible contribution — empty unless that's exactly why this outcome has no `choice`. */
  unreachable: number[]
}

/**
 * `requiredDelta[m]` is `-Infinity` for any metric with no floor (including the target, when it
 * has none) — every comparison below (`accum[m] >= requiredDelta[m]`, `best < requiredDelta[m]`)
 * is trivially satisfied against `-Infinity`, so unconstrained metrics fall out of every check for
 * free without a separate `m === targetIndex` special case. This also correctly handles the one
 * edge case that special-casing `targetIndex` would have broken: a floor set on the same metric
 * being maximized.
 */
function solve(slots: OptimizerSlot[], relevant: OptimizerMetricId[], requiredDelta: number[], targetIndex: number): SolveOutcome {
  const slotCount = slots.length
  const EPS = 1e-6

  const bestPerSlotPerMetric: number[][] = slots.map((slot) =>
    relevant.map((_, m) => Math.max(...slot.options.map((o) => o.relevantDeltas[m])))
  )
  const totalBest = relevant.map((_, m) => bestPerSlotPerMetric.reduce((sum, row) => sum + row[m], 0))

  // Upfront impossibility check: even with every slot independently maximized per floor metric,
  // some floor still can't be reached — no search can fix that (slots being shared resources only
  // makes the true optimum worse than this, never better).
  const unreachable = relevant.map((_, m) => m).filter((m) => totalBest[m] < requiredDelta[m] - EPS)
  if (unreachable.length > 0) return { choice: [], score: -Infinity, truncated: false, unreachable }

  function isFeasible(accum: number[]): boolean {
    return relevant.every((_, m) => accum[m] >= requiredDelta[m] - EPS)
  }

  // Greedy warm start: repeatedly close the largest outstanding floor gap using whichever
  // remaining slot's option contributes most to it, then let every still-unassigned slot pick its
  // own best target contribution independently (optimal once no constraints remain). Gives
  // branch-and-bound a real incumbent to prune against from node 1 instead of starting blind.
  const assigned = new Array<number>(slotCount).fill(-1)
  const usedSlot = new Array<boolean>(slotCount).fill(false)
  const remainingGap = requiredDelta.slice()

  function worstUnmetFloor(): number {
    let worst = -1
    let worstGap = EPS
    for (let m = 0; m < relevant.length; m++) {
      if (remainingGap[m] > worstGap) {
        worstGap = remainingGap[m]
        worst = m
      }
    }
    return worst
  }

  for (let floorIdx = worstUnmetFloor(); floorIdx !== -1; floorIdx = worstUnmetFloor()) {
    let bestSlot = -1
    let bestOption = -1
    let bestContribution = -Infinity
    for (let s = 0; s < slotCount; s++) {
      if (usedSlot[s]) continue
      slots[s].options.forEach((option, o) => {
        if (option.relevantDeltas[floorIdx] > bestContribution) {
          bestContribution = option.relevantDeltas[floorIdx]
          bestSlot = s
          bestOption = o
        }
      })
    }
    if (bestSlot === -1) break
    usedSlot[bestSlot] = true
    assigned[bestSlot] = bestOption
    for (let m = 0; m < relevant.length; m++) remainingGap[m] -= slots[bestSlot].options[bestOption].relevantDeltas[m]
  }
  for (let s = 0; s < slotCount; s++) {
    if (usedSlot[s]) continue
    let bestOption = 0
    let bestValue = -Infinity
    slots[s].options.forEach((option, o) => {
      if (option.relevantDeltas[targetIndex] > bestValue) {
        bestValue = option.relevantDeltas[targetIndex]
        bestOption = o
      }
    })
    assigned[s] = bestOption
  }
  const greedyAccum = relevant.map((_, m) => slots.reduce((sum, slot, s) => sum + slot.options[assigned[s]].relevantDeltas[m], 0))

  let best: { choice: number[]; score: number } | null = isFeasible(greedyAccum) ? { choice: assigned.slice(), score: greedyAccum[targetIndex] } : null
  let nodeCount = 0
  let truncated = false

  // Slots with the widest spread in target contribution are branched on first, so a strong
  // incumbent is found quickly and later slots prune hard against it.
  const order = slots
    .map((_, i) => i)
    .sort((a, b) => {
      const spread = (i: number): number => {
        const values = slots[i].options.map((o) => o.relevantDeltas[targetIndex])
        return Math.max(...values) - Math.min(...values)
      }
      return spread(b) - spread(a)
    })
  // Suffix best-possible-per-metric sums aligned to `order`: index i holds the sum, over
  // order[i..], of that slot's single best contribution to each relevant metric — an admissible
  // bound for both pruning rules below.
  const suffixBest: number[][] = new Array(slotCount + 1).fill(null).map(() => new Array(relevant.length).fill(0))
  for (let i = slotCount - 1; i >= 0; i--) {
    const row = bestPerSlotPerMetric[order[i]]
    for (let m = 0; m < relevant.length; m++) suffixBest[i][m] = suffixBest[i + 1][m] + row[m]
  }

  const accum = new Array(relevant.length).fill(0)
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
    for (let m = 0; m < relevant.length; m++) {
      if (accum[m] + suffixBest[depth][m] < requiredDelta[m] - EPS) return
    }

    const slotIdx = order[depth]
    const options = slots[slotIdx].options
    const byTargetDesc = options.map((_, i) => i).sort((a, b) => options[b].relevantDeltas[targetIndex] - options[a].relevantDeltas[targetIndex])
    for (const optIdx of byTargetDesc) {
      const deltas = options[optIdx].relevantDeltas
      for (let m = 0; m < relevant.length; m++) accum[m] += deltas[m]
      choice[slotIdx] = optIdx
      dfs(depth + 1)
      for (let m = 0; m < relevant.length; m++) accum[m] -= deltas[m]
      if (truncated) return
    }
  }

  dfs(0)

  const finalBest = best as { choice: number[]; score: number } | null
  if (finalBest) return { choice: finalBest.choice, score: finalBest.score, truncated, unreachable: [] }
  return { choice: [], score: -Infinity, truncated, unreachable: [] }
}

export function optimizeGear(input: OptimizerInput): OptimizerResult {
  const { build, gameData, combatState, floors, target, optimizeFoodUtility } = input

  const relevant: OptimizerMetricId[] = [...new Set([...floors.map((f) => f.metric), target])]
  const targetIndex = relevant.indexOf(target)

  // Slots being searched: every armor/trinket slot always, the active weapon set's slots if a
  // weapon is equipped there, and food/utility only if the caller opted in.
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
  slots.push(...buildWeaponSlots(build, gameData, relevant, legalArmorWeapon, gameData.itemStats))

  const searchedKeys = new Set(slots.flatMap((s) => s.equipmentKeys))

  if (optimizeFoodUtility) {
    slots.push({ id: 'food', label: 'Food', equipmentKeys: [], options: consumableOptionsFor(gameData.food, relevant) })
    slots.push({ id: 'utility', label: 'Utility', equipmentKeys: [], options: consumableOptionsFor(gameData.utility, relevant) })
  }

  // Baseline: every fixed contribution (runes, infusions, current food/utility if not being
  // searched, weapon-type-derived nothing) with every searched slot's itemStatId nulled out so it
  // contributes nothing here — the search adds its own delta back on top. Nulling itemStatId
  // (not the whole slot) keeps rune/infusion contributions, which are always fixed regardless of
  // `optimizeFoodUtility`.
  const fixedEquipment: Partial<Record<EquipmentSlotKey, EquipmentSlot>> = { ...build.equipment }
  for (const key of searchedKeys) {
    const slot = fixedEquipment[key]
    if (slot) fixedEquipment[key] = { ...slot, itemStatId: null }
  }
  const fixedBuild: Build = {
    ...build,
    equipment: fixedEquipment,
    foodId: optimizeFoodUtility ? null : build.foodId,
    utilityId: optimizeFoodUtility ? null : build.utilityId
  }

  const gearTotals = computeGearAttributeTotals(fixedBuild, gameData)
  const combatPoints = combatStatePoints(build, combatState)
  const baseline = emptyTotals()
  for (const [k, v] of Object.entries(BASE_ATTRIBUTES)) addPoints(baseline, k, v)
  for (const [k, v] of Object.entries(gearTotals.points)) addPoints(baseline, k, v)
  for (const [k, v] of Object.entries(combatPoints)) addPoints(baseline, k, v)
  baseline.bonusPercent = { ...gearTotals.bonusPercent }

  const traitsById = new Map(gameData.traits.map((t: Trait) => [t.id, t]))
  const furyFlatCritBonus = combatState.furyActive ? FURY_CRITICAL_CHANCE_PERCENT + furyCritChanceTraitBonus(build, traitsById) : 0

  const baselineValues = relevant.map((id) => evaluateMetric(id, baseline, furyFlatCritBonus))
  // No matching floor -> -Infinity, i.e. no lower bound to enforce (see `solve`'s doc comment on
  // why that sentinel needs no special-casing elsewhere, including when the target itself has a
  // floor set on it).
  const requiredDelta = relevant.map((id, i) => {
    const floor = floors.find((f) => f.metric === id)
    return floor ? floor.value - baselineValues[i] : -Infinity
  })

  const outcome = solve(slots, relevant, requiredDelta, targetIndex)

  if (outcome.score === -Infinity) {
    return {
      feasible: false,
      truncated: outcome.truncated,
      infeasibleFloors: outcome.unreachable.map((m) => relevant[m]),
      slots: [],
      foodId: build.foodId,
      utilityId: build.utilityId,
      metricValues: {},
      build
    }
  }

  const resultEquipment: Partial<Record<EquipmentSlotKey, EquipmentSlot>> = { ...build.equipment }
  const slotResults: OptimizerSlotResult[] = []
  let foodId = build.foodId
  let utilityId = build.utilityId

  slots.forEach((slot, i) => {
    const option = slot.options[outcome.choice[i]]
    if (slot.id === 'food') {
      foodId = option.id
    } else if (slot.id === 'utility') {
      utilityId = option.id
    } else {
      for (const key of slot.equipmentKeys) {
        resultEquipment[key] = { ...(resultEquipment[key] ?? {}), itemStatId: option.id }
      }
    }
    slotResults.push({ label: slot.label, equipmentKeys: slot.equipmentKeys, chosenId: option.id, chosenLabel: option.label })
  })

  const resultBuild: Build = { ...build, equipment: resultEquipment, foodId, utilityId }

  // Re-derive final totals from `resultBuild` via the same canonical function `StatsPanel` uses
  // (rather than summing `baseline + chosen deltas` by hand) so the reported `metricValues` are
  // guaranteed to match what the Stats panel would show for this exact build, with zero
  // duplicated math to drift out of sync.
  const finalGearTotals = computeGearAttributeTotals(resultBuild, gameData)
  const finalTotals = emptyTotals()
  for (const [k, v] of Object.entries(BASE_ATTRIBUTES)) addPoints(finalTotals, k, v)
  for (const [k, v] of Object.entries(finalGearTotals.points)) addPoints(finalTotals, k, v)
  for (const [k, v] of Object.entries(combatPoints)) addPoints(finalTotals, k, v)
  finalTotals.bonusPercent = { ...finalGearTotals.bonusPercent }

  const metricValues: Partial<Record<OptimizerMetricId, number>> = {}
  for (const id of relevant) metricValues[id] = evaluateMetric(id, finalTotals, furyFlatCritBonus)

  return {
    feasible: true,
    truncated: outcome.truncated,
    infeasibleFloors: [],
    slots: slotResults,
    foodId,
    utilityId,
    metricValues,
    build: resultBuild
  }
}
