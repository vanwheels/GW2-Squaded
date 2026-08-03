import type { Fact } from '../types'

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString()
}

/**
 * One human-readable line per directly-usable numeric `Fact` (Recharge seconds, hit counts,
 * Number/Distance raw values, `AttributeAdjust`'s base-stat reference number) — everything derivable
 * WITHOUT per-skill wiki curation. Deliberately falls back to `Damage`'s hit count (not a real
 * damage number) and `AttributeAdjust`'s reference-build base value (not a real Healing-Power-scaled
 * number): both need a wiki-verified per-skill coefficient to mean anything (see
 * `CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS`), which most skills don't have yet.
 * Exported so `skill-fact-lines.ts`'s `skillFactLines` can reuse this as its own per-fact fallback
 * for any fact a curated table doesn't cover — skill tooltips show the real number when curated data
 * exists, this generic line otherwise; traits (`TraitsEditor.tsx`) always go through
 * `numericFactLines` unchanged, since neither curated table has a trait entry yet.
 */
export function factLine(fact: Fact): string | null {
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
