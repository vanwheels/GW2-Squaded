/**
 * Engineer Turrets (Healing Turret, Rifle/Net/Thumper/Rocket/Flame/Harpoon Turret, Supply Crate):
 * each equippable turret id has 2 sub-abilities — an "Overcharge" (activate the turret's special
 * ability, named per-turret: "Automatic Fire," "Electrified Net," "Thump," "Explosive Rockets,"
 * "Smoke Screen," "Cleansing Burst," or, for Supply Crate, literally "Overcharge Supply Crate") and
 * a "Detonate" (destroy the turret(s) for a burst of damage) — reachable in-game from the same
 * skill icon once the turret is placed, same UX gw2skills.net's `FlipSkillStack` convention already
 * covers for genuine `flipSkill` chains (see `multi-effect.ts`).
 *
 * User-flagged 2026-08-16: Supply Crate's 2 flip skills ("Overcharge Supply Crate," "Detonate
 * Supply Crate Turrets") don't show up anywhere in the app. Investigating found this isn't a
 * Supply-Crate-specific gap — `Skill.flipSkill` (the field `flipTargetSkills`/`withFlipChain`
 * normally walk) is genuinely inconsistent across the whole Turret family: each turret's raw API
 * data links AT MOST one of its 2 sub-abilities via `flipSkill`, never both, and which one varies
 * per turret with no discoverable pattern:
 * - Healing Turret (5857): links Detonate (5961), missing Overcharge (Cleansing Burst, 5980).
 * - Rifle Turret (5818): links NEITHER — its sibling ground-targeted duplicate id (5989, dropped by
 *   `skill-variants.ts`'s picker resolution in favor of 5818) carries the only `flipSkill` link to
 *   Detonate (5957); the id actually equipped has `flipSkill: null`.
 * - Net Turret (5837): links Overcharge (Electrified Net, 5893), missing Detonate (5984).
 * - Thumper Turret (5838): links Detonate (5960), missing Overcharge (Thump, 5889).
 * - Rocket Turret (5912): links Overcharge (Explosive Rockets, 5913), missing Detonate (6134).
 * - Flame Turret (5836): links Overcharge (Smoke Screen, 5900), missing Detonate (5985).
 * - Harpoon Turret (6093): links Detonate (6097), missing Overcharge (Automatic Fire, 6098).
 * - Supply Crate (6183): links NEITHER — same shape as Rifle Turret, confirmed the motivating bug.
 *
 * Every id below (both the turret key and its 2 sub-ability values) is each turret's already-
 * resolved *canonical* id — the one `skill-variants.ts`'s `visibleSkillsForSlot` actually offers in
 * the picker and a build actually equips, not any `GroundTargeted`/legacy duplicate — cross-checked
 * against `Skill.toolbeltSkill` (every turret + both its sub-abilities + its own Toolbelt/F-key
 * skill share one `toolbeltSkill` value; the 2 non-Toolbelt, empty-`categories` siblings sharing
 * that value are exactly this turret's Overcharge/Detonate pair — the same grouping
 * `stripNonEquippableSubAbilities` already uses to keep these out of the picker as *bindable*
 * choices, just read here for their content instead of to exclude them). Hand-verified 2026-08-16
 * against a full `/v2/skills` pull rather than assumed from the naming convention alone.
 *
 * Deliberately a full override rather than a `flipSkill`-chain patch: since the API's own link is
 * missing or inconsistent per-turret (see above), trusting it for one hop and this table for the
 * other would still under- or over-count depending on the turret. Consumed identically by both
 * `multi-effect.ts`'s `flipTargetSkills` (the visual stacked-icon chain) and `boon-calc/sources.ts`'s
 * `skillIdsForBuild` (the aggregate Boon/Condition total) — same "one table feeds both paths"
 * pattern `non-actionable-flip-targets.ts` already established, so a future turret addition/rework
 * only needs updating here to stay correct in both places.
 */
export const TURRET_SUB_ABILITY_IDS: ReadonlyMap<number, readonly number[]> = new Map([
  [5857, [5961, 5980]], // Healing Turret -> Detonate Healing Turret, Cleansing Burst
  [5818, [5874, 5957]], // Rifle Turret -> Automatic Fire, Detonate Rifle Turret
  [5837, [5893, 5984]], // Net Turret -> Electrified Net, Detonate Net Turret
  [5838, [5889, 5960]], // Thumper Turret -> Thump, Detonate Thumper Turret
  [5912, [5913, 6134]], // Rocket Turret -> Explosive Rockets, Detonate Rocket Turret
  [5836, [5900, 5985]], // Flame Turret -> Smoke Screen, Detonate Flame Turret
  [6093, [6098, 6097]], // Harpoon Turret -> Automatic Fire, Detonate Harpoon Turret
  [6183, [30230, 38750]] // Supply Crate -> Overcharge Supply Crate, Detonate Supply Crate Turrets
])
