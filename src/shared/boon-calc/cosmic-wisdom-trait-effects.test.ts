import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact, Legend, Skill, Trait, WvwFactOverride } from '../types'
import { boonConditionFactsForSkill, boonConditionFactsForTrait } from './sources'
import { damageLinesForSkill } from '../skill-calc/damage-calc'

/** Regression guard for the Numinous Gift/Mistfire "trait fact copied onto Cosmic Wisdom" fix
 *  (2026-08-20, flagged by the user: "Numinous Gift gives boons/additional effects to Cosmic
 *  Wisdom, as do the grandmaster majors Found Purpose and Mistfire") — same "lock in what's
 *  already known-correct against the real game data" purpose as `evoker-familiar-facts.test.ts`.
 *  Also locks in that Found Purpose (deliberately NOT copied the same way — see
 *  `sources.ts`'s own comment) doesn't leak any duplicate/extra rows onto Cosmic Wisdom. */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const rawSkills = readJson<Skill[]>('skills.json')
const syntheticFacts = readJson<Record<string, Fact[]>>('synthetic-facts.json')
const skills = rawSkills.map((s) => (syntheticFacts[s.id] ? { ...s, facts: [...s.facts, ...syntheticFacts[s.id]] } : s))
const legends = readJson<Legend[]>('legends.json')
const cosmicWisdom = skills.find((s) => s.id === 77371)!
const traits = readJson<Trait[]>('traits.json')
const numinousGiftTrait = traits.find((t) => t.id === 2440)!
const wvwOverrides = readJson<{ skill: Record<string, Record<string, WvwFactOverride>> }>('wvw-fact-overrides.json')
const cosmicWisdomWvwOverride = wvwOverrides.skill['77371']

const NUMINOUS_GIFT_ID = 2440
const FOUND_PURPOSE_ID = 2352
const MISTFIRE_ID = 2429

const durationPercent = { boon: 0, condition: 0 }
const allEquippedLegends = new Set(legends.map((l) => l.id))

