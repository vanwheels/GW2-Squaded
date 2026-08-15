import type { Skill } from '../types'
import { MANTRA_FINAL_CHARGE_IDS } from './mantra-final-charge'
import { VINDICATOR_ASPECT_ARCHEMORUS_IDS } from './vindicator-aspect'
import { isNonActionableFlipTarget } from './non-actionable-flip-targets'
import { ADDITIVE_FLIP_PAIR_TARGET_IDS } from './additive-flip-pairs'

export interface SkillVariantEffect {
  label: string
  skill: Skill
}

/**
 * The attunement-specific variants collapsed out of the picker (e.g. Elementalist "Glyph of Lesser
 * Elementals", one row per attunement) — see `skill-variants.ts`'s doc comment for why these aren't
 * independently equippable and don't appear in the picker at all. Surfacing them here, on the
 * already-equipped skill's own tooltip, is the confirmed UX (2026-07-30): visible once picked, not
 * offered as extra picker clutter.
 *
 * Deliberately does NOT include `specializationId`-reworked variants (e.g. Guardian's "Renewed
 * Focus" under Dragonhunter) — those aren't "additional effects" of the same skill, they're a full
 * replacement already resolved to the one correct id by `skill-variants.ts`'s auto-selection, so
 * there's nothing extra to show alongside it.
 *
 * Flip/activation-chain targets (a skill's `flipSkill`, e.g. a Mantra's charged cast) used to be
 * folded in here too, nested as tooltip text below the base skill's own facts. Since the gw2skills.net
 * -style stacked-icon treatment landed (2026-08-04, see `flipTargetSkills` below and `SkillsEditor`'s
 * `FlipSkillStack`), those get their own icon + independent tooltip instead — attunement variants are
 * a genuinely different case (a *documentation* list of per-attunement effects that are never
 * simultaneously active, not a flip/release pair the player can trigger), so they stay here.
 */
export function relatedVariantSkills(skill: Skill, allSkills: Skill[]): SkillVariantEffect[] {
  return allSkills
    .filter((s) => s.name === skill.name && s.attunement !== null)
    .sort((a, b) => (a.attunement ?? '').localeCompare(b.attunement ?? ''))
    .map((variant) => ({ label: variant.attunement ?? variant.name, skill: variant }))
}

/**
 * The single one of `skill`'s attunement variants (see `relatedVariantSkills` above) matching the
 * build's current attunement (`Build.activeAttunement`) — e.g. Glyph of Lesser Elementals' actual
 * Fire-attunement facts while attuned to Fire. A "swap, not stack" treatment, the same shape
 * `glyph-forms.ts`'s `glyphFormFactSourceSkill` uses for Druid Glyph forms and for the identical
 * reason: only one attunement's effect is ever live at once, unlike `flipTargetSkills`' genuine
 * on/release pairs that render simultaneously.
 *
 * Returns `null` for any skill with no attunement variants (every non-Glyph skill) or when no
 * variant matches the given attunement — callers should fall back to `skill`'s own facts in that
 * case, same fail-open posture as `glyphFormFactSourceSkill`.
 */
export function activeAttunementVariantSkill(skill: Skill, activeAttunement: string, allSkills: Skill[]): Skill | null {
  return relatedVariantSkills(skill, allSkills).find((v) => v.skill.attunement === activeAttunement)?.skill ?? null
}

/**
 * The flip/activation-chain targets a skill leads to — its `flipSkill` hop(s) (e.g. Revenant's
 * Chaotic Release, Elementalist's Tailored Victory) plus, for a Firebrand mantra, the hand-curated
 * enhanced Final Charge appended after the chain (`MANTRA_FINAL_CHARGE_IDS` — the API never
 * structurally links that last hop). Rendered by `SkillsEditor`'s `FlipSkillStack` as its own small
 * stacked icon per target, directly above/below the base skill's normal slot, each with an
 * independent tooltip — gw2skills.net's convention, and always visible together (not a toggle).
 *
 * One deliberate exception: Legend7 (Legendary Alliance)'s 5 canonical "Aspect of the Archemorus"
 * ids (`VINDICATOR_ASPECT_ARCHEMORUS_IDS`) each flip to a wholly different-named "Aspect of Saint
 * Viktor" skill *simultaneously* across all 5 slots — a form toggle
 * (`Build.vindicatorAspectFlipped`, see `vindicator-aspect.ts`), not an on/release pair — so this
 * returns empty for them rather than double-signaling the same swap as both a stacked icon and the
 * toggle button. Any further hop past it (e.g. the elite's own "Drop Urn of Saint Viktor"
 * follow-up) still walks normally once the Saint Viktor id itself is the skill passed in here.
 *
 * Second exception: `isNonActionableFlipTarget` — several other skills' (mostly Revenant Legend,
 * plus a handful of Engineer/Guardian/Elementalist/Thief Heal/Utility/Elite skills)  `flipSkill`
 * points at a same-name (or near-identical) copy that carries no facts the source skill doesn't
 * already have, not a real secondary action (see `revenant-flip-duplicates.ts`/
 * `other-profession-flip-duplicates.ts` for the per-id reasoning). The walk stops there rather than
 * appending a duplicate-looking icon with the same name and tooltip as the skill directly above it.
 *
 * Third exception: `ADDITIVE_FLIP_PAIR_TARGET_IDS` (`additive-flip-pairs.ts`) — same-name pairs
 * where the target DOES carry genuinely new facts (unlike the exception above) but they're shown
 * merged into the base skill's own tooltip behind a "When Enhanced"-style divider
 * (`SkillsEditor.tsx`'s `additiveEnhancementFacts`) instead of as a 2nd stacked icon, so the walk
 * stops here too rather than double-showing the same content two ways.
 */
export function flipTargetSkills(skill: Skill, skillsById: Map<number, Skill>): SkillVariantEffect[] {
  const out: SkillVariantEffect[] = []

  if (VINDICATOR_ASPECT_ARCHEMORUS_IDS.has(skill.id)) {
    return out
  }

  let current = skill
  const seen = new Set<number>([skill.id])
  while (current.flipSkill !== null) {
    const next = skillsById.get(current.flipSkill)
    if (!next || seen.has(next.id)) break
    if (isNonActionableFlipTarget(next.id)) break
    if (ADDITIVE_FLIP_PAIR_TARGET_IDS.has(next.id)) break
    seen.add(next.id)
    out.push({ label: next.name, skill: next })
    current = next
  }

  const finalChargeId = MANTRA_FINAL_CHARGE_IDS[current.id]
  if (finalChargeId !== undefined && !seen.has(finalChargeId)) {
    const finalCharge = skillsById.get(finalChargeId)
    if (finalCharge) out.push({ label: finalCharge.name, skill: finalCharge })
  }

  return out
}
