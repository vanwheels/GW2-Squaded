import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact } from '../types'
import {
  FLAT_CRIT_CHANCE_TRAIT_BONUSES,
  FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES,
  FURY_CRIT_CHANCE_TRAIT_BONUSES,
  HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES,
  MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES
} from './combat-state'

/**
 * Critical-hit-chance trait completeness scan — same "coverage test, not correctness test" shape as
 * `trait-attribute-completeness.test.ts` (that file only scans `AttributeAdjust`/`BuffConversion`
 * facts, which structurally can't express a `Percent`-typed "Critical Chance Increase" fact, so this
 * is a separate scan rather than an extension of that one). Built 2026-08-15 running exactly this
 * scan by hand: 26 traits in `data/game-data/traits.json` carry a qualifying fact; 6 were already
 * covered by `FURY_CRIT_CHANCE_TRAIT_BONUSES`/`FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES`, 3 more by
 * the new `FLAT_CRIT_CHANCE_TRAIT_BONUSES` (unconditional), 1 by `HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES`
 * (health-tier-gated), 1 by `MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES` (Berserk-mode-gated); the
 * other 15 are foe-state-gated (vs. Defiant/Disabled/Burning/Weakened/behind-or-side/in-range foes,
 * or scaling per condition/vulnerability stack on the *foe*), own-resource-gated (Guardian's
 * Resolution, Ranger's Opening Strike, Necromancer's per-condition-on-foe, Mesmer's per-clone-shatter
 * Alacrity), or a proc/temporary-buff-on-cast value (Burst Precision) — none of these have any
 * `CombatState` concept to gate against yet, same "genuine stat gain, no infra" shape TODO.md's
 * "New attribute-bonus gaps needing new CombatState infra" section already tracks for other
 * attributes; logged in `EXCLUDED_CRIT_CHANCE_TRAIT_IDS` below with a stated reason each rather than
 * silently skipped.
 */

interface TraitDataFile {
  id: number
  name: string
  facts: Fact[]
  traitedFacts: Fact[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const traits: TraitDataFile[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'))

/** A trait "touches critical-hit chance" if either its `facts` or `traitedFacts` array carries a
 *  `Percent`-typed fact whose `text` mentions "critical...chance" (covers "Critical Chance
 *  Increase", "Critical Chance per Stack", "High-Health Critical Chance Increase", and any
 *  `alt=`-renamed variant of the same underlying fact slot — all confirmed via the full scan this
 *  test's header comment describes). */
function touchesCritChance(trait: TraitDataFile): boolean {
  const isCritChanceFact = (f: Fact): boolean => f.type === 'Percent' && typeof f.text === 'string' && /critical.?(hit.?)?chance/i.test(f.text)
  return trait.facts.some(isCritChanceFact) || trait.traitedFacts.some(isCritChanceFact)
}

const COVERED_TRAIT_IDS = new Set<number>([
  ...Object.keys(FURY_CRIT_CHANCE_TRAIT_BONUSES).map(Number),
  ...Object.keys(FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES).map(Number),
  ...Object.keys(FLAT_CRIT_CHANCE_TRAIT_BONUSES).map(Number),
  ...Object.keys(HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES).map(Number),
  ...Object.keys(MECHANIC_ACTIVE_CRIT_CHANCE_TRAIT_BONUSES).map(Number)
])

const EXCLUDED_CRIT_CHANCE_TRAIT_IDS: Record<number, string> = {
  568: 'Foe-state-gated (attacks against burning foes) — no foe-condition-state tracking exists in this codebase.', // Radiant Power
  810: 'Foe-state-gated, scales per condition currently on the foe — no foe-condition-stack tracking exists.', // Target the Weak
  1011: "Own-resource-gated (Opening Strike, a Ranger-specific proc buff) — no CombatState concept for it exists.", // Precise Strike
  1068: 'Foe-state-gated (from behind/the side, or vs. a defiant foe) — no foe-positional/defiant-state tracking exists.', // Hunter's Tactics
  1215: 'Own-resource-gated (stealth, including a post-reveal linger window) — no stealth-state CombatState concept exists.', // Hidden Killer
  1268: 'Foe-state-gated (from behind/the side, or vs. a defiant foe) — same shape as Hunter\'s Tactics (1068).', // Twin Fangs
  1315: 'Foe-state-gated (vs. disabled or defiant foes) — no foe-disable-state tracking exists.', // Unsuspecting Foe
  1343: 'Foe-state-gated (vs. bleeding foes) — no foe-condition-state tracking exists.', // Deep Strikes
  1336: 'Proc/temporary-buff-on-cast value (bonus crit chance for a duration after a burst-skill hit, duration scales with adrenaline spent) — not a steady character-stat gain.', // Burst Precision
  1683: "Own-resource-gated (Guardian's Resolution, a stacking resource with no CombatState field) — same shape as Deadly Strength/Death's Carapace already logged in TODO.md.", // Righteous Instincts
  1914: 'Foe-state-gated (vs. foes within a range threshold) — no distance/range tracking exists.', // High Caliber
  1927: "Own-resource-gated (Alacrity gained per clone shattered) — Alacrity has no CombatState gate the way Fury/Regeneration/Quickness do.", // Flow of Time
  2031: "Foe-state-gated, scales per Vulnerability stack currently on the foe — no foe-condition-stack tracking exists.", // Decimate Defenses
  2177: 'Foe-state-gated (attacks against weakened foes) — no foe-condition-state tracking exists.', // Superior Elements
  2279: 'Mechanic-conversion trait (melee attacks become ranged) whose crit-chance bonus only applies to that converted attack type — not a general character-stat gain.' // Mech Arms: Jade Cannons
}

describe('critical-hit-chance trait completeness', () => {
  const candidates = traits.filter(touchesCritChance)

  it('found the expected number of candidate traits (guards against a stale scan)', () => {
    expect(candidates.length).toBe(26)
  })

  it('every candidate trait is either curated or excluded with a reason', () => {
    const unaccounted = candidates.filter((t) => !COVERED_TRAIT_IDS.has(t.id) && !(t.id in EXCLUDED_CRIT_CHANCE_TRAIT_IDS))
    expect(unaccounted.map((t) => `${t.id} ${t.name}`)).toEqual([])
  })

  it("every excluded trait id still exists in the data (no stale entries)", () => {
    const candidateIds = new Set(candidates.map((t) => t.id))
    const stale = Object.keys(EXCLUDED_CRIT_CHANCE_TRAIT_IDS).map(Number).filter((id) => !candidateIds.has(id))
    expect(stale).toEqual([])
  })
})
