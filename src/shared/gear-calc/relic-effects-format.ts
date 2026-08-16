import type { Relic, RelicEffect, RelicFactLine } from '@shared/types'

function titleCase(label: string): string {
  return label.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1))
}

/**
 * Formats one parsed `{{skill fact}}` line into a short display string. `alt=` (when present)
 * overrides the raw wiki label for display — it's how the wiki disambiguates same-label facts on
 * one relic (e.g. two "duration" facts distinguished by `alt=Minimum Duration`/`alt=Maximum
 * Duration`) and occasionally corrects a mismatched label (e.g. a "movement speed increase"-named
 * fact that's actually inflicted on an enemy as a decrease, `alt=Movement Speed Decrease`).
 */
export function formatFactLine(fact: RelicFactLine): string {
  const label = fact.params.alt ?? fact.label
  if (fact.label.toLowerCase() === 'effect') {
    const detail = fact.params.desc ?? label
    const duration = fact.values.find((v) => /^\d+(\.\d+)?$/.test(v))
    return duration ? `${detail} (${duration}s)` : detail
  }
  const primary = fact.values.find((v) => /^[\d.]+%?$/.test(v))
  const extras: string[] = []
  if (fact.params.stacks) extras.push(`${fact.params.stacks} stacks`)
  if (!primary && fact.params.coefficient) extras.push(`coefficient ${fact.params.coefficient}`)
  const suffix = extras.length > 0 ? ` (${extras.join(', ')})` : ''
  return primary ? `${titleCase(label)}: ${primary}${suffix}` : `${titleCase(label)}${suffix}`
}

/**
 * Hand-curated corrections/expansions to a relic's auto-fetched `RelicFactLine[]`, applied ahead of
 * `formatFactLine` — same "curated table sits downstream of the generated JSON" discipline
 * `CURATED_PERCENT_FACT_OVERRIDES` (`skill-calc/skill-fact-lines.ts`) uses for skill facts, so a
 * re-run of `npm run fetch-relic-effects` (which fully regenerates `relic-effects.json` from the
 * wiki's own `{{skill fact}}` infobox template) can never silently wipe a hand curation the way
 * directly editing that generated JSON file would.
 */
const CURATED_RELIC_FACT_OVERRIDES: Record<number, (facts: RelicFactLine[]) => RelicFactLine[]> = {
  100893: (facts) => [
    // Relic of the Zephyrite: the wiki infobox's own `{{skill fact}}` template only ever documented
    // a Min/Max pair, and had gone stale (Max read 7 against the wiki's current 8). The FULL stepped
    // table ("Elite Skill Recharge" -> "Crystal Duration") lives in the wiki's prose, not its
    // infobox, so it's hand-transcribed here rather than reparseable by `fetch-relic-effects.ts`.
    // `boon-calc/sources.ts`'s `ZEPHYRITE_CRYSTAL_DURATION_TIERS` computes each build's actual
    // duration from this same table for the aggregate calculator — these facts are display-only.
    ...facts.filter((f) => f.label !== 'duration'),
    { label: 'duration', values: ['4'], params: { alt: 'Crystal Duration (0s Elite Recharge)' } },
    { label: 'duration', values: ['5'], params: { alt: 'Crystal Duration (1–20s Elite Recharge)' } },
    { label: 'duration', values: ['6'], params: { alt: 'Crystal Duration (21–40s Elite Recharge)' } },
    { label: 'duration', values: ['7'], params: { alt: 'Crystal Duration (41–60s Elite Recharge)' } },
    { label: 'duration', values: ['8'], params: { alt: 'Crystal Duration (61s+ Elite Recharge)' } }
  ]
}

/** Applies `CURATED_RELIC_FACT_OVERRIDES` for `relicId`, else returns `facts` unchanged (the
 *  overwhelming majority of relics — no entry above). */
function applyCuratedRelicFacts(relicId: number, facts: RelicFactLine[]): RelicFactLine[] {
  return CURATED_RELIC_FACT_OVERRIDES[relicId]?.(facts) ?? facts
}

/**
 * Combines a relic's prose `description` with its wiki-sourced numeric facts (see
 * scripts/fetch-relic-effects.ts) into one tooltip-ready string — `.tooltip-description` already
 * renders `white-space: pre-line`, same as food/utility's multi-line stat text, so newline-joined
 * lines display correctly with no further UI change needed. Falls back to the plain description
 * alone when this relic has no `RelicEffect` entry (not every relic id could be safely resolved —
 * see the type's doc comment).
 */
export function formatRelicDescription(relic: Relic, effect: RelicEffect | undefined): string {
  const lines = [relic.description]
  if (effect) {
    lines.push(...applyCuratedRelicFacts(relic.id, effect.facts).map(formatFactLine))
    if (effect.rechargeSeconds !== null) lines.push(`Recharge: ${effect.rechargeSeconds}s`)
  }
  return lines.join('\n')
}
