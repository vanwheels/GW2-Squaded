import type { Skill } from '../types'

/**
 * Hand-verified `flipSkill` links missing from the live API — every other Revenant Facet
 * (Strength/Light/Chaos/Darkness) carries a real `flipSkill` pointer from its "place" cast to its
 * own "Consume" skill, but Facet of Elements (27014) comes back with `flipSkill: null`, flagged
 * 2026-08-19 by the user ("facet of elements doesn't display its flip"). The wiki confirms the same
 * mechanic exists here too — "this is a sequence skill that transforms into Elemental Blast when
 * activated a second time" — so this is a genuine API data gap, not a real design difference.
 *
 * Elemental Blast exists as 2 ids sharing one name (27162 `GroundTargeted`/240 radius/12s recharge,
 * 51698 not-ground-targeted/360 radius/15s recharge) — the same "fast-cast keybind" duplicate shape
 * `skill-variants.ts`'s `resolveGroup` already resolves generically for the skill PICKER (its
 * `autoTarget`/`groundTarget` split, preferring the sole auto-target id when grouped by name).
 * 51698 is used here too, for consistency with whichever id the rest of the app already treats as
 * "the real skill" once both share a name-group.
 *
 * Consulted anywhere a `Skill.flipSkill` walk needs this app's actual belief about a skill's flip
 * target, not just the API's own possibly-incomplete field — `resolvedFlipSkillId` below is the one
 * helper every such site (`multi-effect.ts`'s `flipTargetSkills`, `boon-calc/sources.ts`'s
 * `withFlipChain`) should call instead of reading `.flipSkill` directly, so a future gap like this
 * one only needs an entry here rather than a matching patch at every consuming site.
 */
export const FLIP_SKILL_OVERRIDES: ReadonlyMap<number, number> = new Map([
  [27014, 51698] // Facet of Elements -> Elemental Blast
])

/** `skill.flipSkill`, falling back to `FLIP_SKILL_OVERRIDES` for the handful of ids the live API
 *  never links at all — see that map's own doc comment. */
export function resolvedFlipSkillId(skill: Skill): number | null {
  return skill.flipSkill ?? FLIP_SKILL_OVERRIDES.get(skill.id) ?? null
}
