import type { ResourceCost, ResourceCostsById } from '../types'
import type { FactLine } from './fact-numbers'

/**
 * Skill ids whose wiki infobox WvW value is stale relative to a same-day patch — the infobox page
 * itself hasn't been edited yet even though its own `Game_updates` changelog page documents the
 * split, same wiki-lag class of issue Saint's Shield hit in `dodge-replacement-facts.ts`. Applied
 * on top of the raw fetched entry (not written into `resource-costs.json` directly) so a future
 * `npm run fetch-resource-costs` re-run — which reads only the infobox page, not `Game_updates` —
 * doesn't silently revert the fix. Delete an entry once the wiki page itself is edited and a
 * re-fetch picks up the correct value on its own.
 */
const RESOURCE_COST_WVW_OVERRIDES: Partial<Record<number, Partial<ResourceCost>>> = {
  // Vindicator — Tree Song. Sep 29, 2026 patch reduced WvW energy cost from 25 to 15 (now matches
  // PvE). Infobox last edited 2026-06-13 (still `energy wvw = 25` as of this fix) — confirmed via
  // Game_updates/2026-09-29's own patch-note wording instead of the (stale) infobox fetch.
  62941: { energyWvw: 15 }
}

/**
 * Renders a skill's wiki-sourced `ResourceCost` (see `data/game-data/resource-costs.json`,
 * `scripts/fetch-resource-costs.ts`) as synthetic tooltip lines — there's no `Fact` for any of
 * these in the API, unlike `Recharge`, so unlike `withRechargeOverride` this doesn't patch an
 * existing fact list, it manufactures new lines from scratch. Prefers a cost's `*Wvw` value over
 * its base one when present, same "WvW-first" convention every other override in this app uses
 * (`recharge-override.ts`, `wvwFactOverrides`, `CURATED_PERCENT_FACT_OVERRIDES`, ...). Returns `[]`
 * for a skill with no entry in `resourceCosts` or `RESOURCE_COST_WVW_OVERRIDES` (the overwhelming
 * majority) — harmless no-op, same as `withRechargeOverride`'s absent-id case.
 *
 * Ordered energy -> initiative -> upkeep -> health cost, matching the order a player would think
 * about a cost (what it takes to press the button, then what it costs to keep holding it) —
 * `energy`+`upkeep` are the only pair that ever co-occur (Revenant Legendary-stance skills), so
 * this ordering also happens to put a skill's "up-front" cost before its "ongoing" one.
 */
export function resourceCostLines(skillId: number, resourceCosts: ResourceCostsById): FactLine[] {
  const fetched = resourceCosts[skillId]
  const override = RESOURCE_COST_WVW_OVERRIDES[skillId]
  if (!fetched && !override) return []
  const cost: ResourceCost = { ...fetched, ...override }

  const lines: FactLine[] = []
  const push = (label: string, baseValue: number | undefined, wvw: number | undefined, suffix = ''): void => {
    const value = wvw ?? baseValue
    if (value === undefined) return
    lines.push({ icon: null, text: `${label}: ${value.toLocaleString()}${suffix}` })
  }

  push('Energy', cost.energy, cost.energyWvw)
  push('Initiative', cost.initiative, cost.initiativeWvw)
  push('Upkeep', cost.upkeep, cost.upkeepWvw, '/s')
  push('Health Cost', cost.healthCost, cost.healthCostWvw)

  return lines
}
