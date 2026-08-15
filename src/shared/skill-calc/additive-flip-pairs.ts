/**
 * 6 of the 10 same-name `flipSkill` pairs the classification sweep confirmed as a genuine "additive
 * enhancement" (TODO.md's "Same-name 'enhanced' flip targets should merge into one tooltip with a
 * 'When Enhanced' divider" item; see `same_name_flip_pair_classification_2026-08-13` memory for the
 * full ~50-pair sweep this is the output of) — the flip target's own facts are a strict superset of
 * the source's, not a duplicate (`revenant-flip-duplicates.ts`/`other-profession-flip-duplicates.ts`)
 * and not a mutually-exclusive/replace-not-append case (Deathstrike, Shield of Absorption, etc., left
 * as ordinary 2-icon `flipTargetSkills` chains).
 *
 * Unlike every other curated table in this codebase, this one deliberately does NOT hand-transcribe
 * the enhancement's facts — `SkillsEditor.tsx`'s `additiveEnhancementFacts` computes the delta live
 * (target's own current-build-scaled facts minus whatever's already on the base skill's tooltip),
 * the same way every other skill tooltip line is computed, so it stays correct as gear/traits/duration
 * % change instead of going stale. This table only records WHICH pairs qualify and what to label the
 * divider — the "why" a trait/enhancement condition applies is `boonConditionFactsForSkill`/
 * `skillFactLines`'s own `requires_trait` gating, already correct on both source and target.
 *
 * `ADDITIVE_FLIP_PAIR_TARGET_IDS` (the reverse id set) is consumed by `multi-effect.ts`'s
 * `flipTargetSkills` to stop the visual stacked-icon walk at these targets — the merged divider
 * replaces the 2nd icon rather than sitting alongside it. It deliberately does NOT gate
 * `boon-calc/sources.ts`'s `withFlipChain` (the build-wide boon/condition TOTAL walk) — these targets
 * carry real new content that must keep counting toward totals, only their VISUAL representation
 * changes.
 *
 * **Elementalist Evoker's 4 attunement familiars deliberately NOT included here**, despite the
 * classification sweep calling them additive too. A "diff the target's live facts against the base's"
 * dry run (2026-08-15) plus live wiki checks (Fox's Fury, Hare's Agility raw wikitext) found the
 * automatic diff would be WRONG for this family specifically: the base/equippable id's own facts are
 * genuinely incomplete (the documented "flip-architecture gap" `damage-calc.ts`'s Evoker comment
 * already explains — the API attaches the skill's real, UNCONDITIONAL effect to the flip target id
 * instead of the base), so "everything on the target the base doesn't have" bundles the skill's own
 * always-on content (e.g. Fox's Fury's unconditional Burning/base Might, Hare's Agility's unconditional
 * Endurance/Swiftness/chain-lightning Damage — confirmed present in the wiki's core description, not
 * gated at all) together with the genuinely specialization-gated extras (Fox's Fury: breaks stun +
 * extra might + area damage; Hare's Agility: breaks stun + blur — confirmed gated by the wiki's own
 * "if X is your specialized element" sentence). Labeling that whole bundle "Fire/Air/... Specialized"
 * would misrepresent unconditional content as conditional — the exact mistake this whole feature
 * exists to avoid. **Resolved 2026-08-15 in `evoker-familiar-facts.ts` instead of this table** — a
 * per-skill hand-curated split (wiki-confirmed which of the target's facts are always-on vs.
 * specialization-gated) rather than a live diff, since only the always-on content matches an
 * automatic diff's assumptions here.
 */
export interface AdditiveFlipPair {
  targetId: number
  /** Divider heading shown above the enhancement-only facts, e.g. "When Enhanced". Deliberately
   *  short (the tooltip popup caps at 300px wide) and worded per-family rather than one blanket
   *  string, since the 3 families' triggers are genuinely different mechanics (a chained-cast
   *  "enhance the next skill" buff vs. a trait pick vs. an attunement/specialization state). */
  triggerLabel: string
}

export const ADDITIVE_FLIP_PAIRS: ReadonlyMap<number, AdditiveFlipPair> = new Map([
  // Revenant — Legendary Renegade Stance's "Band Together": using any of these 4 skills makes your
  // next Legendary Renegade skill activate instantly, enhanced with 1 extra Buff/Condition fact
  // (wiki-confirmed per-skill in COMPLETED.md's "Legendary Renegade Stance skills are missing
  // on-cast effects" curation, 2026-08-12/13). Skill's own description literally says "is enhanced."
  [40485, { targetId: 72359, triggerLabel: 'When Enhanced' }], // Icerazor's Ire (+ Chilled)
  [41220, { targetId: 72366, triggerLabel: 'When Enhanced' }], // Darkrazor's Daring (+ Resistance)
  [42949, { targetId: 72363, triggerLabel: 'When Enhanced' }], // Razorclaw's Rage (+ Torment)
  [45686, { targetId: 72389, triggerLabel: 'When Enhanced' }], // Breakrazor's Bastion (+ Barrier)

  // Guardian — Crashing Courage (Virtue of Courage's "5 consecutive attacks" proc): the flip target
  // is the same proc gated on the Indomitable Courage trait, adding an unconditional StunBreak +
  // brief Stability plus more Stability/Protection (ground-targeted pair: Resistance/Protection)
  // that only actually render once the gating trait is selected (`requires_trait`, already handled
  // by the normal fact-gating machinery) — wiki-confirmed 2026-08-14
  // (`other-profession-flip-duplicates.ts`'s Guardian-leg doc comment).
  [62555, { targetId: 62596, triggerLabel: 'With Indomitable Courage' }], // Crashing Courage
  [62648, { targetId: 62532, triggerLabel: 'With Indomitable Courage' }] // Crashing Courage (ground-targeted)
])

export const ADDITIVE_FLIP_PAIR_TARGET_IDS: ReadonlySet<number> = new Set(
  Array.from(ADDITIVE_FLIP_PAIRS.values(), (pair) => pair.targetId)
)
