# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Small display gaps

- [ ] Wellspring (Ranger/Wilderness Survival, trait 978) grants "Healing Power based on Power" via a
      `BuffConversion` fact (7% Power → Healing) — already correctly wired into the actual attribute
      calculation (`trait-attributes.ts`'s `CURATED_CONVERSIONS`, so `StatsPanel`'s Healing Power
      number is already right), but the trait's own tooltip has no fact-line rendering for
      `BuffConversion` at all, so nothing on the trait's own card shows this contribution. User-flagged
      2026-08-22 as a later-sweep item, not urgent — same shape as other conversion facts might also be
      missing tooltip lines for; worth a quick scan of how many other `CURATED_CONVERSIONS` entries
      have the same silent-but-correct gap before fixing just this one.

## Scoped features, not yet built

- [ ] Capacitor port for iOS/Android — scoped 2026-08-01, two-part seam: (1)
      `StorageAdapter`/`Repository<T>` (`src/shared/storage/storage-interface.ts`) is already
      backend-agnostic — needs a new implementation (e.g. `@capacitor-community/sqlite`) replacing
      `sqlite-storage.ts`; (2) the renderer never calls that interface directly — it goes through the
      Electron-only preload bridge (`window.gw2Storage`, wired in `src/preload/index.ts` +
      `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent — needs a platform-neutral
      seam or a Capacitor-side shim. Also: native HTML5 drag-and-drop in the squad editor has no
      touch-input fallback yet.

## Coefficient curation — remaining exceptions

`CURATED_HEALING_COEFFICIENTS` and `CURATED_DAMAGE_COEFFICIENTS` are complete sweeps across all 9
professions and all 4 skill slots; `CURATED_SIPHON_DAMAGE_COEFFICIENTS` is a complete sweep of its
14-candidate scope (see COMPLETED.md for the full sweep history). What's left below is specific
skills/traits that were investigated and deliberately left uncurated — don't re-guess a coefficient
for these without a fresh look at the source conflict.

**Healing — Utility (2):**
- Guardian 31295 (Sanctuary, underwater variant): a frozen pre-2016-balance-pass copy of id 9128 —
  no wiki coefficient documented for it specifically (underwater is out of scope for WvW anyway).
- Guardian 62669 (Repose): the wiki page itself is tagged stub — coefficient is an unfilled `?`. Note
  for whoever fills this in: a 2025-11-18 balance patch dropped the WvW/PvP base value from 2595 to
  1635 (PvE unaffected) — don't reuse the older 2595 figure from before that patch if it surfaces.

**Healing — Heal-slot (4):** Engineer 63049 (Rectifier Signet's trait-upgraded pulse heal — no wiki
fact template at all); Necromancer 10547 (Summon Blood Fiend — pet's own fixed-0 Healing Power, no
coefficient param on wiki, expected non-scaling); Necromancer 10670 (2nd Well of Blood id — API
values don't match either PvE/WvW reading of the shared wiki page, likely an undocumented
Scourge-context variant); Revenant 26937 (Enchanted Daggers — wiki 1640 vs. API 1560, same +80
offset also shows up on its Siphon Damage facts).

**Healing — Weapon-slot (4):** Elementalist 72982 (Etching: Jökulhlaup, Spear — no `coefficient=`
param on wiki); Necromancer 30860 (Death Spiral — wiki stub, missing siphon coefficients);
Necromancer 69302 (Life Siphon — wiki 450/300 vs. API 537/238, unexplained); Thief 72991 (Shadow
Veil, Spear — two facts share identical factText with only one wiki-documented coefficient; the
table matches by factText alone so curating risks binding to the wrong fact).

**Healing — Thief's Assassin's Reward trait (id 1238):** 17 of 45 candidate skills stayed uncurated
— 14 for the `Array.find`-binds-to-array-order duplicate-fact trap (a genuine PvE/WvW/PvP
initiative-cost split materialized as 2-3 identical-factText facts this table can't disambiguate,
same shape as Shadow Veil), Black Powder (only its PvE/PvP-grouped value is exposed, no sourced
number for its separate WvW cost), and Measured Shot/Repeater(13111) (each bakes an older, pre-patch
initiative cost into its Healing fact — there's no way to know which N the coefficient would use
without live-testing). See `healing-calc.ts`'s Weapon-slot Thief block for the full per-skill
breakdown. Still worth checking other professions for the same "heal on X while this trait is
active" shape someday.

**Damage** — condition-damage skills (coefficient against Condition Damage rather than Power) were
never in scope for the sweep; would need their own wiki-verification pass
(condition-per-stack-per-second base values are a separate documented constant table) before
extending `CURATED_DAMAGE_COEFFICIENTS` to cover one.

**Siphon Damage (10 of 14 candidates):** curated 2026-08-20 (`CURATED_SIPHON_DAMAGE_COEFFICIENTS`,
`siphon-damage-calc.ts`). Left uncurated: 3 wiki/API value mismatches (Locust Swarm, Signet of
Vampirism, Enchanted Daggers) that reconcile exactly under `wikiQuoted = apiRaw + coefficient *
1000` — suspiciously clean but unprecedented in this codebase and contradicted by 3 sibling skills
on the identical wiki template showing zero such offset, so not trustworthy without real in-game
verification (not available in this environment); 2 explicit wiki stub tags (Death Spiral,
Nightmare Weapon) plus Vampiric Slash's own stub stacked on the same mismatch shape; 1 different
formula shape (Soul Grasp, weapon-strength-based, mislabeled by the API the same way Barrier's API
mislabeling problem works); 3 structurally unreachable ids (Grim Specter orphan; Carnivore/
Replenishing Despair are shared-trait "effect skills", same exclusion shape as Assassin's Reward
above). The already-shipped Cosmic Wisdom Assassin-form entry (`baseValue: 1028`) may be an instance
of the same `wikiQuoted = apiRaw + coefficient * 1000` mismatch — flagged for future in-game
verification, not touched.

**Both Healing and Damage tables**: never visually spot-checked in the running app (Electron sandbox
limitation) — do that before extending either further.

- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for. Superseded by the
      fuller "Outgoing/Incoming Healing Effectiveness %" scoping below (2026-08-21) — don't patch
      this one skill in isolation, it's now part of that larger scoped item.

## Healing/Damage effectiveness % + data-completeness audit (scoped 2026-08-21, not started)

User-initiated research thread, not yet begun — explicitly paused before any curation/coding so the
research itself could be as thorough as possible first. All 5 items below come out of that session.

- [x] **Outgoing Healing % / Incoming Healing %** — DONE 2026-08-22, see COMPLETED.md. Shipped as 2
      new `DerivedStats` fields + a new `StatsPanel` row pair, wired through `combat-state.ts`'s
      `resolveOutgoingHealingPercent`/`resolveIncomingHealingPercent`. Regeneration-specific
      modifiers (e.g. Relic of Dwayna) stacking additively-then-multiplicatively with general
      outgoing-healing modifiers was noted during scoping but no Regen-boosting source has been
      curated yet, so that interaction has no code to exercise it — revisit if one ever is.

- [x] **Outgoing Damage % full pass** — DONE 2026-08-22 (see COMPLETED.md). Sigils + Relics legs
      shipped first; Traits leg then went profession-by-profession (all 9 done) same day.
  - [x] **Sigils** — DONE. `CURATED_SIGIL_DAMAGE_BONUSES`/`CURATED_SIGIL_CONDITION_DAMAGE_BONUSES`
    in `combat-state.ts`. Superior Sigil of Force (flat +5%, single-application-only per its "does
    not stack on both weapons" wiki clause, handled outside the normal doubling table). The 18
    "Slaying" sigils + Superior Sigil of Impact all turned out to carry a genuinely unconditional
    +3% Strike Damage baseline line alongside their conditional +7% (wiki-verified against Undead
    Slaying's raw infobox 2026-08-22 — this reverses the original 2026-08-21 scoping note that
    assumed full exclusion) — only that baseline is curated, the conditional halves excluded as
    too situational (target monster-type/CC-state this app doesn't track). Superior Sigil of the
    Night (3% always-on + 7% additional at night) got its own `CombatState.nightActive` toggle,
    gated in `CombatStatePanel` on the sigil actually being equipped. Superior Sigil of Bursting
    (+5% Condition Damage, flat since a 2018 rework) feeds `outgoingConditionDamagePercent`.
  - [x] **Relics** — DONE. All 14 "Damage Increase"-tagged relics now curated in
    `CURATED_RELIC_DAMAGE_BONUSES` (13 new + Fireworks), gated on the existing `CombatState.
    relicActive` "assume the proc/trigger condition is satisfied" toggle — every trigger turned out
    to be player-controlled (evade/trap-hit/shadowstep/stance-use/self-boon-grant/recharge-skill-
    hit/cantrip/disable/heal-skill/combo-blast) or a target-health-threshold (Eagle, same
    simplification already used for Relic of Castora's healing side), so no new design decision was
    needed — just per-relic wiki verification. Relic of Nourys's 6-stat combo line split: its
    strike-damage (+15% WvW/PvP) and condition-damage (+15% WvW/PvP) halves are curated (the latter
    into a new `CURATED_RELIC_CONDITION_DAMAGE_BONUSES` table); its incoming-damage-reduction/
    damage-to-healing-conversion halves are out of scope (no `DerivedStats` field exists for them
    yet).
  - [x] **Traits** — DONE, all 9 professions curated (see COMPLETED.md Sessions
    279/280/281/282/283/284/285/286/287 — Guardian/Warrior/Elementalist/Engineer/Mesmer/Necromancer/
    Ranger/Revenant/Thief). ~180 raw fact-label matches (`Percent` facts with
    text "Damage Increase"/"Strike Damage Increase"/"Condition Damage Increase"/"Damage Increase
    per Stack"/"...per Boon") across all 9 professions before dedup — comparable in size to the
    biggest coefficient sweeps already completed (Healing/Damage); per-profession legs, per the
    `pacing_large_sweeps` memory. Note: this scan needs `specializations.json` to map each trait's
    `specializationId` to a profession — `traits.json` itself has no profession field. Gap-shapes
    surfaced along the way, each logged rather than built (not worth new infra for one or two
    traits — a candidate list to revisit if a future sweep needs the same shape):
    - **Per-condition-type damage-%%** — Guardian's Amplified Wrath (id 1686) boosts burning
      damage specifically, not condition damage broadly; this app only has the one blanket
      `outgoingConditionDamagePercent` field, so it can't be curated without overstating non-
      burning builds. Thief leg adds 4 more members: Potent Poison (id 1291, poison), Deadly
      Ambush (id 1706, bleeding), and Strength of Shadows (id 2264, torment) — poison/bleeding/
      torment join burning as condition types this app has no per-type field for.
    - **Lethal Tempo stacking-buff modeling** — Guardian/Willbender's Tyrant's Momentum (id 2201)
      modifies a self-stacking buff (Lethal Tempo, up to 5 stacks, duration-reduction clause) that
      has no `CombatState` field at all, unlike Kalla's Fervor/Death's Carapace which each got a
      dedicated stepper. Thief/Antiquary's Combat High (id 2348) joins this family: a self-
      stacking buff (max 10 stacks, 3%/2% strike/condition damage per stack, decaying every 2s)
      granted on using Skritt Swipe — same "self-stacking buff, no dedicated `CombatState` field"
      shape as Lethal Tempo.
    - **Target-status-stack-count damage-%%** — Warrior's Destruction of the Empowered (id 1489,
      target's boon count) and, from the Engineer leg, Shaped Charge (id 429, target's vulnerability
      stacks) and Modified Ammunition (id 516, target's unique-condition count) all scale with a
      status *on the target*, not self; `CombatState.activeBoonCount` only tracks the player's own
      boons, no tracked-target-status-count field exists at all. Thief/Deadly Arts' Exposed
      Weakness (id 1257, target's unique-condition count) joins this family too.
    - **Per-skill-category damage-%%** — Warrior's Burst Mastery (id 1657) and Engineer/Amalgam's
      Symbiotic Synergy (id 2406, morph skills only) only boost one skill category's damage, not
      general outgoing strike damage; no field exists to scope a bonus to one skill category.
      Thief/Deadeye's One in the Chamber (id 2136, stolen skills only) joins this family.
    - **Weapon-type-scoped damage-%%** — new gap-shape from the Thief leg: Critical Strikes' Deadly
      Aim (id 1299) boosts strike damage only on Pistol/Speargun attacks specifically, not all
      damage — distinct from the per-skill-category family above (this gates on *equipped weapon*,
      not *skill category*) and from the movement-speed sweep's own `MELEE_WEAPON_MOVEMENT_SPEED_
      TRAIT_BONUSES` (that family is fine to apply build-wide since movement speed is inherently a
      "whichever weapon is drawn" stat; a damage-%% bonus scoped to one weapon's own skills would
      overstate damage from the *other* equipped weapon's skills, so it isn't a clean fit for the
      single blanket `outgoingDamagePercent` field either) — already partially handled as a
      per-skill trait-gated fact in `damage-calc.ts`'s own Pistol/Speargun skill entries, so this
      gap is specific to the build-wide aggregate stat, not a display gap.
    - **Boon-subset-gated per-boon compounding** — Engineer/Scrapper's Object in Motion (id 1860)
      is gated on having at least one of Stability/Swiftness/Superspeed, then scales by *total*
      boon count once that gate is met — distinct from the unconditional `PER_BOON_DAMAGE_TRAIT_
      BONUSES` shape (no gate at all); would need a boon-subset presence check ANDed with the
      existing `activeBoonCount` scaling, a new resolver shape not just a new table entry.
    - **Target-relative-health damage-%%** — Engineer/Explosives' Big Boomer (id 1947) triggers "to
      foes with a lower health percentage than you," a target-*relative* comparison rather than a
      fixed target-health threshold (unlike Relic of the Eagle's "assume satisfied" `relicActive`
      reuse) — no trait-side equivalent toggle exists yet.
    - **Untracked profession-resource-stack scaling** — Engineer/Holosmith's Laser's Edge (id 2122)
      scales continuously with the Holosmith's own Heat meter (0-100), and from the Necromancer leg,
      Harbinger's Septic Corruption (id 2185, condition-damage half) and Wicked Corruption (id 2188,
      strike-damage half) both scale with the player's own stacks of Blight — none of these resources
      has a `CombatState` field at all, unlike Kalla's Fervor/Death's Carapace's dedicated steppers.
    - **Pet/summon output not modeled** — Mesmer's Empowered Illusions (id 682) boosts the
      *illusions'* own damage, not the player's; same "not the player's own" reasoning as the Outgoing
      Healing % sweep's Spirit's Strength exclusion, now a 2nd member of this gap-shape family.
    - **Target-range-gated damage-%%** — Mesmer's Mental Focus (id 2208) triggers "against foes
      within the range threshold" — a target-*distance* gate, distinct from every other target-
      condition gate seen so far (all status-based, not distance-based); no `CombatState` field
      tracks target range at all. Necromancer/Reaper's Soul Eater (id 1969, wiki page since retitled
      "Soul Devourer") joins this family — wiki-confirmed a 300-unit distance-to-target gate. Ranger/
      Marksmanship's Farsighted (id 1000, wiki page since retitled "Steady Focus") joins too — its
      "further increased for foes above the range threshold" half.
    - **Attacker-position-gated damage-%%** — new gap-shape from the Ranger leg: Skirmishing's
      Hunter's Tactics (id 1068) triggers "while attacking from behind or the side, or when striking
      a defiant foe" — a flanking/positional check on the *attacker's* position relative to the
      target, distinct from every target-condition/-range/-relative-health gate above (none of those
      depend on where the player is standing); no `CombatState` field tracks this at all.
    - **Critical-damage-multiplier %%** — Mesmer's Superiority Complex (id 692) and Danger Time (id
      2009) both boost "Critical Damage Increase," a straight crit-hit-damage multiplier — distinct
      from the `CritDamage`/Ferocity attribute (already modeled via `AttributeAdjust`) and from
      general outgoing strike/condition damage; this app has no `DerivedStats` field for a standalone
      crit-damage-multiplier stat at all. Thief/Critical Strikes' Twin Fangs (id 1268) and Ferocious
      Strikes (id 1282) both join this family too (the latter also health-threshold-gated, but on
      crit damage rather than general strike damage, so the whole trait stays excluded here rather
      than splitting into `HIGH_HEALTH_DAMAGE_TRAIT_BONUSES`).
    - **Fixed target-health-threshold damage-%%** — new pairing from the Revenant leg: Devastation's
      Unsuspecting Strikes (id 1767, vs. foes above a fixed health threshold) and Swift Termination
      (id 1800, vs. foes below one) both gate on the *target's* own fixed health threshold, distinct
      from the self-health-gated `HIGH_HEALTH_DAMAGE_TRAIT_BONUSES` family (Rising Tide/Unscathed
      Contender/Flow like Water/Survival Instincts) and from Necromancer's Close to Death (same family
      as Close to Death, just the below-threshold entry gaining a sibling). Thief/Deadly Arts'
      Executioner (id 1269, vs. foes below a fixed threshold) joins this family too.
    - **Off-hand-vs-two-handed-weapon detection** — Revenant/Devastation's Destructive Impulses (id
      1724) grants an additional bonus "if you have an off-hand weapon equipped," which is knowable in
      principle from `build.equipment` but not cleanly: `attribute-totals.ts`'s `isActiveWeaponSlot`
      doc comment confirms a two-handed weapon's `weaponType` is mirrored onto BOTH its main- and
      off-hand slot keys (`weaponA1`+`weaponA2`), so a populated `weaponA2` doesn't by itself mean a
      genuine off-hand weapon is equipped — no helper distinguishes the two today. Only this trait's
      unconditional baseline half is curated; this conditional half is logged here rather than built
      for one candidate.
    - **Binary-plus-per-skill-count upkeep scaling** — Revenant/Herald's Forceful Persistence (id
      1803) grants a flat 15%/4% (WvW/PvP) two-part bonus: 15% while *any* upkeep skill is active (a
      binary gate) plus +4% per active Herald/weapon upkeep skill specifically (a skill-*count*
      stack) — neither half matches `CombatState.upkeepPoints`'s existing semantics (a summed
      point-*cost* total built for Rising Momentum's flat-per-point model), and the stacking half is
      arguably the trait's main value for real Herald builds, so it wasn't worth modeling only the
      lesser baseline half. No `CombatState` field tracks "count of active upkeep skills" at all.

- [x] **Data-completeness audit script** — DONE 2026-08-22, see COMPLETED.md. Built
      `scripts/audit-data-completeness.ts` (`npm run audit-data-completeness`), a local-only
      (no wiki fetch) structural scan of skills.json/traits.json/relic-effects.json/
      tome-chapters.json for the 3 gap-shapes described in the 2026-08-21 research session. Its
      first run's output is the new backlog below — re-run after a future balance patch or
      `fetch-game-data` refresh to regenerate it.

## Data-completeness audit backlog (found 2026-08-22 via `npm run audit-data-completeness`, none verified/curated yet)

Raw output of the script above, first run. Every hit below still needs an individual wiki-
verification pass before anything gets wired into the app (same "curated exception list" model as
the Healing/Damage coefficient tables) — this is a candidate list, not a fix list. A real chunk are
expected to turn out to be legitimate non-gaps once looked at.

**Shape 1 — opaque/generic fact labels on skills/traits (21 hits):** all but 1 are a `Percent` fact
literally labeled "Effectiveness Increased" with no other field naming what it affects. Skill: Stone
Resonance (44926, not yet read). Traits, triaged 2026-08-22 (see COMPLETED.md's Session 276): 2 were
about healing and are now curated (Aquamancer's Training 1676, Serene Rejuvenation 1814 — both in
`combat-state.ts`'s `FLAT_OUTGOING_HEALING_TRAIT_BONUSES`/`SERENE_REJUVENATION_*`); the other 12 each
modify a *different* stat (read via each trait's own `description` field, no wiki fetch needed) and
remain uncurated in whatever their own system is: Signet effectiveness (Perfect Inscriptions 579,
Mech Core: J-Drive 2298), Warhorn skill duration (Banshee's Wail 799), life-force gain (Soul
Comprehension 839, Gluttony 887), Protection damage-reduction (Hardy Conduit 1948), a specific
skill's own coefficient (Soothing Power 2028 — Soothing Mist, same shape as `Absolute Resolve`'s
exclusion in Session 276), Swiftness effectiveness (Elemental Pursuit 2165, Bird of Prey 2363),
Barrier/shadow-force (Amplified Siphoning 2288), attribute gain (Bolstered Bonds 2331, Double Helix
2334), and summoned-creature healing (Spirit's Strength 2421 — a pet-heal boost, not the player's
own, also excluded in Session 276).

**Shape 1 — opaque/generic labels on relic/tome-chapter facts (42 hits):** overwhelmingly relic
`"label": "effect"` facts (the wiki template's own generic first-parameter convention for relics —
confirmed structurally universal, not a per-relic authoring gap) plus 2 `"Effectiveness Increased"`
relics (100115, 102245) matching the skill/trait shape above. Full id list: relics 100031, 100063,
100115 (x2), 100194, 100219, 100345, 100368, 100435, 100453, 100527, 100694, 100752, 100775, 100849,
100916, 100924, 100947, 101191, 101943, 102245, 102595, 103424, 103574, 103872, 103984 (x2), 104424,
104501, 104800 (x2), 104849, 104928, 106355, 106916, 107030, 107061, 109351, 109664; tome chapters
"Epilogue: Eternal Oasis", "Epilogue: Unbroken Lines", "Epilogue: Ashes of the Just". Most of these
already have their real content in `params.desc`/`values` (see Shape 2 below) — the generic label
alone isn't itself the actionable signal here, just the marker that led to Shape 2's check.

**Shape 2 — numeric content hidden in `params.desc`/`alt`, not surfaced anywhere in `label`/`values`
(14 hits, all relic/tome-chapter):** concrete percent/flat values. **Correction after checking
`relic-effects-format.ts`'s `formatFactLine`:** this is NOT a tooltip-display gap — a `label ===
'effect'` fact already resolves to `params.desc` at display time (`const detail = fact.params.desc
?? label`), so every relic/tome-chapter hit below already shows its real text in-app. The actual
open gap is the one already scoped above ("Outgoing Damage % full pass" / "Outgoing Healing %"):
none of these values are wired into any calculator (aggregate stats, damage %, healing %) — this
list is just useful raw material for whoever curates those, not a newly-discovered display bug.
Relic of the Monk and Relic of Castora were curated into Outgoing Healing % in Session 276
(COMPLETED.md); tome chapter "Epilogue: Eternal Oasis" was evaluated and deliberately excluded from
that same sweep — its "+20% Heal Effectiveness" is a transient buff applied to allies on cast, not a
steady-state build stat, same "not a character stat gain" reasoning already applied to Mist Form/
Signet of the Locust in the movement-speed sweep.
Relic of the Monk (100031, "+1% Healing Increase to Others" — the original healing-effectiveness
research seed);
Relic of the Herald (100219, "25 Concentration"); Relic of the Scourge (100368, "+1½% Condition
Duration"); **Relic of the Firebrand (100453, "+20% Boon Duration")**; Relic of the Aristocracy
(100849, "+3% Condition Duration"); Nourys's Hunger (101191, a 6-stat combo line: "+15% Damage, +15%
Condition Damage, -10% Incoming Damage, -10% Incoming Condition Damage, +10% Healing from Outgoing
Boon and Condition Damage, +10% from Outgoing Attack Damage"); relic 103984 (2 lines: Frost Aura
"-10% Incoming Damage", Light Aura "-10% Incoming Condition Damage"); Relic of Thorns (104424, "50
Condition Damage"); Soul of the Titan (104928, "+15% All Stats"); relic 106355 ("+10% Critical
Chance"); relic 107030 ("+100% Incoming Fumble Unrestricted Percent" — likely a parse artifact of
the wiki's own text, needs a raw-wikitext look); **tome chapter "Epilogue: Eternal Oasis" ("+20%
Heal Effectiveness")** — directly relevant to the Outgoing/Incoming Healing % item above; "Epilogue:
Unbroken Lines" ("200 Toughness").

**Shape 3 — Buff/PrefixedBuff fact with a named status but no duration anywhere in its own facts
array (87 hits: 61 skills, 26 traits, after excluding non-player-equippable NPC/monster skill ids —
see the script's own `professions.length > 0` filter):** dominated by one recognizable pattern — a
condition (Immobile/Crippled/Chilled/Blinded/Burning/Bleeding/Poisoned/Torment/Confusion) applied via
"Apply Buff/Condition" with genuinely no `duration` field in the raw API data at all (spot-checked
live: Lightning Reflexes/12494's "Immobile" fact sits right next to a "Vigor" fact that DOES carry
`duration: 10` — confirming this isn't a script bug, the API data itself omits it for that one fact).
Full id/name list not reproduced here — regenerate via `npm run audit-data-completeness` (deterministic
against the current data files, same list every run until the next `fetch-game-data`). Worth grouping
by "which condition, which skill archetype" before wiki-verifying individually — several ids are
already visibly the same root cause repeated: "Wings of Resolve" (4 ids — 30083/30225/30286/30783,
all Guardian/Willbender Profession_2, same duplicate-copy shape the skill-picker duplicate-id audit
already deals with elsewhere) and "A.E.D." (2 ids — 21659/30881, both Engineer Heal) each show their
missing-duration Immobile/condition-cluster fact on every copy, so a wiki fix for the shared root
skill likely resolves all copies at once rather than needing N independent lookups.

- [x] **Recharge/cooldown WvW-override sweep** — DONE 2026-08-22, see COMPLETED.md. Built
      `scripts/fetch-recharge-wvw-overrides.ts` (`npm run fetch-recharge-wvw-overrides`),
      generalizing `RelicEffect.rechargeSeconds`'s "prefer `recharge wvw=`" rule to skills/traits;
      wired into both display (skill/trait tooltips) and calculation (Relic of the
      Zephyrite/Citadel's elite-skill-recharge-derived durations). 149 skills + 4 traits curated;
      211 ambiguous skill names and 86 validation-mismatch/missing-page names left uncurated (see
      `docs/game-data.md`'s new section for the full breakdown) — re-run after a future balance
      patch, same as `fetch-wvw-splits`.

- [ ] **Resource-cost modeling (energy/initiative/upkeep/health-cost) — down the road, deliberately
      not scoped yet.** The app doesn't track Revenant energy cost, Thief initiative cost,
      Revenant upkeep-skill drain, or health-cost skills anywhere today, so none of these are wrong
      per se — they're just entirely absent. User wants these modeled eventually. If/when that
      work starts, remember the wiki infobox template also carries PvE/PvP/WvW-specific variants for
      all 4 (same shape as `recharge wvw=` above) — confirmed real usage via wiki `insource:` search
      2026-08-21: `energy_wvw` (37 hits, Revenant), `upkeep_wvw` (7, Revenant), `initiative_wvw` (7,
      Thief), `health_cost_wvw` (6). (`activation_wvw`/cast-time has zero real wiki usage — confirmed
      not a real category, no need to check it again.) Build the WvW-override read at the same time
      as the base cost modeling, not bolted on after, so this doesn't become a 6th "solved for one
      data source, never generalized" gap.

## Nice-to-haves

- [ ] Gear Optimizer's rune/infusion search (2026-08-11, see COMPLETED.md) adds up to ~18 extra
      per-slot infusion search variables + 1 rune slot on top of the existing ~12-14 gear/food/
      utility slots — a synthetic stress case (2 floors, 3 maximize tiers, food/utility AND
      runes/infusions all on at once, 35 total slots) hit the search's `NODE_LIMIT` truncation
      (still returned a feasible, reasonable-looking result in ~1s — not a hang — and the UI already
      surfaces "truncated" transparently) where the same query without rune/infusion search stays
      well within budget. Not itself a bug, just a real trade-off worth watching: if truncated
      results turn out to look meaningfully suboptimal in practice, look at raising `NODE_LIMIT`,
      tightening the branch-order heuristics for infusion-shaped (single-attribute, low-spread)
      slots specifically, or collapsing same-key infusion slots that end up with identical option
      sets before they hit the solver.

- [ ] Discord bot latency — profession-scoped game-data fetch. A fresh browser's
      `load-game-data-web.ts` still re-fetches all 26 game-data JSON files (11MB total, ~9.3MB of
      which is just `skills.json`+`traits.json`) per render, for a preview that usually only needs
      one profession's (build preview) or a handful of professions' (squad preview) worth of data.
      Genuinely a bigger refactor — `buildGameData()`/`GameDataProvider` is shared with Electron's
      load-everything-once design, and a squad preview's profession set isn't known until the share
      itself is fetched and parsed. Session-reuse (COMPLETED.md) means a warm browser session's
      HTTP cache already avoids re-downloading on repeat renders — only the first render after a
      cold start pays the full 11MB — so this may matter less in practice than originally diagnosed.
      User confirmed 2026-08-19 that perceived speedup from the other latency fixes wasn't clearly
      noticeable either way, and is satisfied with "cleaner on the backend" for now — revisit only
      if latency becomes a live complaint again, ideally with an actual `wrangler tail` timing pass
      rather than another code-reading diagnosis.
