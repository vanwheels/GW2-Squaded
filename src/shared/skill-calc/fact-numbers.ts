import type { Fact } from '../types'

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString()
}

/**
 * One human-readable line per directly-usable numeric `Fact` (Recharge seconds, hit counts,
 * Number/Distance raw values, `AttributeAdjust`'s base-stat reference number) — everything the API
 * gives us WITHOUT needing an unverified damage formula. Deliberately excludes `Damage`'s
 * `dmg_multiplier`: turning that into a real damage number needs a per-weapon-type average weapon
 * strength constant (wiki-quoted, same as `attribute-totals.ts`'s `ATTRIBUTE_ADJUSTMENT` table)
 * PLUS the exact formula ArenaNet's tooltip uses to combine it with `dmg_multiplier` — cross-
 * checking a real example (Judge's Intervention: API `dmg_multiplier: 0.5` vs. the wiki's own
 * documented tooltip damage "133") against every formula this session could derive from the
 * wiki's public damage-formula pages came out ~20-30% off in every attempt, so the exact
 * combination isn't reliably known yet. A wrong-but-plausible-looking damage number would be worse
 * than none, so only `Damage`'s hit count is surfaced (still real, useful information) until that
 * gap gets its own dedicated verification pass — see TODO.md.
 */
function factLine(fact: Fact): string | null {
  switch (fact.type) {
    case 'Recharge':
      return typeof fact.value === 'number' ? `Recharge: ${fact.value}s` : null
    case 'Damage': {
      const hitCount = fact.hit_count
      return typeof hitCount === 'number' ? `Damage: ${hitCount} hit${hitCount === 1 ? '' : 's'}` : null
    }
    case 'HealingAdjust': {
      const hitCount = fact.hit_count
      return typeof hitCount === 'number' ? `Healing: ${hitCount} hit${hitCount === 1 ? '' : 's'}` : null
    }
    case 'AttributeAdjust':
      return typeof fact.value === 'number' && (typeof fact.text === 'string' || typeof fact.target === 'string')
        ? `${typeof fact.text === 'string' ? fact.text : fact.target} (base): ${formatNumber(fact.value)}`
        : null
    case 'Number':
    case 'Range':
      return typeof fact.value === 'number'
        ? `${typeof fact.text === 'string' ? fact.text : fact.type}: ${formatNumber(fact.value)}`
        : null
    case 'Distance':
      return typeof fact.distance === 'number'
        ? `${typeof fact.text === 'string' ? fact.text : 'Distance'}: ${formatNumber(fact.distance)}`
        : null
    case 'Time':
      return typeof fact.duration === 'number'
        ? `${typeof fact.text === 'string' ? fact.text : 'Time'}: ${fact.duration}s`
        : null
    default:
      return null
  }
}

/**
 * Gated by the same `requires_trait` rule as the boon/condition extractor in `boon-calc/sources.ts`
 * (a conditional fact only counts once the trait unlocking it is actually chosen). Deduplicates
 * identical lines (e.g. a skill with 2 near-identical Damage facts for a physical + condition
 * component both reporting the same hit count) rather than repeating them.
 */
export function numericFactLines(facts: Fact[], traitedFacts: Fact[], activeIds: ReadonlySet<number>): string[] {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const fact of [...facts, ...traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    const line = factLine(fact)
    if (line && !seen.has(line)) {
      seen.add(line)
      lines.push(line)
    }
  }
  return lines
}
