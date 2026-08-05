import type { Skill } from '../types'

/** Vindicator's specialization id — see `vindicatorAspectSkillId`'s doc comment. */
export const VINDICATOR_SPEC_ID = 69

/**
 * Legend7 (Legendary Alliance)'s 5 canonical "Aspect of the Archemorus" ids — `Legend.heal`/
 * `utilities`/`elite` in `legends.json` — each of which carries an outgoing `flipSkill` to its
 * "Aspect of Saint Viktor" counterpart (live-verified 2026-08-04 against `skills.json`):
 *   62719 Selfish Spirit    -> 62680 Selfless Spirit
 *   62832 Nomad's Advance   -> 62702 Battle Dance
 *   62962 Scavenger Burst   -> 62941 Tree Song
 *   62878 Reaver's Rage     -> 62796 Awakening
 *   62942 Spear of Archemorus -> 62687 Urn of Saint Viktor (which itself further flips to 62738
 *     "Drop Urn of Saint Viktor" — that second hop is the urn's own follow-up cast, not a third
 *     aspect, and stays correctly stacked in the tooltip via `relatedVariantSkills` once 62687 is
 *     the displayed skill).
 * Exported so `relatedVariantSkills` (`multi-effect.ts`) can recognize these 5 ids specifically and
 * skip stacking their aspect-flip hop in the tooltip — that swap is now represented by the
 * `Build.vindicatorAspectFlipped` toggle instead (same "swap, not stack" treatment as a Kit/Tome/
 * Celestial Avatar's weapon-bar toggle), unlike every other Legend's `flipSkill` pairs, which are
 * genuine on/release pairs still shown stacked.
 */
export const VINDICATOR_ASPECT_ARCHEMORUS_IDS: ReadonlySet<number> = new Set([62719, 62832, 62962, 62878, 62942])

/**
 * Resolves one of Legend7's heal/utility/elite `baseSkillId`s (always the "Aspect of the
 * Archemorus" id, per `legends.json`) to its "Aspect of Saint Viktor" counterpart when
 * `Build.vindicatorAspectFlipped` is set, via that id's own `flipSkill` — a plain 1-hop lookup,
 * not a chain walk, since the aspect swap is always exactly one hop from the canonical id (see
 * `VINDICATOR_ASPECT_ARCHEMORUS_IDS`'s doc comment for why the elite slot's further hop is a
 * different kind of link). Falls back to `baseSkillId` unchanged if unflipped, or if the flip
 * target is somehow missing from `skillsById` (stale/incomplete data — same fail-open convention
 * used throughout this codebase rather than showing nothing).
 */
export function vindicatorAspectSkillId(baseSkillId: number, flipped: boolean, skillsById: Map<number, Skill>): number {
  if (!flipped) return baseSkillId
  const base = skillsById.get(baseSkillId)
  return base?.flipSkill ?? baseSkillId
}
