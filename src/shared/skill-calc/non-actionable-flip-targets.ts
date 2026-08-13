import { NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS } from './revenant-flip-duplicates'
import { NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS } from './other-profession-flip-duplicates'

/**
 * A `flipSkill` target id known to carry no genuinely new content over its own source skill — see
 * `revenant-flip-duplicates.ts` and `other-profession-flip-duplicates.ts` for the per-id reasoning
 * (each is its own hand-verified family, kept in a separate file rather than merged into one giant
 * table). Shared by both `multi-effect.ts`'s `flipTargetSkills` (the visual `FlipSkillStack` chain)
 * and `boon-calc/sources.ts`'s `withFlipChain` (the aggregate boon/condition total's chain) so a
 * newly-verified exclusion only needs adding to one of the two source tables to take effect in both
 * places.
 */
export function isNonActionableFlipTarget(id: number): boolean {
  return NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS.has(id) || NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS.has(id)
}
