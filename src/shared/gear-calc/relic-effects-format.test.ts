import { describe, expect, it } from 'vitest'
import type { Relic, RelicEffect } from '../types'
import { formatRelicDescription } from './relic-effects-format'

/**
 * Regression test for the `CURATED_RELIC_FACT_OVERRIDES` entry added alongside TODO.md's "Relic
 * proc integration sweep" leg-3 Zephyrite follow-up: the wiki infobox's own `{{skill fact}}`
 * template only ever documented a stale Min/Max pair (4/7, against the wiki's current 8) — the
 * curated override replaces those with the full 5-tier stepped table instead.
 */
describe('formatRelicDescription — Relic of the Zephyrite (100893) curated duration override', () => {
  const relic: Relic = {
    id: 100893,
    name: 'Relic of the Zephyrite',
    icon: 'icon.png',
    description: 'Summon crystals that apply protection and resolution to allies after using an elite skill.'
  }
  // Mirrors the auto-fetched shape in data/game-data/relic-effects.json before curation: a stale
  // Min/Max pair (Max reads 7, one behind the wiki's current 8).
  const effect: RelicEffect = {
    facts: [
      { label: 'protection', values: ['1'], params: {} },
      { label: 'resolution', values: ['1'], params: {} },
      { label: 'targets', values: ['5'], params: {} },
      { label: 'duration', values: ['4'], params: { alt: 'Minimum Duration' } },
      { label: 'duration', values: ['7'], params: { alt: 'Maximum Duration' } },
      { label: 'interval', values: ['1'], params: {} },
      { label: 'radius', values: ['360'], params: {} }
    ],
    rechargeSeconds: 30
  }

  it('replaces the stale Min/Max duration facts with the full 5-tier stepped table', () => {
    const text = formatRelicDescription(relic, effect)
    expect(text).toContain('Crystal Duration (0s Elite Recharge): 4')
    expect(text).toContain('Crystal Duration (1–20s Elite Recharge): 5')
    expect(text).toContain('Crystal Duration (21–40s Elite Recharge): 6')
    expect(text).toContain('Crystal Duration (41–60s Elite Recharge): 7')
    expect(text).toContain('Crystal Duration (61s+ Elite Recharge): 8')
    expect(text).not.toContain('Minimum Duration')
    expect(text).not.toContain('Maximum Duration')
  })

  it('leaves the other facts (protection, resolution, targets, interval, radius) untouched', () => {
    const text = formatRelicDescription(relic, effect)
    expect(text).toContain('Protection: 1')
    expect(text).toContain('Resolution: 1')
    expect(text).toContain('Targets: 5')
    expect(text).toContain('Interval: 1')
    expect(text).toContain('Radius: 360')
  })

  it('does not touch an unrelated relic\'s facts', () => {
    const otherRelic: Relic = { id: 100435, name: 'Relic of the Earth', icon: 'icon.png', description: 'desc' }
    const otherEffect: RelicEffect = { facts: [{ label: 'protection', values: ['3'], params: {} }], rechargeSeconds: null }
    expect(formatRelicDescription(otherRelic, otherEffect)).toBe('desc\nProtection: 3')
  })
})
