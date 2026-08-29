import type { ResourceCostsById } from '../types'
import type { FactLine } from './fact-numbers'

/**
 * Renders a skill's wiki-sourced `ResourceCost` (see `data/game-data/resource-costs.json`,
 * `scripts/fetch-resource-costs.ts`) as synthetic tooltip lines — there's no `Fact` for any of
 * these in the API, unlike `Recharge`, so unlike `withRechargeOverride` this doesn't patch an
 * existing fact list, it manufactures new lines from scratch. Prefers a cost's `*Wvw` value over
 * its base one when present, same "WvW-first" convention every other override in this app uses
 * (`recharge-override.ts`, `wvwFactOverrides`, `CURATED_PERCENT_FACT_OVERRIDES`, ...). Returns `[]`
 * for a skill with no entry in `resourceCosts` (the overwhelming majority) — harmless no-op, same
 * as `withRechargeOverride`'s absent-id case.
 *
 * Ordered energy -> initiative -> upkeep -> health cost, matching the order a player would think
 * about a cost (what it takes to press the button, then what it costs to keep holding it) —
 * `energy`+`upkeep` are the only pair that ever co-occur (Revenant Legendary-stance skills), so
 * this ordering also happens to put a skill's "up-front" cost before its "ongoing" one.
 */
export function resourceCostLines(skillId: number, resourceCosts: ResourceCostsById): FactLine[] {
  const cost = resourceCosts[skillId]
  if (!cost) return []

  const lines: FactLine[] = []
  const push = (label: string, base: number | undefined, wvw: number | undefined, suffix = ''): void => {
    const value = wvw ?? base
    if (value === undefined) return
    lines.push({ icon: null, text: `${label}: ${value.toLocaleString()}${suffix}` })
  }

  push('Energy', cost.energy, cost.energyWvw)
  push('Initiative', cost.initiative, cost.initiativeWvw)
  push('Upkeep', cost.upkeep, cost.upkeepWvw, '/s')
  push('Health Cost', cost.healthCost, cost.healthCostWvw)

  return lines
}
