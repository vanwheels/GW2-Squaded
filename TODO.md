# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Coefficient curation — remaining exceptions

`CURATED_HEALING_COEFFICIENTS` and `CURATED_DAMAGE_COEFFICIENTS` are complete sweeps across all 9
professions and all 4 skill slots; `CURATED_SIPHON_DAMAGE_COEFFICIENTS` is a complete sweep of its
14-candidate scope (see COMPLETED.md for the full sweep history). What's left below is specific
skills/traits that were investigated and deliberately left uncurated — don't re-guess a coefficient
for these without a fresh look at the source conflict.

**Healing — Utility (1, re-checked 2026-08-22, no change):**
- Guardian 31295 (Sanctuary, underwater variant): a frozen pre-2016-balance-pass copy of id 9128 —
  no wiki coefficient documented for it specifically (underwater is out of scope for WvW anyway).
  Re-confirmed: id 31295 doesn't appear on any wiki skill page at all (`insource:"31295"` search
  only hits an unrelated item id collision).

Guardian 62669 (Repose) is RESOLVED 2026-08-23 — user-supplied 2 live in-game tooltip readings
(0 HP → 1,635 heal; 1,347 HP → 2,713 heal) solved base=1635/coefficient=0.8 directly; curated in
`healing-calc.ts`. The base exactly matches the already-known post-2025-11-18-patch WvW/PvP value.

