import type { Skill } from '../types'

export interface SkillVariantEffect {
  label: string
  skill: Skill
}

/**
 * Every "additional effect" a currently-equipped skill has beyond its own base facts — the
 * attunement-specific variants collapsed out of the picker (e.g. Elementalist "Glyph of Lesser
 * Elementals", one row per attunement) plus the activation-chain target(s) collapsed out too
 * (e.g. a Mantra's charged cast, a kit's stow skill, a turret's detonate skill) — see
 * `skill-variants.ts`'s doc comment for why these aren't independently equippable and don't appear
 * in the picker at all. Surfacing them here, on the already-equipped skill's own tooltip, is the
 * confirmed UX (2026-07-30): visible once picked, not offered as extra picker clutter.
 *
 * Deliberately does NOT include `specializationId`-reworked variants (e.g. Guardian's "Renewed
 * Focus" under Dragonhunter) — those aren't "additional effects" of the same skill, they're a full
 * replacement already resolved to the one correct id by `skill-variants.ts`'s auto-selection, so
 * there's nothing extra to show alongside it.
 */
export function relatedVariantSkills(skill: Skill, allSkills: Skill[], skillsById: Map<number, Skill>): SkillVariantEffect[] {
  const out: SkillVariantEffect[] = []

  const attunementVariants = allSkills
    .filter((s) => s.name === skill.name && s.attunement !== null)
    .sort((a, b) => (a.attunement ?? '').localeCompare(b.attunement ?? ''))
  for (const variant of attunementVariants) {
    out.push({ label: variant.attunement ?? variant.name, skill: variant })
  }

  let current = skill
  const seen = new Set<number>([skill.id])
  while (current.flipSkill !== null) {
    const next = skillsById.get(current.flipSkill)
    if (!next || seen.has(next.id)) break
    seen.add(next.id)
    out.push({ label: next.name, skill: next })
    current = next
  }

  return out
}
