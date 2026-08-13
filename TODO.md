# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Path to 1.0 (target: ship this week for community testing/feedback)

User's explicit goal, stated 2026-08-12: cut a 1.0 release this week so the community can start using
it and giving feedback — the user isn't deeply familiar with every profession's own meta/quirks and is
relying on wider playtesting to catch what solo curation can't. 1.0 scope = README roadmap items 1-4
(scaffolding, build editor + boon/condition calculator, squad preview builder, sync/share backend) —
the Discord bot and the Capacitor mobile port are explicitly OUT of 1.0 scope (later roadmap stages,
own sub-projects). Already shipping releases (v0.1.0-v0.3.0 tagged, electron-builder + auto-update
live) — the app is feature-complete for this scope; the open question is correctness confidence, not
missing features.

Two real gaps stand between here and 1.0, both about confidence rather than features:
1. **Never visually verified in a running app** — every curation session (150+ entries in
   COMPLETED.md) was checked by typecheck/lint/code-reading only, never seen rendered (Electron
   sandbox limitation in the assistant's shell). Needs an actual click-through before release: create
   a build, run the gear optimizer, build a squad comp, generate a share link — for real.
2. ~~**Zero automated tests.**~~ **DONE 2026-08-13** — see "Automated testing strategy" below (all 3
   completeness scans + all 3 value-correctness tiers now complete, 108 tests total).

## Automated testing strategy (agreed 2026-08-12, DONE 2026-08-13)

Key insight from this session: the bugs the user has actually hit by hand (traits not feeding into
attribute totals, buffs whose bonus depends on a runtime value like Kalla's Fervor's stack count,
sigils not being picked up for Control/Strip metrics because of unique wording) are all **silent
omission** bugs — a source that was never wired in produces a stable, self-consistent WRONG number. A
value-correctness regression/snapshot test does NOT catch this class of bug, because there's nothing
to diff against — it would just lock the wrong value in as "correct" forever. Snapshot tests only
protect values already known-correct from *future drift*; still worth having (see Tier 1/2/3 below)
but NOT the priority.

**Priority: completeness/coverage tests — build these first. No gw2skills/in-game verification
needed, purely structural scans against data already in the repo:**

1. ~~**Trait attribute-bonus completeness scan.**~~ **DONE 2026-08-12** (`vitest` added as a new
   devDependency; `src/shared/gear-calc/trait-attribute-completeness.test.ts`, `npm run test`). Scanned
   all 187 traits in `traits.json` carrying an `AttributeAdjust`/`BuffConversion` fact (in either
   `facts` or `traitedFacts`) against the union of all 12 curated tables/lists across
   `trait-attributes.ts`/`combat-state.ts` (`CURATED_FLAT_BONUSES`, `CURATED_CONVERSIONS`,
   `WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES`, `ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`,
   `FURY_CRIT_CHANCE_TRAIT_BONUSES`, `FURY_ATTRIBUTE_TRAIT_BONUSES`,
   `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`, `REGENERATION_ATTRIBUTE_TRAIT_BONUSES`,
   `QUICKNESS_ATTRIBUTE_TRAIT_BONUSES`, `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES`,
   `REVEALED_ATTRIBUTE_TRAIT_BONUSES`, `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES`) — 90 already
   covered. Of the 98 uncovered candidates: 1 (Kinetic Accelerators, id 2052) was a genuine miss,
   wiki-verified and added to `CURATED_CONVERSIONS` (Power→Concentration 10% WvW, confirmed
   unconditional despite sitting alongside this trait's combo-finisher boon procs); 95 were
   reviewed and confirmed to be proc/skill-tooltip coefficients reusing the same fact shape
   (heal-on-X, barrier-on-X, life-siphon-on-hit, 3 pet-only stats, 1 temporary on-cast buff value,
   1 condition-tick-damage coefficient, 1 `requires_trait` cross-reference) — same "Healer's Gift"
   shape already documented in `trait-attributes.ts`'s file header; all logged with a stated reason
   in the test file's `EXCLUDED_TRAIT_IDS`. The remaining 2 are genuine stat gains with no infra yet
   — see "New gaps found by the completeness scan" below. The test also asserts the exclusion list
   itself stays clean (no entry for an already-curated trait, no stale entry for a trait a balance
   patch reworked).
2. ~~**Sigil/Control-Strip completeness scan.**~~ **DONE 2026-08-12** (`src/shared/boon-calc/
   sigil-named-fact-completeness.test.ts`). Sigils carry no `Fact[]` at all (only free-text
   `description`), so `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/`BOON_STRIP_CORRUPT_MATCHERS`
   could never see one — a total gap, not just occasional missed wording. Hand-scanned all 81
   sigils: 5 genuine grants (Strip: Nullification, Absorption; Cleanse: Purity, Cleansing,
   Generosity) added to a new `SIGIL_NAMED_FACT_SOURCES` table and wired into
   `computeNamedFactSources` via `computeSigilNamedFactSources` (gated by `isActiveWeaponSlot`, same
   as sigils' passive stat bonuses); 2 false positives (Paralyzation, Impact) documented and
   excluded. See COMPLETED.md Session 158.
3. ~~**State-dependent bonus tests (Kalla's Fervor-shaped).**~~ **DONE 2026-08-12**
   (`src/shared/gear-calc/combat-state.test.ts`, 38 tests). Every state-dependent family in
   `combat-state.ts` (mightStacks, stacking sigils, the 5 boolean-gated families, healthTier's 3-way
   tier, Kalla's Fervor's per-stack %/Lasting-Legacy override) tested at 0/mid/max points of its own
   dimension, plus end-to-end through `computeCharacterStats` for Kalla's Fervor/relic/Fury-crit-
   chance. See COMPLETED.md Session 159.

**Secondary priority: value-correctness tests (Tier 1/2/3):**
- ~~**Tier 1 — deterministic formula tests needing NO external oracle.**~~ **DONE 2026-08-12**
  (`src/shared/gear-calc/attribute-totals.test.ts`, 36 tests; `src/shared/gear-calc/
  derived-stats.test.ts`, 14 tests — 50 new, `npm run test` now 96 total). Hand-computed expected
  values against the wiki-quoted constants each source file already cites in its own comments —
  not re-verifying the constants themselves (that's each file's own cited-source comment), only
  that the arithmetic built on top of them is right. Covers: `statComboContribution`'s
  `adjustment * multiplier + value` formula at several adjustment tiers, the one-handed-mirrored-
  equals-two-handed identity, `addBonus`'s 4 bonus shapes (flat/percent/all-stats/sourceAttribute
  no-op), `applyConversions`' simultaneous-not-chained resolution, `resolveItemStatId`'s category
  self-heal, `isActiveWeaponSlot`'s land/underwater/swap-set gating, `computeGearAttributeTotals`
  end-to-end (weapon mirroring, stowed-set exclusion, rune stage-gating, sigil active-set gating,
  infusions, food/utility), and `computeCharacterStats`'s crit chance/damage, health, and armor
  formulas (including Fury's flat crit-chance add and per-piece Defense gating).
- ~~**Tier 2 — golden snapshot fixtures for coefficients already wiki-verified over 150+
  sessions.**~~ **DONE 2026-08-12** (`src/shared/skill-calc/coefficient-snapshots.test.ts`, 3 tests
  covering all of `CURATED_HEALING_COEFFICIENTS`/`CURATED_DAMAGE_COEFFICIENTS`/
  `CURATED_BARRIER_COEFFICIENTS`). Reads `skills.json`+`synthetic-facts.json` directly (mirrors
  `load-game-data.ts`'s merge, since that function is Electron-`app`-path-dependent and can't be
  imported into a plain vitest run) and snapshots `healingLinesForSkill`/`damageLinesForSkill`/
  `barrierLinesForSkill`'s real output for every curated id at one fixed reference build (Power
  2500/Healing Power 1500/`TARGET_ARMOR_VALUES.Medium`, every `requiresTrait` active at once so both
  a skill's untraited and trait-boosted lines land in one snapshot). Pays the verification cost once;
  a future snapshot diff now catches drift without re-checking the wiki.
  **Found 5 real bugs as a direct byproduct** (a stale `factText` silently failing to match its
  skill's real API fact is exactly the "silent omission" class this whole testing strategy exists to
  catch) — **4 fixed same session**, all one-word `factText` corrections with the curated
  `baseValue`/`coefficient` confirmed unchanged against the still-matching real fact: Necromancer's
  Deadly Feast (10619, Healing — was `'Life Siphon Healing'`, live API just says `'Healing'`),
  Ranger's Troll Unguent (12483, Healing — was `'Health per second'`, live API capitalizes `'Health
  per Second'`), Elementalist's Wind Slam (62747, Damage — was `'Damage'`, live API says `'Maximum
  Damage'`), Warrior's Tsunami Slash's Barbarian's Retaliation-traited variant (14480, Damage — was
  `'Damage per Strike'`, its `traitedFacts` entry is plain `'Damage'`). **1 left unfixed, needs fresh
  wiki verification, not a text fix** — see "Mesmer's Mirror Blade" below.
- ~~Tier 3~~ **DONE 2026-08-13** — 3 hand-verified WvW reference builds (Power Strip Renegade,
  Shattered Aegis Firebrand, Heal Druid), sourced directly from the user (gw2skills.net links +
  screenshots, decoded via the "[Spec] x-x-x" trait-pick shorthand — see memory
  `trait_notation_shorthand`), checked against gw2skills.net's Attributes panel (Renegade also
  cross-checked live in-game). `src/shared/gear-calc/tier3-reference-builds.test.ts`, 9 tests.
  **Found and fixed 2 real silent-omission bugs** while sourcing the Renegade build's oracle number
  (it didn't match until both were fixed):
  1. `HEALTH_THRESHOLD_CONSUMABLE_BONUSES` (new, `combat-state.ts`) — the WvW "Writ of X"/"Thesis on
     X" consumable family ("Gain N Power/Precision/Condition Damage When Health above 90%", 36
     items) parsed to `{attribute: null}` and silently contributed nothing; only traits had a
     health-threshold-gated bonus table before this.
  2. `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES` (new, `combat-state.ts`) + `CombatState.
     fullEnduranceActive` (new field, defaults `true`) — Renegade's Brutal Momentum (+33% critical
     chance at full Endurance, overriding its own +10%/+15% baseline) had no full-Endurance combat
     state dimension anywhere in the app.
  Both wired into `computeCharacterStats`/`CombatStatePanel.tsx`. See COMPLETED.md Session 162.
