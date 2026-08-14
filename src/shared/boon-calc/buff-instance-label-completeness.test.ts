import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact } from '../types'
import { BUFF_INSTANCE_LABELS } from './sources'

/**
 * `BUFF_INSTANCE_LABELS` staleness scan — a game-data refresh (`npm run fetch-game-data`) can
 * silently reshuffle a skill's/trait's raw `facts` array (a rebalance changing a duration/apply_count,
 * or just ArenaNet reordering the API response), and `resolveInstanceLabel` in sources.ts (see its
 * own doc comment) deliberately renders NO qualifier on a lookup miss rather than guessing — so a
 * drifted key doesn't crash or mis-render, it just silently reverts to the exact "unlabeled duplicate
 * rows" bug this whole table exists to fix. This test makes that failure loud instead: every curated
 * key must still resolve against the source's CURRENT `facts` (`skill.facts` + the same
 * `synthetic-facts.json` overlay `load-game-data.ts`'s `withSyntheticFacts` applies, since several
 * entries — e.g. Icerazor's Ire, Breakrazor's Bastion — are synthetic-only sources) using the exact
 * same status/duration/apply_count-tuple-plus-occurrence-index scheme `extractFromFacts` resolves
 * labels through.
 *
 * Not a coverage scan (unlike the sibling `trait-attribute-completeness.test.ts`/
 * `sigil-named-fact-completeness.test.ts`): TODO.md's bug entry tracks the remaining uncurated
 * conflict sources (across 7 professions now, after the Revenant/Thief legs) as an open backlog
 * item, not something CI should fail on — this test only guards the entries that already exist.
 */

interface SkillDataFile {
  id: number
  facts: Fact[]
  traitedFacts: Fact[]
}

interface TraitDataFile {
  id: number
  facts: Fact[]
  traitedFacts: Fact[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const skills: SkillDataFile[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/skills.json'), 'utf-8'))
const traits: TraitDataFile[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'))
const syntheticFacts: Record<string, Fact[]> = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/synthetic-facts.json'), 'utf-8'))
const skillsById = new Map(skills.map((s) => [s.id, s]))
const traitsById = new Map(traits.map((t) => [t.id, t]))

/** Every `${status}@${duration}@${applyCount}` tuple present on one source's combined
 *  facts/traitedFacts, keyed with a `#<occurrence>` suffix for the 2nd/3rd/... fact sharing a tuple —
 *  same scheme `extractFromFacts`'s pre-pass builds, reimplemented here independently (not imported)
 *  so this test would actually catch a bug in that pre-pass too, not just data drift. */
function buffTupleKeys(facts: Fact[]): Set<string> {
  const seen = new Map<string, number>()
  const keys = new Set<string>()
  for (const fact of facts) {
    if ((fact.type !== 'Buff' && fact.type !== 'PrefixedBuff') || typeof fact.status !== 'string' || typeof fact.duration !== 'number') continue
    const applyCount = fact.apply_count ?? 1
    const base = `${fact.status}@${fact.duration}@${applyCount}`
    const occurrence = (seen.get(base) ?? 0) + 1
    seen.set(base, occurrence)
    keys.add(base)
    keys.add(`${base}#${occurrence}`)
  }
  return keys
}

describe('BUFF_INSTANCE_LABELS key staleness', () => {
  it('every curated skill key still resolves against current skill facts (+ synthetic-facts.json overlay)', () => {
    const stale: string[] = []
    for (const [idStr, labels] of Object.entries(BUFF_INSTANCE_LABELS.skill)) {
      const id = Number(idStr)
      const skill = skillsById.get(id)
      if (!skill) {
        stale.push(`skill ${id}: no longer exists in skills.json`)
        continue
      }
      const combined = [...skill.facts, ...skill.traitedFacts, ...(syntheticFacts[idStr] ?? [])]
      const validKeys = buffTupleKeys(combined)
      for (const key of Object.keys(labels)) {
        if (!validKeys.has(key)) stale.push(`skill ${id} ("${key}" → "${labels[key]}"): no matching fact tuple`)
      }
    }
    expect(stale, 'BUFF_INSTANCE_LABELS key(s) that no longer match any real fact on their source — re-derive from the source\'s current facts.').toEqual([])
  })

  it('every curated trait key still resolves against current trait facts (no synthetic-facts.json overlay — traits don\'t get one)', () => {
    const stale: string[] = []
    for (const [idStr, labels] of Object.entries(BUFF_INSTANCE_LABELS.trait)) {
      const id = Number(idStr)
      const trait = traitsById.get(id)
      if (!trait) {
        stale.push(`trait ${id}: no longer exists in traits.json`)
        continue
      }
      const combined = [...trait.facts, ...trait.traitedFacts]
      const validKeys = buffTupleKeys(combined)
      for (const key of Object.keys(labels)) {
        if (!validKeys.has(key)) stale.push(`trait ${id} ("${key}" → "${labels[key]}"): no matching fact tuple`)
      }
    }
    expect(stale, 'BUFF_INSTANCE_LABELS key(s) that no longer match any real fact on their source — re-derive from the source\'s current facts.').toEqual([])
  })
})
