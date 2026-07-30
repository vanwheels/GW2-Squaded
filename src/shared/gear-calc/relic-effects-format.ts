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
function formatFactLine(fact: RelicFactLine): string {
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
    lines.push(...effect.facts.map(formatFactLine))
    if (effect.rechargeSeconds !== null) lines.push(`Recharge: ${effect.rechargeSeconds}s`)
  }
  return lines.join('\n')
}
