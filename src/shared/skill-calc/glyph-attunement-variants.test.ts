import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Skill } from '../types';
import { visibleSkillsForSlot } from './skill-variants';

/**
 * Regression guard for a real live-picker bug found 2026-10-19 by the Damage Coefficient Sweep's
 * Leg 11: Glyph of Storms' Water/Air/Earth attunement variants (Ice Storm/Lightning Storm/
 * Sandstorm) each describe their effect under their own distinct flavor name rather than "Glyph of
 * Storms" itself, so they never land in the same name-group as their attunement-agnostic sibling
 * `5734` and ship through `resolveGroup`'s singleton-group early return unfiltered — see
 * `NON_EQUIPPABLE_SKILL_IDS`'s own doc comment in `skill-variants.ts` for the full writeup.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../../data/game-data');
const skills = JSON.parse(readFileSync(resolve(dataDir, 'skills.json'), 'utf-8')) as Skill[];

describe('Glyph of Storms attunement variants never show up as their own independently-pickable Utility skill', () => {
  const utilityCandidates = skills.filter(
    (s) => s.professions.includes('Elementalist') && s.slot === 'Utility',
  );

  it('candidate pool contains the raw attunement-variant ids (sanity check)', () => {
    const variantNames = utilityCandidates
      .filter((s) => [5735, 5737, 5738].includes(s.id))
      .map((s) => s.name);
    expect(variantNames.sort()).toEqual(['Ice Storm', 'Lightning Storm', 'Sandstorm']);
  });

  it('Ice Storm/Lightning Storm/Sandstorm are excluded from the visible picker list', () => {
    const visible = visibleSkillsForSlot(utilityCandidates, new Set());
    const visibleIds = new Set(visible.map((s) => s.id));
    expect(visibleIds.has(5735)).toBe(false);
    expect(visibleIds.has(5737)).toBe(false);
    expect(visibleIds.has(5738)).toBe(false);
  });

  it('Glyph of Storms itself is still visible', () => {
    const visible = visibleSkillsForSlot(utilityCandidates, new Set());
    expect(visible.some((s) => s.id === 5734)).toBe(true);
  });

  it("Glyph of Elemental Power's Air/Fire attunement variants were already excluded before this leg (name-sharing signal, not a bug)", () => {
    const visible = visibleSkillsForSlot(utilityCandidates, new Set());
    const visibleIds = new Set(visible.map((s) => s.id));
    expect(visibleIds.has(34637)).toBe(false);
    expect(visibleIds.has(34736)).toBe(false);
    expect(visibleIds.has(5506)).toBe(true);
  });
});
