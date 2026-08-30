# Future stat-family candidates

Never-modeled stat-family shapes surfaced during the Outgoing Damage % sweep's Traits leg
(all 9 professions, ~180 raw fact-label matches before dedup — see COMPLETED.md Sessions
279-287). Each shape currently has only 1-4 known members, not worth building dedicated
infrastructure for on its own. Logged here as a candidate list to revisit if a future sweep needs
the same shape for more traits/skills — not scheduled work.

- **Per-condition-type damage-%** — Guardian's Amplified Wrath (id 1686, burning), Thief's Potent
  Poison (id 1291, poison), Deadly Ambush (id 1706, bleeding), Strength of Shadows (id 2264,
  torment). This app only has one blanket `outgoingConditionDamagePercent` field, so none of these
  can be curated without overstating non-matching-condition builds.
- **Self-stacking-buff modeling** — Guardian/Willbender's Tyrant's Momentum (id 2201, modifies
  Lethal Tempo, up to 5 stacks, duration-reduction clause) and Thief/Antiquary's Combat High (id
  2348, max 10 stacks, 3%/2% strike/condition damage per stack, decaying every 2s, granted by
  Skritt Swipe). Neither buff has a dedicated `CombatState` field, unlike Kalla's Fervor/Death's
  Carapace which each got a stepper.
- **Target-status-stack-count damage-%** — Warrior's Destruction of the Empowered (id 1489,
  target's boon count), Engineer's Shaped Charge (id 429, target's vulnerability stacks) and
  Modified Ammunition (id 516, target's unique-condition count), Thief/Deadly Arts' Exposed Weakness
  (id 1257, target's unique-condition count). `CombatState.activeBoonCount` only tracks the player's
  own boons; no tracked-target-status-count field exists at all.
- **Per-skill-category damage-%** — Warrior's Burst Mastery (id 1657), Engineer/Amalgam's Symbiotic
  Synergy (id 2406, morph skills only), Thief/Deadeye's One in the Chamber (id 2136, stolen skills
  only). No field exists to scope a bonus to one skill category.
- **Weapon-type-scoped damage-%** — Critical Strikes' Deadly Aim (id 1299, Pistol/Speargun attacks
  only). Distinct from the per-skill-category family (gates on *equipped weapon*, not *skill
  category*) and from the movement-speed sweep's `MELEE_WEAPON_MOVEMENT_SPEED_TRAIT_BONUSES` (that
  family is fine build-wide since movement speed is a "whichever weapon is drawn" stat; a
  damage-% bonus scoped to one weapon's own skills would overstate the *other* equipped weapon's
  skills). Already handled as a per-skill trait-gated fact in `damage-calc.ts`'s own Pistol/Speargun
  entries — this gap is specific to the build-wide aggregate stat.
- **Boon-subset-gated per-boon compounding** — Engineer/Scrapper's Object in Motion (id 1860),
  gated on having at least one of Stability/Swiftness/Superspeed, then scales by *total* boon count
  once that gate is met. Distinct from the unconditional `PER_BOON_DAMAGE_TRAIT_BONUSES` shape (no
  gate at all); would need a boon-subset presence check ANDed with the existing `activeBoonCount`
  scaling, a new resolver shape.
- **Target-relative-health damage-%** — Engineer/Explosives' Big Boomer (id 1947, "to foes with a
  lower health percentage than you") — a target-*relative* comparison, unlike Relic of the Eagle's
  fixed-threshold "assume satisfied" reuse. No trait-side equivalent toggle exists yet.
- **Untracked profession-resource-stack scaling** — Engineer/Holosmith's Laser's Edge (id 2122,
  Heat meter 0-100), Necromancer/Harbinger's Septic Corruption (id 2185, condition half) and Wicked
  Corruption (id 2188, strike half, both scale with Blight stacks). None of these resources has a
  `CombatState` field, unlike Kalla's Fervor/Death's Carapace's dedicated steppers.
- **Pet/summon output not modeled** — Mesmer's Empowered Illusions (id 682, boosts the illusions'
  own damage, not the player's). Same "not the player's own" reasoning as the Outgoing Healing %
  sweep's Spirit's Strength exclusion.
- **Target-range-gated damage-%** — Mesmer's Mental Focus (id 2208), Necromancer/Reaper's Soul
  Eater (id 1969, wiki page since retitled "Soul Devourer," confirmed 300-unit distance gate),
  Ranger/Marksmanship's Farsighted (id 1000, wiki page since retitled "Steady Focus," its "further
  increased for foes above the range threshold" half). No `CombatState` field tracks target range.
- **Attacker-position-gated damage-%** — Ranger/Skirmishing's Hunter's Tactics (id 1068, "while
  attacking from behind or the side, or when striking a defiant foe") — a flanking/positional check
  on the *attacker's* position, distinct from every target-condition/-range/-relative-health gate
  above. No `CombatState` field tracks this.
- **Critical-damage-multiplier %** — Mesmer's Superiority Complex (id 692) and Danger Time (id
  2009), Thief/Critical Strikes' Twin Fangs (id 1268) and Ferocious Strikes (id 1282, also
  health-threshold-gated, but on crit damage rather than general strike damage — stays excluded
  entirely rather than splitting into `HIGH_HEALTH_DAMAGE_TRAIT_BONUSES`). Distinct from the
  `CritDamage`/Ferocity attribute (already modeled via `AttributeAdjust`); this app has no
  `DerivedStats` field for a standalone crit-damage-multiplier stat.
- **Fixed target-health-threshold damage-%** — Revenant/Devastation's Unsuspecting Strikes (id
  1767, vs. foes above a fixed threshold) and Swift Termination (id 1800, vs. foes below one),
  Thief/Deadly Arts' Executioner (id 1269, vs. foes below a fixed threshold). Distinct from the
  self-health-gated `HIGH_HEALTH_DAMAGE_TRAIT_BONUSES` family (Rising Tide/Unscathed Contender/Flow
  like Water/Survival Instincts) and from Necromancer's Close to Death (same family, gaining a
  below-threshold sibling).
- **Off-hand-vs-two-handed-weapon detection** — Revenant/Devastation's Destructive Impulses (id
  1724, additional bonus "if you have an off-hand weapon equipped"). Knowable in principle from
  `build.equipment` but not cleanly: `attribute-totals.ts`'s `isActiveWeaponSlot` doc comment
  confirms a two-handed weapon's `weaponType` is mirrored onto BOTH main- and off-hand slot keys
  (`weaponA1`+`weaponA2`), so a populated `weaponA2` doesn't by itself mean a genuine off-hand
  weapon is equipped — no helper distinguishes the two today. Only this trait's unconditional
  baseline half is curated.
- **Binary-plus-per-skill-count upkeep scaling** — Revenant/Herald's Forceful Persistence (id 1803,
  flat 15%/4% WvW/PvP two-part bonus: 15% while *any* upkeep skill is active, plus +4% per active
  Herald/weapon upkeep skill specifically). Neither half matches `CombatState.upkeepPoints`'s
  existing semantics (a summed point-*cost* total built for Rising Momentum's flat-per-point model),
  and the stacking half is arguably the trait's main value for real Herald builds, so it wasn't
  worth modeling only the lesser baseline half. No `CombatState` field tracks "count of active
  upkeep skills."
