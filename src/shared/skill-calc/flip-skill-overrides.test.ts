import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { flipTargetSkills } from './multi-effect'
import { visibleSkillsForSlot } from './skill-variants'

/**
 * Regression guard for "facet of elements doesn't display its flip" (flagged 2026-08-19) — see
 * `FLIP_SKILL_OVERRIDES`'s own doc comment for the full root-cause writeup (the live API's
 * `flipSkill` field is `null` for Facet of Elements, unlike every other Revenant Facet).
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
const skills = JSON.parse(readFileSync(resolve(dataDir, 'skills.json'), 'utf-8')) as Skill[]
const skillsById = new Map(skills.map((s) => [s.id, s]))

describe('Facet of Elements -> Elemental Blast (missing live-API flipSkill link)', () => {
  it('flipTargetSkills shows Elemental Blast as the flip target', () => {
    const facetOfElements = skillsById.get(27014)
    expect(facetOfElements).toBeDefined()
    if (!facetOfElements) return
    const flips = flipTargetSkills(facetOfElements, skillsById)
    expect(flips.map((f) => f.skill.id)).toEqual([51698])
    expect(flips[0].label).toBe('Elemental Blast')
  })

  it('Elemental Blast never shows up as its own independently-pickable Utility skill', () => {
    // Facet of Elements itself must be in the candidate pool too — stripFlipTargets only drops a
    // flip target by walking each candidate's OWN resolved flip id, so it needs the source present
    // to find the link at all (same as a real Revenant Utility-slot picker call).
    const utilityCandidates = skills.filter(
      (s) => s.professions.includes('Revenant') && s.slot === 'Utility' && (s.name === 'Elemental Blast' || s.id === 27014)
    )
    const blastIds = utilityCandidates.filter((s) => s.name === 'Elemental Blast')
    expect(blastIds.length).toBeGreaterThan(0) // sanity: both 27162/51698 exist raw
    const visible = visibleSkillsForSlot(utilityCandidates, new Set())
    expect(visible.some((s) => s.name === 'Elemental Blast')).toBe(false)
  })
})
