/**
 * Hand-verified `flipSkill` targets among Revenant Legend heal/utility/elite skills that carry NO
 * genuinely new boon/condition/healing/damage content over their own source skill — confirmed by
 * comparing each pair's raw + `synthetic-facts.json`-merged facts directly (2026-08-13, flagged by
 * the user looking at a live skill bar: "duplicate rows ... when not all of the skills have flips or
 * secondary actions").
 *
 * `flipTargetSkills` (`multi-effect.ts`, drives `SkillsEditor`'s `FlipSkillStack`) and `withFlipChain`
 * (`boon-calc/sources.ts`, drives the per-build boon/condition total) both walk a skill's `flipSkill`
 * chain assuming every hop is a genuine on/release action pair (Facet of Chaos -> Chaotic Release,
 * different name, different facts — the common case). Revenant Legend skills specifically break that
 * assumption in 3 different ways, none of which are a real secondary action the player can trigger:
 *
 * 1. **Legendary Demon Stance's heal + first 2 utilities** each `flipSkill` to a byte-for-byte (or
 *    near-identical, differing only in a `Recharge` fact) copy of themselves under a different id —
 *    28219 Empowering Misery -> 78681, 27322 Pain Absorption -> 78505, 27505 Banish Enchantment ->
 *    78587. No wiki mechanic names a second cast for any of these; this looks like the API's PvP-mode
 *    split convention leaking into `flipSkill` rather than a real chain (contrast Legend4's other 2
 *    skills, Call to Anguish -> Unyielding Impact and Embrace the Darkness -> Resist the Darkness,
 *    which DO have distinct names and distinct facts and are correctly left un-excluded here).
 * 2. **Legendary Centaur Stance's 3 skills with a documented "orphan" sibling**
 *    (`docs/game-data.md`/TODO.md's Renegade-tooltip-gaps sweep, 2026-08-12) — 27025 Natural Harmony
 *    -> 29082, 27356 Energy Expulsion -> 29114, 27715 Purifying Essence -> 29197. That sweep already
 *    established these orphans are stale (29082's own Healing value, 1620, conflicts with the
 *    wiki-verified 1124 now curated onto live id 27025's own `synthetic-facts.json` entry; 29114's
 *    "Healing Fragment" mechanic is confirmed retired by the 2022-06-28 patch notes, superseded by
 *    27356's own current mechanic; 29197's Healing-per-Condition-Removed content is now duplicated
 *    onto live id 27715's own `synthetic-facts.json` entry) — showing them as a flip icon would
 *    re-surface already-superseded/wrong numbers, not just redundant ones.
 * 3. **Legendary Entity Stance's Beguiling Haze** (both its ground-targeted and non-ground-targeted
 *    copies) flips to a Recharge-1 twin with otherwise identical facts — 76805 -> 76917, 77141 ->
 *    77159. The wiki documents a real "Resonance" conditional bonus for this skill (extra damage/boon
 *    -strip if Legendary Assassin Stance is also equipped), but per TODO.md that's explicitly
 *    uncurated — nothing distinguishes the flip target from the source *yet*, so there's nothing to
 *    show. Revisit once Resonance gets curated.
 *
 * Deliberately NOT included: Legendary Renegade Stance's Kalla's-Fervor-enhanced ("Band Together")
 * ids (72359/72363/72366) — those DO carry genuinely different curated facts (extra
 * Resistance/Protection/Torment/Chilled the base id lacks) from a dedicated curation sweep
 * (COMPLETED.md, "Legendary Renegade Stance skills are missing on-cast effects", 2026-08-12) and are
 * a real "this is what the enhanced cast grants" secondary display, same shape as a genuine on/release
 * pair. One sibling in that same family, 45686 Breakrazor's Bastion -> 72389, never got that sweep and
 * currently has zero distinguishing facts either — included below as a still-open curation gap rather
 * than a permanent exclusion; remove it once Breakrazor's Bastion's own Band Together bonus is curated
 * (see TODO.md).
 */
export const NON_ACTIONABLE_REVENANT_FLIP_TARGET_IDS: ReadonlySet<number> = new Set([
  78681, // Empowering Misery (Demon heal) — identical duplicate of 28219
  78505, // Pain Absorption (Demon utility) — near-identical duplicate of 27322
  78587, // Banish Enchantment (Demon utility) — near-identical duplicate of 27505
  29082, // Natural Harmony (Centaur utility) — stale orphan, superseded by 27025's own curated facts
  29114, // Energy Expulsion (Centaur elite) — stale/pre-rework orphan, superseded by 27356's own curated facts
  29197, // Purifying Essence (Centaur utility) — orphan, now redundant with 27715's own curated facts
  76917, // Beguiling Haze (Entity utility) — Recharge-only variant of 76805, Resonance still uncurated
  77159, // Beguiling Haze, ground-targeted (Entity utility) — Recharge-only variant of 77141
  72389 // Breakrazor's Bastion (Renegade heal) — Band Together sibling never got the curation sweep
])
