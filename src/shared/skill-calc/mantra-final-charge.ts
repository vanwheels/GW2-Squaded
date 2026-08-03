/**
 * Firebrand mantras' third ("Final Charge") cast isn't linked via `flipSkill` the way the first two
 * charges are — a mantra's `flipSkill` only ever chains to its regular charge (e.g. Mantra of Solace
 * -> Restoring Reprieve); the API never links that regular charge (or the mantra itself) forward to
 * the enhanced Final Charge skill at all, leaving it structurally orphaned. Confirmed 2026-08-02 by
 * matching all 6 Firebrand mantras' regular-charge skill against the one other Firebrand
 * (specializationId 62) skill whose `description` starts with the literal "Final Charge." and shares
 * the same thematic effect — not an API field, hand-curated the same way `glyph-form-variants.json`
 * fills a gap no API field covers.
 *
 * Maps the REGULAR charge's own skill id -> its Final Charge sibling's id, so `relatedVariantSkills`
 * can append it as one more hop once the `flipSkill` chain (mantra -> regular charge) ends.
 */
export const MANTRA_FINAL_CHARGE_IDS: Record<number, number> = {
  42983: 41988, // Mantra of Potence — Potent Haste -> Overwhelming Celerity
  41475: 42960, // Mantra of Solace — Restoring Reprieve -> Rejuvenating Respite
  40114: 41328, // Mantra of Liberation — Portent of Freedom -> Unhindered Delivery
  42360: 44008, // Mantra of Truth — Echo of Truth -> Voice of Truth
  42864: 44248, // Mantra of Lore — Opening Passage -> Clarified Conclusion
  45082: 42924 // Mantra of Flame — Flame Rush -> Flame Surge
}
