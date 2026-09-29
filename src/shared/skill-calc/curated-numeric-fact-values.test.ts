import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { skillFactLines } from './skill-fact-lines'

/**
 * Regression guard for TODO.md's Sep 29, 2026 patch Leg 2: Seed of Life (31406/32242) and Lesser
 * Seed of Life (31776, granted by Cultivated Synergy) each carry only ONE raw "Conditions Removed"
 * fact with no pve/wvw duplicate to select between — a shape `NUMERIC_FACT_WVW_OVERRIDES`
 * (fact-numbers.ts) can't fix since it only filters between 2 existing raw facts. This test locks
 * in `CURATED_NUMERIC_FACT_VALUES`' direct-replacement fix instead.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
const skills = JSON.parse(readFileSync(resolve(dataDir, 'skills.json'), 'utf-8')) as Skill[]

describe('skillFactLines — CURATED_NUMERIC_FACT_VALUES', () => {
  it.each([31406, 32242, 31776])('shows the WvW-correct Conditions Removed value for skill %i', (id) => {
    const skill = skills.find((s) => s.id === id)
    expect(skill).toBeDefined()
    if (!skill) return
    const lines = skillFactLines(skill, new Set(), 1000, 1000, 2597)
    expect(lines.some((l) => l.text === 'Conditions Removed: 1')).toBe(true)
  })
})