describe('Cosmic Wisdom (77371) — Numinous Gift/Mistfire trait-copied facts', () => {
  it('has no boon rows at all when neither trait is active', () => {
    const facts = boonConditionFactsForSkill(cosmicWisdom, new Set(), allEquippedLegends, durationPercent, undefined, legends)
    expect(facts).toEqual([])
  })

  it('shows Numinous Gift\'s 5 per-legend boons (Dwarf grants 2: Stability + Resolution) + flat Might when 2440 is active', () => {
    const facts = boonConditionFactsForSkill(cosmicWisdom, new Set([NUMINOUS_GIFT_ID]), allEquippedLegends, durationPercent, undefined, legends)
    expect(facts).toHaveLength(7)
    const byLegend = new Map(facts.filter((f) => f.legendName).map((f) => [f.legendName, f.boonOrConditionName]))
    const dwarfBoons = facts.filter((f) => f.legendName === 'Legendary Dwarf Stance').map((f) => f.boonOrConditionName).sort()
    const fury = facts.find((f) => f.legendName === 'Legendary Assassin Stance')!
    expect(fury.boonOrConditionName).toBe('Fury')
    expect(fury.scaledDurationSeconds).toBe(10)
    expect(byLegend.get('Legendary Demon Stance')).toBe('Resistance')
    expect(dwarfBoons).toEqual(['Resolution', 'Stability'])
    expect(byLegend.get('Legendary Centaur Stance')).toBe('Protection')
    expect(byLegend.get('Legendary Entity Stance')).toBe('Quickness')
    const might = facts.find((f) => f.boonOrConditionName === 'Might')!
    expect(might.scaledDurationSeconds).toBe(10)
    expect(might.applyCount).toBe(5)
    expect(might.legendIcon).toBeUndefined()
  })

  it('shows Mistfire\'s Burning when 2429 is active, alongside its Damage numeric line', () => {
    const facts = boonConditionFactsForSkill(cosmicWisdom, new Set([MISTFIRE_ID]), allEquippedLegends, durationPercent, cosmicWisdomWvwOverride, legends)
    expect(facts).toHaveLength(1)
    expect(facts[0].boonOrConditionName).toBe('Burning')
    expect(facts[0].scaledDurationSeconds).toBe(4) // WvW value (pve 6s), see wvw-fact-overrides.json

    const damage = damageLinesForSkill(cosmicWisdom, 1000, 2597, new Set([MISTFIRE_ID]))
    expect(damage).toEqual([{ label: 'Damage', value: Math.round((690.5 * 0.6 * 1000) / 2597) }])
  })

  it('Mistfire\'s Damage line is absent when 2429 is not active', () => {
    const damage = damageLinesForSkill(cosmicWisdom, 1000, 2597, new Set())
    expect(damage).toEqual([])
  })

  it('Found Purpose (2352) alone adds nothing to Cosmic Wisdom\'s own facts (deliberately not copied)', () => {
    const facts = boonConditionFactsForSkill(cosmicWisdom, new Set([FOUND_PURPOSE_ID]), allEquippedLegends, durationPercent, undefined, legends)
    expect(facts).toEqual([])
  })

  it('Numinous Gift\'s per-legend boons are filtered to only the 2 equipped legends (2026-08-20 regression)', () => {
    const assassin = legends.find((l) => l.name === 'Legendary Assassin Stance')!
    const dwarf = legends.find((l) => l.name === 'Legendary Dwarf Stance')!
    const equipped = new Set([assassin.id, dwarf.id])
    const facts = boonConditionFactsForSkill(cosmicWisdom, new Set([NUMINOUS_GIFT_ID]), equipped, durationPercent, undefined, legends)
    // Fury (Assassin) + Stability & Resolution (Dwarf) + the flat, legend-less Might — NOT
    // Resistance/Protection/Quickness, whose legends (Demon/Centaur/Entity) aren't equipped in this build.
    expect(facts).toHaveLength(4)
    expect(facts.map((f) => f.boonOrConditionName).sort()).toEqual(['Fury', 'Might', 'Resolution', 'Stability'])
  })

  it('Numinous Gift\'s OWN trait facts are ALSO filtered to equipped legends (2026-08-20 regression, root cause of the leak)', () => {
    // Numinous Gift (2440) is a Grandmaster MINOR, so it's active unconditionally once its
    // specialization line is equipped — its raw trait.facts carry the identical 5 boon-per-legend
    // PrefixedBuffs the synthetic copy above duplicates onto Cosmic Wisdom. computeBoonConditionSources
    // walks equipped traits' own facts through a SEPARATE loop from the skill loop above, so this is
    // the actual source the user saw leaking all 5 legends into the build-wide Boon/Condition panel
    // even after the skill-side (Cosmic Wisdom) copy was gated.
    const assassin = legends.find((l) => l.name === 'Legendary Assassin Stance')!
    const dwarf = legends.find((l) => l.name === 'Legendary Dwarf Stance')!
    const equipped = new Set([assassin.id, dwarf.id])
    const facts = boonConditionFactsForTrait(numinousGiftTrait, new Set([NUMINOUS_GIFT_ID]), equipped, durationPercent, undefined, legends)
    // Dwarf Stance grants BOTH Stability and Resolution on the trait's own raw facts, matching the
    // synthetic copy onto Cosmic Wisdom (2026-08-20 fix) — not Resistance/Protection/Quickness,
    // whose legends (Demon/Centaur/Entity) aren't equipped in this build.
    expect(facts.map((f) => f.boonOrConditionName).sort()).toEqual(['Fury', 'Might', 'Resolution', 'Stability'])
  })

  it('Numinous Gift + Found Purpose both active still shows only Numinous Gift\'s 7 rows (no duplicate Fury/Resistance/etc.)', () => {
    const facts = boonConditionFactsForSkill(
      cosmicWisdom,
      new Set([NUMINOUS_GIFT_ID, FOUND_PURPOSE_ID]),
      allEquippedLegends,
      durationPercent,
      undefined,
      legends
    )
    expect(facts).toHaveLength(7)
    const furyRows = facts.filter((f) => f.boonOrConditionName === 'Fury')
    expect(furyRows).toHaveLength(1)
  })
})
