import type { Fact } from '../types'

/**
 * Applies `data/game-data/recharge-wvw-overrides.json` (see `scripts/fetch-recharge-wvw-overrides.ts`
 * and `docs/game-data.md`) to a skill/trait's own fact list ahead of display or calculation: every
 * `Recharge`-type fact's `value` is the API's PvE-reference-build cooldown, un-adjusted for WvW —
 * this substitutes the wiki's `recharge wvw=` value when the fetch script found and validated one,
 * exactly mirroring `RelicEffect.rechargeSeconds`'s "prefer the WvW-tagged field over the base one"
 * rule for relics. A `Skill`/`Trait` never carries more than one `Recharge` fact (confirmed live,
 * see that script's own doc comment), so this only ever touches at most one entry in `facts`.
 * Harmless no-op (returns `facts` unchanged, same array reference) when no override exists for this
 * id — the overwhelming majority of calls, same "absent means unsplit or unresolved, fall back to
 * the API value" convention `WvwFactOverrides` already uses. `overridesById` is already narrowed to
 * one kind (`RechargeWvwOverrides.skill` or `.trait`) by the caller — mirrors how
 * `gameData.wvwFactOverrides.skill[skill.id]`/`.trait[trait.id]` are already narrowed at their own
 * call sites, rather than threading the full `{ skill, trait }` shape everywhere.
 */
export function withRechargeOverride(facts: Fact[], id: number, overridesById: Record<number, number>): Fact[] {
  const overrideSeconds = overridesById[id]
  if (overrideSeconds === undefined) return facts
  return facts.map((fact) => (fact.type === 'Recharge' ? { ...fact, value: overrideSeconds } : fact))
}