- Vitest is now installed (`npm run test`) — added 2026-08-12 to build the completeness scan above,
  `vitest.config.ts` at repo root, near-zero extra config as expected.

**Next action:** Tier 1, Tier 2, and Tier 3 are all done, and Mesmer's Mirror Blade (below) is fixed —
the "Automated testing strategy" section and everything it surfaced are now fully closed. See TODO.md's
other open sections (Renegade tooltip gaps, coefficient curation exceptions, etc.) for what's next.

Mesmer's Mirror Blade (id 10333) — **DONE 2026-08-13** (COMPLETED.md Session 164). The stale entry the
Tier 2 snapshot build flagged 2026-08-12 turned out to be a live ArenaNet API data bug (confirmed via a
fresh raw-wikitext pull, unchanged, plus a fresh independent `api.guildwars2.com` pull, byte-identical
to the cached one) — the curated coefficients were never wrong, they just lost their matching API fact
to key off. Fixed via a `synthetic-facts.json` entry, no coefficient changes.

## New gaps found by the trait attribute-bonus completeness scan (2026-08-12)

Both are genuine character-stat grants confirmed via wiki (not proc/skill-tooltip coefficients like
the scan's other 95 flagged traits) but need a conditional-gate shape this codebase doesn't have infra
for yet — logged here per the scan's own `EXCLUDED_TRAIT_IDS` entries rather than rushed into a
curated table. Both are the same general shape as the already-built "conditional trait-attribute
bonus families" ([[conditional_trait_bonus_families]]) — a new family, not a one-off fix.

- [ ] **Power Overwhelming (Elementalist, id 334) — might-stack-THRESHOLD-gated Power, doubled by
      attunement.** "While at or above the might threshold, gain increased power. Power bonuses are
      doubled while attuned to fire." Wiki-verified 2026-08-12: +150 Power once `mightStacks >= 8`
      (WvW/PvP threshold; PvE is 10), doubled to +300 while `activeAttunement === 'Fire'`. Distinct
      from `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`'s continuous per-stack scaling (this is a binary
      on/off at a threshold) AND distinct from `ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`'s flat
      attunement-gated bonus (this is a *multiplier* on an already-conditional bonus, same
      "doubling isn't its own fact" shape `WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES`'s Forceful
      Greatsword/Blood Reaction comments already flag) — needs its own combined-gate table, not a fit
      for any existing one.
