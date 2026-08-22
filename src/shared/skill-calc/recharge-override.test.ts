import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { RechargeWvwOverrides, Skill, Trait } from '../types'
import { withRechargeOverride } from './recharge-override'
import { skillFactLines } from './skill-fact-lines'
import { numericFactLines } from './fact-numbers'

/**
 * Regression guard for TODO.md's "Recharge/cooldown WvW-override sweep": `scripts/fetch-recharge-
 * wvw-overrides.ts` generalized `RelicEffect.rechargeSeconds`'s "prefer the wiki's `recharge wvw=`
 * field over the base `recharge=` one" rule to skills/traits, closing the concrete example that
 * motivated the whole sweep — Warrior's Full Counter (id 44165) was showing its 8s PvE-reference-
 * build cooldown for every WvW build, when the wiki (and this app's own data file, once curated)
 * says 12s.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}
const skills = readJson<Skill[]>('skills.json')
const traits = readJson<Trait[]>('traits.json')
const rechargeWvwOverrides = readJson<RechargeWvwOverrides>('recharge-wvw-overrides.json')

const FULL_COUNTER_ID = 44165 // Warrior Spellbreaker burst skill — 8s PvE, 12s WvW (TODO.md's own example)

describe('withRechargeOverride', () => {
  it('substitutes the Recharge fact value when an override exists for this id', () => {
    const skill = skills.find((s) => s.id === FULL_COUNTER_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const overridden = withRechargeOverride(skill.facts, skill.id, rechargeWvwOverrides.skill)
    const recharge = overridden.find((f) => f.type === 'Recharge')
    expect(recharge?.value).toBe(12)
    // Every other fact is passed through untouched (same array entries, not just equal values).
    const otherFacts = skill.facts.filter((f) => f.type !== 'Recharge')
    for (const fact of otherFacts) expect(overridden).toContain(fact)
  })

  it('is a harmless no-op (same array reference) when no override exists for this id', () => {
    const facts = [{ type: 'Recharge', value: 5 }]
    expect(withRechargeOverride(facts, 999999, {})).toBe(facts)
  })

  it('never touches a non-Recharge fact even if one happens to carry a matching id key elsewhere', () => {
    const facts = [
      { type: 'Recharge', value: 8 },
      { type: 'Number', text: 'Targets', value: 5 }
    ]
    const overridden = withRechargeOverride(facts, 1, { 1: 12 })
    expect(overridden[0].value).toBe(12)
    expect(overridden[1]).toEqual({ type: 'Number', text: 'Targets', value: 5 })
  })
})

describe('skillFactLines — Full Counter (44165)', () => {
  const skill = skills.find((s) => s.id === FULL_COUNTER_ID)!

  it('shows the WvW-correct 12s recharge when the override map is passed', () => {
    const lines = skillFactLines(skill, new Set(), 1000, 1000, 2597, rechargeWvwOverrides)
    expect(lines.some((l) => l.text === 'Recharge: 12s')).toBe(true)
    expect(lines.some((l) => l.text === 'Recharge: 8s')).toBe(false)
  })

  it('falls back to the raw PvE value when no override map is passed (back-compat, every pre-existing caller)', () => {
    const lines = skillFactLines(skill, new Set(), 1000, 1000, 2597)
    expect(lines.some((l) => l.text === 'Recharge: 8s')).toBe(true)
  })
})

describe('numericFactLines — a curated trait override', () => {
  it('shows the WvW-correct recharge for a trait recharge-wvw-overrides.json covers', () => {
    const traitId = Number(Object.keys(rechargeWvwOverrides.trait)[0])
    const trait = traits.find((t) => t.id === traitId)
    expect(trait).toBeDefined()
    if (!trait) return
    const overrideSeconds = rechargeWvwOverrides.trait[traitId]
    const facts = withRechargeOverride(trait.facts, traitId, rechargeWvwOverrides.trait)
    const lines = numericFactLines(facts, trait.traitedFacts, new Set())
    expect(lines.some((l) => l.text === `Recharge: ${overrideSeconds}s`)).toBe(true)
  })
})
