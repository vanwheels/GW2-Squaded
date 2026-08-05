import type { GlyphFormVariantMap, Skill } from '../types'

/**
 * The Druid Glyph form-variant skill whose facts should be shown in place of `skill`'s own, given
 * whether the build's Celestial Avatar toggle is currently on (`Build.activeBundleSkillId ===
 * CELESTIAL_AVATAR_SKILL_ID`, see `bundle-skills.ts` — same field `WeaponSkillBar` already reads
 * to swap the weapon-skill row). A "swap, not stack" treatment, same shape as
 * `vindicator-aspect.ts`'s aspect toggle: unlike `multi-effect.ts`'s `flipTargetSkills` stacking
 * (used for genuine on/release pairs that are both live at once), a Glyph's normal-form and
 * Celestial-Avatar-form effects are never simultaneously active, so only one should ever render.
 *
 * Returns `null` for any skill that isn't itself a `glyphFormVariants` group's canonical id (every
 * non-Glyph skill, and even a Glyph the fetch script couldn't resolve — same fail-open posture as
 * `glyphFormVariants` itself, see that type's doc comment) — callers should fall back to `skill`'s
 * own facts in that case, same as before this existed.
 */
export function glyphFormFactSourceSkill(
  skill: Skill,
  celestialAvatarActive: boolean,
  glyphFormVariants: GlyphFormVariantMap,
  skillsById: Map<number, Skill>
): Skill | null {
  const wantForm = celestialAvatarActive ? 'celestial' : 'normal'
  for (const [variantId, entry] of Object.entries(glyphFormVariants)) {
    if (entry.canonicalId === skill.id && entry.form === wantForm) {
      return skillsById.get(Number(variantId)) ?? null
    }
  }
  return null
}

/**
 * The icon to render for `skill`'s equipped-slot button, given the same Celestial Avatar toggle
 * `glyphFormFactSourceSkill` reads — a Glyph's normal and celestial forms carry genuinely different
 * icon assets (verified against local `skills.json`: e.g. Glyph of Alignment's celestial-form id
 * 31348 has a distinct `render.guildwars2.com` icon hash from the canonical/normal-form id), so the
 * slot button needs its own swap, separate from `skillTooltipContent`'s fact-only swap. Falls back to
 * `skill.icon` for every non-Glyph skill, same fail-open posture as `glyphFormFactSourceSkill`.
 */
export function glyphFormDisplayIcon(
  skill: Skill,
  celestialAvatarActive: boolean,
  glyphFormVariants: GlyphFormVariantMap,
  skillsById: Map<number, Skill>
): string {
  return glyphFormFactSourceSkill(skill, celestialAvatarActive, glyphFormVariants, skillsById)?.icon ?? skill.icon
}