- [ ] **Deadly Strength (Necromancer/Harbinger, id 855) — per-Carapace-stack Power/ConditionDamage.**
      "Carapace stacks grant power and condition damage." Wiki-verified 2026-08-12: +10 Power / +10
      ConditionDamage per stack, no game-mode split (`{{skill fact|attribute|Power|10}}` +
      `{{skill fact|attribute|Condition Damage|10}}`). "Carapace" is Harbinger's own stacking
      resource (built from applying Blight, distinct from Might) — no `CombatState` field tracks it
      today (`mightStacks`/`kallaFervorStacks` are the only stack counters that exist). Needs a new
      `CombatState.carapaceStacks` field (same UI shape as `kallaFervorStacks`'s Renegade-gated
      stepper, surfaced only when Harbinger is equipped) before this can be curated.

## Bugs

- [ ] **Multiple same-status Buff facts on one skill render as unlabeled duplicate rows** — flagged
      by the user 2026-08-09 looking at Icerazor's Ire's tooltip (2 separate Vulnerability
      applications, 8s×10 on-summon + 8s×5 on-hit, both just labeled "Vulnerability" with no way to
      tell them apart). **Confirmed NOT specific to this skill or to synthetic-facts curation** — a
      full scan of `data/game-data/skills.json` found 214 real-API skills with this exact shape
      already (e.g. Skull Fear applies Fear 3 separate times, Blowtorch applies Burning 4 times), all
      already rendering the same way today. Root cause: `extractFromFacts`
      (`src/shared/boon-calc/sources.ts`) builds `BoonConditionSource` from only
      `status`/`duration`/`apply_count`/`requires_trait` — never `fact.description` (which the real
      API does populate, but with a generic per-status blurb, not a per-instance qualifier like the
      wiki's own `alt=` labels) — and `factsBlock` (`SkillsEditor.tsx`) renders only
      `f.boonOrConditionName`. No field exists anywhere in the pipeline to carry a per-instance label
      like "on summon" vs "on hit". User picked "leave as-is for now" when asked about scope (options
      were: leave as-is / add an optional label field populated only where hand-curated / a fully
      automatic generic label for all 214+ skills at once) — this entry is that future design pass,
      not started.

## Scoped features, not yet built

- [ ] Dodge-roll-sourced boons/conditions/heals/damage aren't tracked as their own category —
      flagged by the user 2026-08-07 (Vindicator and Mirage in particular build entire kits around
      dodging). Splits into two different problems on investigation:
      1. Trait procs already modeled as ordinary facts on the trait itself (e.g. Guardian's Selfless
         Daring, "the end of your dodge roll heals nearby allies" — real `AttributeAdjust`+Number(5)+
         Radius facts) likely already flow into totals today, since this app treats any chosen
         trait/skill with real facts as always-contributing regardless of its specific trigger
         condition — not a calc gap, just nothing labels it "from dodging" anywhere in the UI.
      2. Whole alternate dodge-replacement mechanics (Vindicator's Legendary Alliance dodge, Mirage's
         Mirage Cloak) have no skill id in `skills.json` at all and nothing in `src` references them
         by name — the GW2 API doesn't expose the dodge button as an activatable skill the way it
         does weapon/utility skills. Same "API gives nothing to render" shape as Revenant's
         Otherworldly Bond (see COMPLETED.md Session 131), not a wiring bug — would need hand-curated
         content.
      Also flagging: relics can grant dodge-triggered effects too (e.g. Relic of Rivers, "alacrity
      and regeneration at the end of your dodge roll") with only flavor text — same empty-facts
      problem again. User's proposed UI treatment once data exists: a small visual indicator above the
      skill bar (not a real skill slot) with its own custom tooltip for whatever a build's dodge
      grants beyond the normal evade frames.

- [ ] Discord bot — a guild-scoped, curated build/squad board (slash-command add/edit/remove/move,
      profession-sectioned board messages the bot keeps in sync, optional Manual-approval workflow
      with role-gated buttons) mapped out in full 2026-08-12, not started. Full design-of-record —
      command list, D1 schema, approval workflow, architecture decisions, explicit v1 non-goals —
      now lives in `docs/discord-bot.md` rather than here; read that first before picking this up.

- [ ] Capacitor port for iOS/Android — scoped 2026-08-01, two-part seam: (1)
      `StorageAdapter`/`Repository<T>` (`src/shared/storage/storage-interface.ts`) is already
      backend-agnostic — needs a new implementation (e.g. `@capacitor-community/sqlite`) replacing
      `sqlite-storage.ts`; (2) the renderer never calls that interface directly — it goes through the
      Electron-only preload bridge (`window.gw2Storage`, wired in `src/preload/index.ts` +
      `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent — needs a platform-neutral
      seam or a Capacitor-side shim. Also: native HTML5 drag-and-drop in the squad editor has no
      touch-input fallback yet.

- [ ] Stretch, deferred 2026-08-01: frame a build's "last updated" (shown today as a plain relative
      timestamp) relative to GW2 balance patches instead — e.g. "not reviewed since the last patch."
      Was blocked on a `/v2/build`-polling mechanism not existing yet; that's no longer true as of
      2026-08-11's in-app game-data refresh (`src/main/game-data/data-update.ts` now fetches and
      compares `/v2/build` via `meta.json`'s `gw2Build` — see `docs/game-data.md`'s "In-app
      game-data refresh" section). Not itself built — this stretch item can now reuse that same
      `gw2Build` value (the currently-loaded local `meta.json`'s, via `getLocalMeta()`) instead of
      polling a second, parallel patch-tracking path.

## Renegade tooltip/data gaps (flagged by the user 2026-08-12)

A user pass over Renegade turned up 5 display gaps, investigated together; the first 3 are already
fixed (weapon-clearing bug fix + `Percent` fact rendering + Kalla's Fervor combat-state wiring +
Spirit-Boon-style legend-icon attribution, this same session). The remaining 2 are hand-curation
sweeps, not code fixes, and weren't started:

- [x] **Legendary Renegade Stance skills are missing on-cast effects the wiki documents** — Renegade
      leg DONE 2026-08-12: Darkrazor's Daring (41220 base / 72366 "Band Together"-enhanced) now has
      Daze/Stability(x2)/Bonus Defiance Break, plus Resistance/Protection on the enhanced cast;
      Razorclaw's Rage (42949/72363) now has Bleeding/enhanced-Torment. Icerazor's Ire (40485/72359)
      was already done by an earlier sweep. Added via `synthetic-facts.json` (see
      `docs/game-data.md`'s "Skills the API returns with no usable facts at all" section) +
      `fetch-wvw-splits.ts` `MANUAL_OVERRIDES` for the one cleanly-splittable status (72366's
      Protection). Deliberately NOT curated, same family, documented in `fetch-wvw-splits.ts`'s
      comment: both skills' wiki Damage coefficients (no CURATED_DAMAGE_COEFFICIENTS entry, matching
      Icerazor's Ire's own precedent), Razorclaw's Rage's "(effect)" ally-buff + dependent "Enhance
      Bleeding" (not a recognized boon/condition name, `factLine` has no generic-text case — same
      Unleashed/Gunsaber-Mode-shaped skip as `docs/game-data.md` already documents), and
      Darkrazor's Daring's WvW-split Stability durations (two simultaneous same-status Buff facts —
      overriding either would collapse-drop the other, same failure mode Fox's Fury's Might hit).
      **Full sweep DONE 2026-08-12** (all 8 legends checked, not just Renegade): Dragon/Assassin/
      Dwarf/Demon/Alliance/Entity Stances turned out to already have real, substantial API facts for
      every heal/elite/utility skill — no gap of this shape existed there. **Legendary Centaur
      Stance was the other real gap**, same "API returns almost nothing" shape as Renegade — fixed:
      Energy Expulsion (27356, Healing/Conditions Removed/Knockdown), Protective Solace (26821,
      barrier Duration), Natural Harmony (27025, Healing/Delay Time), Purifying Essence (27715,
      Healing per Condition Removed/Conditions Removed). Ventari's Will (28427, the legend's
      heal-slot id) needed nothing — wiki-confirmed (2022-06-28 patch notes) it no longer heals at
      all, "will the tablet toward target location" is its whole effect; the near-empty facts were
      correct, not a gap.
      **Load-bearing wrinkle found mid-sweep**: `legends.json`'s ids (the ones `RevenantSkillsEditor`
      actually displays, confirmed via `docs/game-data.md`'s Protective Solace/Jade Winds writeup)
      are DIFFERENT ids from same-named, structurally-unreachable "orphan" siblings elsewhere in
      `skills.json` (26821 vs `29310`, 27025 vs `29082`, 27356 vs `29114`, 27715 vs `29197`) — the
      orphans often carry richer real API facts (an earlier Healing-category sweep had already
      curated 29197, and flagged 29114/29082 as unusable — see `healing-calc.ts`), but being
      unreachable, none of that helps the live ids on its own. Natural Harmony's Healing was
      initially left uncurated for this reason (orphan 29082's own live API value, 1620, disagreed
      with the wiki's 1124) — **resolved same session**: user-verified against the live wiki page
      (base unchanged across every dated Version History entry back to 2015) that 1124 is correct,
      confirming this app's standing wiki-over-API convention holds even when a same-skill API value
      exists to tempt otherwise (an orphan id has no in-game path forcing ArenaNet to keep it
      synced). Energy Expulsion's own orphan (29114) was separately confirmed stale by the same
      route — its "healing fragments" mechanic is verifiably pre-2022-06-28, retired by that patch's
      own wiki-documented notes, matching the current mechanic curated on live id 27356 exactly.
      **Not re-litigated, pre-existing partial curation**: Entity Stance's elite (76968/77001,
      wiki-titled "Fragment of Razah") already had its unconditional Might fact curated by an earlier
      session; its base Bleeding fact and its "Resonance" mechanic (5 different bonus effects
      depending on which OTHER legend is equipped) remain uncurated — a legend-conditional curation
      shape of its own, out of scope here, not chased further this session.

- [x] **Trait-granted boons don't show up on the skill that actually triggers them** — DONE
      2026-08-12. Notoriety (trait 1765, Might on legendary-stance-skill cast) and Rapid Flow (trait
      1760, Swiftness+Heal on any energy-cost skill cast) both curated via `synthetic-facts.json`
      `requires_trait`-gated facts, same mechanism the empty-effect-facts sweep uses, not real
      `traitedFacts` (the API never populates that link for either trait, confirmed via a full scan).
      Both traits turned out to target the exact same 45-skill candidate set (every legend's
      heal/3 utilities/elite across all 8 legends, including Vindicator's 10 Archemorus/Saint-Viktor
      aspect-flip ids) since every one of those costs Energy by design — Notoriety got 44 of the 45
      (Might), Rapid Flow all 45 plus one wiki-documented outlier, Shackling Wave (28472, a Sword
      weapon skill — "Updated this trait to allow Shackling Wave to heal the revenant", 2017-12-13
      patch note). `CURATED_HEALING_COEFFICIENTS` got a matching `'Rapid Flow Healing'` entry per
      skill (WvW value 333/0.05, deliberately NOT reusing the plain `'Healing'` factText some of
      these skills already have their own unconditional entry for — `skillFactLines`' `healingByLabel`
      lookup collapses same-text entries and would otherwise show the wrong number on one of the two
      lines). `wvw-fact-overrides.json` got a matching `Might: 10` override per skill via
      `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` (mirrors the trait's own already-curated WvW value).
      **One documented display gap**: Facet of Strength (26644) did NOT get a Notoriety fact at all —
      it already carries 2 real Might facts under an existing WvW override, and `extractFromFacts`
      collapses every fact sharing one status once any override exists for it, so a 3rd (ours) would
      be silently dropped rather than shown (same hazard Fox's Fury/Darkrazor's Daring hit in the
      empty-effect-facts sweep, see `fetch-wvw-splits.ts`'s `MANUAL_OVERRIDES` comment) — adding
      permanently-invisible data seemed worse than a documented omission. 4 more skills (Twin Moon
      Sweep, Empowering Misery, Selfish Spirit, Nomad's Advance) got the Notoriety fact but no WvW
      override for the same underlying reason, so their Notoriety line shows a flat 5s instead of
      splitting 5s pve/10s wvw — a narrower, cosmetic-only version of the same gap.
      **Deliberately out of scope, not chased this session**: Notoriety's own trait infobox also
      names Ancient Echo (core Revenant F2), True Nature ×5 legend flavors (Herald F2), and Citadel
      Order ×3 (Renegade F2-F4) as triggering skills — none of the 3 render anywhere in this app's UI
      at all (confirmed: none of their ids appear in Revenant's `professionSkills` list at all, the
      same real API-gap class `profession-mechanic.ts`'s `EXCLUDED_MECHANIC_SKILL_IDS` already
      documents for Dragonhunter's virtues/Specter's mechanics — would need new hand-injected
      mechanic-bar wiring before any trait-linking here could ever be seen). Also unexplored: whether
      a Facet's flip/consume half (e.g. Infuse Light, reached via `FlipSkillStack`'s own independent
      tooltip) should carry these facts too, since consuming a Facet is its own energy-costing skill
      activation in-game — left uncurated pending a genuine per-skill mechanic check, not assumed
      either way.

## Loose ends from the conditional-trait-attribute-bonus sweep

The trait-attribute-bonus sweep (`trait-attributes.ts`, COMPLETED.md Session 148) and its 8-family
conditional follow-on sweep (Sessions 149-156, all now closed) spun off these two items that don't
belong in either closed sweep's own table:

- [ ] Deadly Strength (Necromancer) grants a bonus per stack of Carapace, not Might — needs its own
      new Carapace-stack `CombatState` field before it can be curated; not part of the Might-stack
      family (`MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`) despite the surface similarity.
- [ ] Pinnacle of Strength's flat, unconditional +5% critical-hit chance fact is NOT curated
      anywhere — no unconditional flat-crit-chance table exists yet in this codebase (only the
      Fury-gated `FURY_CRIT_CHANCE_TRAIT_BONUSES`). Worth a future small sweep if more unconditional
      flat-crit traits turn up.

## Coefficient curation — remaining exceptions

`CURATED_HEALING_COEFFICIENTS` and `CURATED_DAMAGE_COEFFICIENTS` are now complete sweeps across all
9 professions and all 4 skill slots (see COMPLETED.md Sessions 57-74 for the full sweep history).
What's left below is specific skills/traits that were investigated and deliberately left uncurated —
don't re-guess a coefficient for these without a fresh look at the source conflict.

**Healing — Elite (1):**
- Revenant 29114 (Energy Expulsion, flip-skill): a fresh live API pull still returns a totally
  different fact set ("Healing Fragment"/knockback) than the wiki's current single knockdown+heal —
  unresolved API/wiki mismatch, not a stale cache.

**Healing — Utility (3):**
- Guardian 31295 (Sanctuary, underwater variant): a frozen pre-2016-balance-pass copy of id 9128 —
  no wiki coefficient documented for it specifically (underwater is out of scope for WvW anyway).
- Guardian 62669 (Repose): the wiki page itself is tagged stub — coefficient is an unfilled `?`.
- Revenant 29082 (Natural Harmony, Ventari facet): wiki base value (1124) disagrees with a freshly
  reconfirmed API value (1620) — a real conflict, not a stale read.

**Healing — Heal-slot (6):** Elementalist 44239 (Aquatic Stance — wiki template value matches
neither this app's API base nor the wiki's own version history, likely a stale unedited template);
Engineer 63049 (Rectifier Signet's trait-upgraded pulse heal — no wiki fact template at all);
Engineer 76738 (Mitotic State — API base 305 vs. wiki 7625/5500, ratio suggests a per-tick vs.
summed-total mismatch, unconfirmed); Necromancer 10547 (Summon Blood Fiend — pet's own fixed-0
Healing Power, no coefficient param on wiki, expected non-scaling); Necromancer 10670 (2nd Well of
Blood id — API values don't match either PvE/WvW reading of the shared wiki page, likely an
undocumented Scourge-context variant); Revenant 26937 (Enchanted Daggers — wiki 1640 vs. API 1560,
same +80 offset also shows up on its Siphon Damage facts).

**Healing — Weapon-slot (5):** Elementalist 72982 (Etching: Jökulhlaup, Spear — no `coefficient=`
param on wiki); Necromancer 30860 (Death Spiral — wiki stub, missing siphon coefficients);
Necromancer 69302 (Life Siphon — wiki 450/300 vs. API 537/238, unexplained); Ranger 31889 (Astral
Wisp, post-rework — wiki gives one base value across modes, API shows two duplicate-text facts at
~1/4 each, pulse relationship undocumented); Thief 72991 (Shadow Veil, Spear — two facts share
identical factText with only one wiki-documented coefficient; the table matches by factText alone so
curating risks binding to the wrong fact).

**Healing — Thief's Assassin's Reward trait (id 1238)**, investigated 2026-08-05: ~38
`requires_trait`-gated Healing facts (one per initiative-costing weapon skill), each a non-uniform
multiple consistent with `0.085 * that skill's own initiative cost`. **Blocked on missing data** —
this app has no initiative-cost field anywhere in `src/shared/types` or `skills.json`, so a generic
per-point trait-bonus table can't render without new data modeling first. (Necromancer's equivalent
case, Chillblains/Transfusion trait 778, was resolved 2026-08-05 as a genuine per-skill design, not
this shape — already curated.) Worth checking other professions for the same "heal on X while this
trait is active" shape before scoping further.

**Damage** — condition-damage skills (coefficient against Condition Damage rather than Power) were
never in scope for the sweep; would need their own wiki-verification pass
(condition-per-stack-per-second base values are a separate documented constant table) before
extending `CURATED_DAMAGE_COEFFICIENTS` to cover one.

**Both tables**: never visually spot-checked in the running app (Electron sandbox limitation) — do
that before extending either further, and before the tooltip visual-pass item below.

- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for — not a Healing fact
      itself, it modifies *other* incoming/outgoing heals. App has no general outgoing/incoming
      heal-modifier concept yet (distinct from the boon/condition uptime system); needs scoping, not
      a one-off patch for this skill.

- [ ] Dedicated visual pass over every tooltip type — icon-next-to-title and rarity-colored name
      header now landed (Session 141, visually confirmed live) for traits, skills, gear stat
      prefixes, runes, sigils, relics, and infusions, via `TooltipBody`'s new `icon`/`rarity` props
      in `Tooltip.tsx` + `.tooltip-header`/`.tooltip-icon`/`.tooltip-title.rarity-*` in
      `global.css`. Divider, tidy-list stat lines, and muted-vs-bright text were already in place
      from earlier work. Still open: **food/utility** — no icon-header work needed (already
      inherited via the shared `UpgradePicker`), but their real GW2 rarity varies per item (unlike
      every other category's single fixed tier), so they still render title-only, no rarity color.
      Needs each food/utility item's actual rarity plumbed from game data into `UpgradePicker`'s
      per-option tooltip (not just its single fixed `rarity` prop) before extending
      `.tooltip-title.rarity-*` to them.

- [ ] 76 Food catalog entries still have no buff data after `borrowSharedContainerBonuses` +
      `applyAscendedFeastFormula` (`fetch-gear-upgrades.ts`) — genuinely buff-less items that don't
      belong being offered as a "Food" pick at all: Mastery-point currency ("Elixir/Draught of X
      Mastery"), crafting materials ("Gift of Quartz"/"Pile of Golden Sand"), and achievement/
      collection rewards ("Threat Report: ..."). These came back in the picker when the (wrong)
      blanket exclusion was reverted 2026-08-06; whether to filter them back out by a narrower,
      verified rule (not the blanket `effectName === null` check that wrongly caught Feasts too) is
      an open question, not decided either way yet.

## Stats panel / boon-condition bar polish

- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Nice-to-haves

- [ ] Equipment editor: a "clear all" button per row (weapons, sigils, armor, runes, accessories,
      infusions, relic, food, utility) — flagged by the user 2026-08-11, not scoped yet (which rows
      count as one "row" vs. several, e.g. armor is 6 slots/trinkets are 6 slots — needs a UI pass to
      decide grouping before implementing).


- [ ] More curated fury-crit-chance traits in `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
      (seeded 2026-08-01 with only Revenant's Roiling Mists, for the Gear Optimizer's Critical
      Chance metric). Mesmer's Quiet Intensity added 2026-08-12 (wiki-verified: 15% PvE / 10% WvW,
      value 10 stored) as a side effect of curating this same trait's *other* unconditional effect in
      `trait-attributes.ts`. Still open — Engineer's Hematic Focus, Warrior's Furious Burst, Ranger's
      Vicious Quarry, Revenant/Renegade's Brutal Momentum — each needs its current WvW-mode value
      confirmed against the wiki (same as Roiling Mists) before being added.

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