**Healing — Heal-slot (2 of original 4 — re-investigated 2026-08-22):** Engineer 63049's Rectifier
Signet/Mech Core: J-Drive gap is now RESOLVED — no dedicated wiki fact template exists, but its
Notes-section prose reconciles exactly against the live API's own `overrides`-indexed traited
facts (a clean +20% signet-passive-potency bonus, same family as the Shape-1 audit's Perfect
Inscriptions), so it's now curated (`healing-calc.ts`, `requiresTrait: 2298`). Revenant 26937
(Enchanted Daggers' Initial Heal) is now RESOLVED too — see the in-game-verification checklist
memory; curated (`healing-calc.ts`, base=1560/coefficient=0.25). Left uncurated, re-confirmed with
no new resolution: Necromancer 10547 (Summon Blood Fiend — wiki's own Notes confirm 0 Healing
Power/non-scaling, but its 926 wiki base vs. 510 API base still don't reconcile; moot either way
since coefficient 0 means curating would be a no-op at best); Necromancer 10670 (2nd Well of Blood
id — now confirmed a frozen legacy duplicate carrying stale pre-2023-11-28-patch numbers, not a
genuine Scourge variant as originally guessed, but still nothing reliable to curate it to).

**Healing — Weapon-slot (2 remain open, of the original 3 re-checked 2026-08-22):** Elementalist 72982 (Etching:
Jökulhlaup) is now RESOLVED 2026-08-23 — 2 live in-game readings gave base=340/coefficient=0.1,
flatly contradicting the wiki+API-agreed cached base of 532 (a live balance change or an
undiscovered WvW-split gap, not resolved which — see the in-game-verification checklist memory and
`healing-calc.ts`'s own comment on this skill for the full writeup); curated with the live value per
this table's usual WvW-preference convention. Necromancer 30860 (Death Spiral) is now RESOLVED
2026-08-23 too — its wiki `{{stub||missing siphon coefficients}}` tag turned out fully solvable from
2 live in-game WvW readings alone (`healing-calc.ts`, First-Hit Life Siphon Healing base=1764/
coefficient=0.2, Additional-Hit Healing base=294/coefficient≈0.033); its sibling Life Siphon Damage
fact was resolved in the same pass (`siphon-damage-calc.ts`, base=1764/coefficient=0.005, see below).
Still open: Necromancer 69302 (Life Siphon — wiki documents coefficients, 0.082 PvE / 0.036 WvW+PvP,
paired with base values 450/300 that still don't match this app's API-sourced values 537/238 under
either mode ordering; 2 live WvW readings taken 2026-08-23 didn't resolve it either — Healing Power
was confirmed 0 in both, yet the displayed value still moved with Power, suggesting this may be
another Barrier-style API target mislabeling, genuinely Power-scaled rather than Healing-Power-scaled
— see the in-game-verification checklist memory); Thief 72991 (Shadow Veil, Spear — still only one of
the two identical-factText Healing facts has a documented coefficient, 1290 → 0.5; the other, 2570,
remains undocumented and its relationship to the first — PvE/WvW split of the same quantity, or a
genuinely different quantity like a multi-block total — still can't be determined from the wiki page,
which declares `split = pve, wvw pvp` but only gives one mode-agnostic skill fact template; table
matches by factText alone so curating the known half risks binding to the wrong fact).

**Healing — Thief's Assassin's Reward trait (id 1238):** RESOLVED 2026-08-28 — 15 of the 17
originally-uncurated candidate skills are now curated. The "duplicate-fact trap" (2-3
identical-factText `requires_trait:1238` Healing facts this table couldn't disambiguate by
`Array.find` alone) turned out disambiguatable in almost every case: each skill's own wiki infobox
`split=` line (`pve, wvw pvp` groups WvW with PvP; `pve, wvw, pvp` is a true 3-way split; `pve pvp,
wvw` makes WvW the odd one out) plus its `initiative`/`initiative pvp`/`initiative wvw` fields
identify which raw API fact value is the WvW-relevant one — same mechanism as
`RelicEffect.rechargeSeconds`'s `recharge wvw=` preference. A few bake an older, pre-balance-patch
initiative cost than the skill's current live `initiative` field; those are curated with the raw
stale value anyway (reproducing today's live tooltip), same convention as the already-curated
Spear/UW quirk group. Debilitating Arc's own Healing facts turned out to be the full
Debilitating-Arc→Helmet-Breaker combo total, not its own solo cost. Still uncurated: Helmet Breaker
(71802) — its own facts don't fit any combo/solo interpretation even checking every historical cost
patch on both chain skills — and Black Powder (13113) — still only exposes its PvE/PvP-grouped
value, no live-API-sourced fact pairs with the wiki's explicit WvW-only cost (7). See
`healing-calc.ts`'s Weapon-slot Thief block for the full per-skill breakdown. Still worth checking
other professions for the same "heal on X while this trait is active" shape someday.

**Damage** — condition-damage skills were never in scope for the sweep (a different fact shape
entirely, `Buff`/`PrefixedBuff` condition application, not `Damage`-type facts — `CURATED_DAMAGE_
COEFFICIENTS` doesn't apply). New multi-leg item started 2026-08-29, see "Condition-damage display"
below.

**Siphon Damage (9 of 14 candidates):** curated 2026-08-20 (`CURATED_SIPHON_DAMAGE_COEFFICIENTS`,
`siphon-damage-calc.ts`). Enchanted Daggers is now RESOLVED (2026-08-23, live in-game readings —
see the in-game-verification checklist memory): base=808/coefficient=0.05, confirming the API's WvW
value was correct all along and the wiki's 858 was the stale side of the mismatch. This also
suggests the already-shipped **Cosmic Wisdom Assassin-form entry** (`boon-calc/sources.ts`,
`baseValue: 1028`, taken from this skill's own wiki-quoted *PvE* number) is likely inflated by the
same pattern and should probably read 968 (the PvE API value) instead — not changed yet, flagged for
a follow-up pass since Cosmic Wisdom's own mode/formula wasn't directly tested. **Locust Swarm,
Signet of Vampirism (both facts), Death Spiral, and Nightmare Weapon are now ALL RESOLVED too**
(2026-08-23, live in-game WvW readings — see the in-game-verification checklist memory): every one
confirmed the API's raw base value was correct all along (Locust Swarm 37/0.08, Signet Passive
129/0.022, Signet Active 163/0.084, Death Spiral 1764/0.005, Nightmare Weapon 606/0.025) — the wiki's
117/151/247 numbers (and, for Death Spiral, the wiki's total absence of any coefficient) were simply
wrong/missing, same pattern as Enchanted Daggers. Nightmare Weapon's code comment also had a stale
profession attribution (said Harbinger, is actually Ritualist) fixed in the same pass. Left uncurated,
re-checked 2026-08-29 (see `siphon-damage-calc.ts`'s top comment for the full writeup): 1 explicit
wiki stub tag (Vampiric Slash, Thief, id 73063 — unrelated skill from Death Spiral despite similar
flavor text) — a fresh wikitext pull found base=1210(API)/coefficient=0.2(wiki), and 1210 + 0.2*1000 =
1410 is an EXACT match to the wiki's quoted 1410, the same "wiki quotes the tooltip at base-1000-Power"
pattern that resolved all 6 other mismatches on this list — a strong candidate, but not curated on
pattern-matching alone; added to the in-game verification queue (see that memory) instead of guessed;
1 different formula shape (Soul Grasp, weapon-strength-based, mislabeled by the API the same way
Barrier's API mislabeling problem works — re-confirmed 2026-08-29, no change); 3 structurally
unreachable ids (Grim Specter orphan; Carnivore/Replenishing Despair are shared-trait "effect skills",
same exclusion shape as Assassin's Reward above).

**Both Healing and Damage tables**: never visually spot-checked in the running app (Electron sandbox
limitation) — do that before extending either further.

## Condition-damage display (started 2026-08-29)

Not a `CURATED_DAMAGE_COEFFICIENTS` extension — condition-applying skills carry `Buff`/`PrefixedBuff`
facts (`status`/`duration`/`apply_count`), not `Damage` facts, and this app has never displayed an
expected-damage number for any of them. New feature, built leg by leg per the `pacing_large_sweeps`
memory.

- [x] **Leg 1 — the 5 condition formulas.** DONE 2026-08-29. `src/shared/skill-calc/condition-damage-calc.ts`:
      `CONDITION_DAMAGE_FORMULAS` (Bleeding/Burning/Poisoned, no mode split; Torment split into
      `'Torment (Moving)'`/`'Torment (Stationary)'`, WvW+PvP) + `CONFUSION_DAMAGE_FORMULA` (its DoT and
      on-activation halves, structurally different from the other 4 — kept separate rather than forced
      into the same shape, see that file's own top comment). All 5 wiki-verified via raw wikitext
      (never paraphrased), covered by `condition-damage-calc.test.ts`. Fixed, skill-independent
      constants only — no per-skill wiki sweep needed for this leg, unlike every sibling coefficient
      table. Not yet wired into any skill's facts.
- [ ] **Leg 2 — wire into skill tooltips.** Not started. Needs design decisions this leg deliberately
      deferred: which profession(s) first; how to pick Torment's moving-vs-stationary half per skill
      (no per-skill signal exists — may need a `CombatState` toggle, or always assume one); whether/how
      to surface Confusion's on-activation half at all (not a steady-state rate, depends on the
      target's own behavior); how a multi-condition skill (e.g. applies both Bleeding and Torment)
      renders as more than one line, same shape as `damageLinesForSkill`'s multi-fact skills.

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

- [x] **Shape 1 — opaque/generic fact labels on skills/traits (21 hits)** — RESOLVED 2026-08-22, see
      COMPLETED.md's Session 289. All but 1 were a `Percent` fact literally labeled "Effectiveness
      Increased" with no other field naming what it affects; the 1 exception (Stone Resonance,
      44926) turned out to belong to the same "Protection effectiveness" family once read. Of the 21
      total: 2 were already about healing and curated in Session 276 (Aquamancer's Training,
      Serene Rejuvenation); 4 were newly built this session (**Swiftness effectiveness** — Elemental
      Pursuit 2165/Bird of Prey 2363, folded into `resolveMovementSpeedPercent`'s existing "highest
      wins" pool as the already-boosted 39.6% Swiftness value, gated on the pre-existing
      `swiftnessActive` toggle; **Bolstered Bonds' Cosmic Wisdom doubling**, trait 2331, a new
      `cosmicWisdomActive` `CombatState` field + `cosmicWisdomLegendAttributeTraitBonus` resolver);
      2 were already fully resolved with no action needed (Double Helix 2334 — display-only, its
      real mechanic isn't part of any modeled stat system; Soothing Power 2028/Spirit's Strength
      2421 — already excluded in Session 276). The remaining 6 traits + Stone Resonance are logged
      below as genuinely new, never-modeled stat families, none worth building dedicated infra for
      their 1-2 candidates:
  - **Signet passive-effect potency** — Perfect Inscriptions (Guardian/Radiance, 579) and Mech Core:
    J-Drive (Engineer/Mechanist, 2298), both flat 20% ("Signets gain improved passive effects and
    continue to grant their passive bonuses while recharging"). This app has no representation of a
    signet's own passive value anywhere — Utility-slot skill effects never feed into attribute
    totals at all (unlike gear/food/utility-consumable bonuses) — so there's nothing to apply a
    multiplier to without first building that entire baseline system.
  - **Per-weapon-category skill-duration bonus** — Banshee's Wail (Necromancer/Blood Magic, 799),
    flat 50% ("Warhorn skills gain increased effect duration"). No infra scopes a boon/buff-duration
    bonus to one weapon type's own skills — same "per-skill-category" gap-shape family as the
    Outgoing Damage % sweep's Burst Mastery/Symbiotic Synergy.
  - **Life-force gain rate** — Soul Comprehension (Necromancer/Death Magic, 839, 20%) and Gluttony
    (Necromancer/Soul Reaping, 887, 10%). Necromancer life-force is an entirely untracked resource —
    the mirror-image "resource gain" version of the now-shipped resource-*cost* modeling (energy/
    initiative/upkeep/health-cost, see COMPLETED.md), same reasoning applies: no baseline resource
    value exists to apply a %-modifier to.
  - **Protection's own damage-reduction potency** — Hardy Conduit (Elementalist/Tempest, 1948, 20%)
    and Stone Resonance (Elementalist skill, 44926, 20%, "Protection on you is more effective" while
    the stance is active). This app has never modeled incoming-damage reduction from boons at all
    (already noted as a gap from the movement-speed sweep's own Survival Instincts exclusion).
  - **Barrier/Shadow Force potency** — Amplified Siphoning (Thief/Specter, 2288): its barrier half
    ("Grant increased barrier when targeting an ally") is a %-modifier on barrier amounts, and
    `barrier-calc.ts` only has fixed per-skill coefficients, no modifier stat; its Shadow Force half
    is Specter's own untracked class resource, same "untracked profession-resource-stack" family as
    Holosmith's Heat/Harbinger's Blight (already logged in the Outgoing Damage % sweep's own
    gap-shape list above).

- [x] **Shape 1 — opaque/generic labels on relic/tome-chapter facts (42 hits)** — the 2
      "Effectiveness Increased" relics matching the skill/trait shape above resolved 2026-08-22
      alongside it, see COMPLETED.md's Session 289: Relic of Atrocity (102245, flat 15% life-steal,
      no proc/trigger condition on the wiki at all — unlike every other `CURATED_RELIC_*` bonus in
      this file, unconditional, no `relicActive` gate needed) is now curated into a new
      `resolveLifeStealPercent`/`CURATED_RELIC_LIFE_STEAL_BONUSES`. Relic of Mabon (100115) stays
      uncurated — its "might stacks become more effective" clause is a 10-stack-threshold +
      timed-window proc on Might, which this app already tracks as a plain 0-25 count rather than a
      duration-aware buff, so there's no clean way to model it without misrepresenting the mechanic.
      The other 40 hits are overwhelmingly relic `"label": "effect"` facts (the wiki template's own
      generic first-parameter convention for relics — confirmed structurally universal, not a
      per-relic authoring gap). Full id list: relics 100031, 100063,
100115 (x2), 100194, 100219, 100345, 100368, 100435, 100453, 100527, 100694, 100752, 100775, 100849,
100916, 100924, 100947, 101191, 101943, 102245, 102595, 103424, 103574, 103872, 103984 (x2), 104424,
104501, 104800 (x2), 104849, 104928, 106355, 106916, 107030, 107061, 109351, 109664; tome chapters
"Epilogue: Eternal Oasis", "Epilogue: Unbroken Lines", "Epilogue: Ashes of the Just". Most of these
already have their real content in `params.desc`/`values` (see Shape 2 below) — the generic label
alone isn't itself the actionable signal here, just the marker that led to Shape 2's check.

- [x] **Shape 2 — numeric content hidden in `params.desc`/`alt`, not surfaced anywhere in
      `label`/`values` (14 hits, all relic/tome-chapter):** concrete percent/flat values. Not a
      tooltip-display gap — a `label === 'effect'` fact already resolves to `params.desc` at
      display time, so every hit already showed its real text in-app; the real gap was that none
      of these values were wired into any calculator. Relic of the Monk/Castora were curated into
      Outgoing Healing % in Session 276; tome chapter "Epilogue: Eternal Oasis" ("+20% Heal
      Effectiveness") and "Epilogue: Unbroken Lines" ("200 Toughness") were both evaluated and
      deliberately excluded — a tome chapter's effect is a transient buff applied to allies on
      cast, not a steady-state build stat, same reasoning already applied to Mist Form/Signet of
      the Locust in the movement-speed sweep.
      **6 more RESOLVED 2026-08-28** (`combat-state.ts`, wiki-verified via raw wikitext — all are
      stacking or duration-limited procs gated on the existing `CombatState.relicActive` "assume
      satisfied" toggle, same simplification every other `CURATED_RELIC_*` table already uses; 4 of
      the 6 are modeled at their max stack count, same convention Relic of the Thief's own entry in
      `CURATED_RELIC_DAMAGE_BONUSES` already established):
      - Relic of the Herald (100219) — 25 Concentration/stack (max 10) -> `CURATED_RELIC_FLAT_
        ATTRIBUTE_BONUSES`, 250 BoonDuration points at cap.
      - Relic of Thorns (104424) — 50 Condition Damage/stack WvW/PvP (max 10) -> same table, 500
        ConditionDamage points at cap.
      - Relic of the Scourge (100368) — +1½% Condition Duration/stack (max 10) -> `CURATED_RELIC_
        DURATION_PERCENT_BONUSES`, +15% at cap.
      - Relic of the Aristocracy (100849) — +3% Condition Duration/stack (max 5) -> same table,
        +15% at cap.
      - Relic of the Firebrand (100453) — flat, non-stacking +20% Boon Duration -> same table.
      - Relic 106355 (Relic of the Scoundrel) — flat, non-stacking +10% Critical Chance ->
        `CURATED_RELIC_CRIT_CHANCE_BONUSES`.
      Left uncurated, now reclassified rather than mysteries: **Soul of the Titan** (Relic of the
      Living City, 104928) — wiki-confirmed genuinely ambiguous even in raw wikitext whether "+15%
      All Stats" is a flat-point or percentage-multiplier bonus (no precedent for a %-multiplier on
      total attributes anywhere in this app), and its 5-condition Titanic Potential combo (heal
      skill + elite skill + combo-field finish + disable + evade, each once) for only a 5s window is
      a much weaker "assume satisfied" candidate than every other relic in this file — logged, not
      guessed. **Relic 107030** (Relic of Fog) — raw wikitext confirmed NOT a parse artifact:
      "Incoming Fumble" is a real (if obscurely worded) reference to the wiki's "Glancing" mechanic
      (forces the next incoming hit to deal 50% damage/no crit); this app has no Incoming-Damage-
      Reduction stat anywhere, same already-logged gap as Nourys's Hunger's and relic 103984's own
      incoming-damage-reduction halves below — merged into that family, not a separate mystery.
      **Nourys's Hunger** (101191) and **relic 103984** (Frost/Light Aura's incoming-damage/
      damage-to-healing-conversion halves) stay out of scope — no `DerivedStats` field for Incoming
      Damage Reduction exists yet (see the Outgoing Damage % sweep's own "Protection's own
      damage-reduction potency" gap-shape below).

- [x] **Shape 3 — Buff/PrefixedBuff fact with a named status but no duration anywhere in its own
      facts array** — RESOLVED 2026-08-22, see COMPLETED.md. All 87 original hits turned out to be a
      false-positive family (2 legitimate wiki "Condition Removed"/"condition effect ignored"
      templates, not real gaps) — no curation needed, `audit-data-completeness.ts` now filters them
      out so a future re-run reports 0 hits for this shape.

- [x] **Recharge/cooldown WvW-override sweep** — DONE 2026-08-22, see COMPLETED.md. Built
      `scripts/fetch-recharge-wvw-overrides.ts` (`npm run fetch-recharge-wvw-overrides`),
      generalizing `RelicEffect.rechargeSeconds`'s "prefer `recharge wvw=`" rule to skills/traits;
      wired into both display (skill/trait tooltips) and calculation (Relic of the
      Zephyrite/Citadel's elite-skill-recharge-derived durations). 149 skills + 4 traits curated;
      211 ambiguous skill names and 86 validation-mismatch/missing-page names left uncurated (see
      `docs/game-data.md`'s new section for the full breakdown) — re-run after a future balance
      patch, same as `fetch-wvw-splits`.

## Nice-to-haves

- [ ] Gear Optimizer: food/utility's own "Gain X Equal to N% of Your Y" conversions (e.g. Superior
      Sharpening Stone's Power from Precision/Ferocity) aren't credited during the search itself when
      the source attribute is a searched gear stat — scoped out 2026-08-23 while fixing the same gap
      for TRAIT conversions (`gear-optimize.ts`'s `traitConversions` threading; see COMPLETED.md).
      Trait conversions are precomputable upfront (fixed by specializations alone), but a consumable
      conversion is a property of a SPECIFIC food/utility item — when `optimizeFoodUtility` is true,
      which item (if any) even carries a conversion isn't known until the search picks it, so it
      can't be folded in the same straightforward way. Narrower in practice than the trait gap (only
      1-2 WvW consumables carry this shape at all, see `activeConsumableConversions`'s doc comment) —
      the final `metricValues` are always correct either way, only the search's own internal slot
      comparisons could be marginally suboptimal. Pick up only if a real case surfaces.

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
