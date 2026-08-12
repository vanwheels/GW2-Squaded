# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

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

- [ ] Discord bot (client of the backend API) — scoped 2026-08-01: `worker/src/index.ts` is
      currently just an anonymous KV blob store (`POST /shares` create, `GET /shares/:id` fetch) —
      no user-account concept, no "list a user's builds/squads" endpoint, so a bot can only "post an
      embed of a given share link" today, not browse or manage a library. Blocked on a follow-up
      conversation: post-a-share-as-embed only, or a fuller command set that would need new
      auth+listing endpoints on the worker (a bigger lift than the bot itself)?

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

## Conditional trait-attribute bonuses — remaining families

The trait-attribute-bonus sweep (`trait-attributes.ts`, COMPLETED.md Session 148, closed 2026-08-12)
only modeled *unconditional* flat bonuses/conversions. Along the way it surfaced 8 distinct families
of traits whose bonus only applies under some condition — each needs its own new plumbing (usually a
new `CombatState` toggle) before those traits can be curated at all. One leg per session, same pacing
as every other sweep here (`pacing_large_sweeps` memory) — do not chain these.

- [x] **Fury-gated Ferocity/Condition-Damage** — done 2026-08-12, see COMPLETED.md. No Scope
      (Guardian, id 1923), Raging Storm (Elementalist, id 214), Deep Strikes (Warrior, id 1343),
      Vicious Quarry (Ranger, id 1888), No Quarter (Thief, id 1904) — all wiki-verified, live in
      `combat-state.ts`'s `FURY_ATTRIBUTE_TRAIT_BONUSES`/`furyAttributeTraitBonus`, sibling to the
      already-existing `FURY_CRIT_CHANCE_TRAIT_BONUSES` family. No new UI — reuses the existing
      `CombatState.furyActive` toggle. Grew a 6th entry during the Boon-gated leg below: Sharpening
      Sorrow (Mesmer/Virtuoso, id 2207) was misfiled in this checklist as Regeneration-gated — its
      wiki page confirms it's actually Fury-gated (its own on-cast Fury proc, +150 Expertise), so
      it's added here instead, target `ConditionDuration`.
- [x] **Boon-gated flat bonuses** (Regeneration/Quickness) — done 2026-08-12, see COMPLETED.md.
      Chaotic Persistence (Mesmer, id 1865, Regeneration-gated) and Energy Amplifier (Engineer, id
      519, Regeneration-gated) live in `combat-state.ts`'s
      `REGENERATION_ATTRIBUTE_TRAIT_BONUSES`/`regenerationAttributeTraitBonus`; Imbued Haste
      (Guardian/Firebrand, id 2148, Quickness-gated) and Be Quick or Be Killed (Thief/Deadeye, id
      2093, Quickness-gated) live in `QUICKNESS_ATTRIBUTE_TRAIT_BONUSES`/
      `quicknessAttributeTraitBonus` — all wiki-verified. Sharpening Sorrow, originally listed here,
      turned out to be Fury-gated instead (see the Fury leg's entry above). Went with one boolean per
      boon (`CombatState.regenerationActive`/`quicknessActive`, mirroring `furyActive`) rather than a
      generalized boon map — only these 2 boons have any curated trait bonus so far. New toggle icons
      added to `CombatStatePanel.tsx` next to the existing Fury toggle.
- [x] **Weapon-equipped-gated flat bonuses** — done 2026-08-12, see COMPLETED.md. Lives in
      `trait-attributes.ts`'s `WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES`/
      `activeWeaponEquippedAttributeTraitBonus`, needing no new `CombatState` field as expected
      (derivable purely from `build.equipment`, gated via 2 new helpers, `activeWeaponTypes`/
      `activeMainHandWeaponType`). Also folded into `gear-optimize.ts`'s pre-search baseline
      alongside `activeTraitFlatBonuses`, since the optimizer never touches `weaponType`. 13 traits
      curated, wiki-verified via the live API's own `description` text (matches each trait's
      already-wiki-verified base-half comment in `CURATED_FLAT_BONUSES`): Right-Hand Strength (566,
      Guardian, +80 Power, one-handed weapon in main hand only — Axe/Mace/Scepter/Sword), Zealous
      Blade (653, Guardian, +120 Power, Greatsword), Forceful Greatsword (1338, Warrior, +120 Power
      additional on top of its already-curated +120 base, Greatsword/Spear — not originally on this
      checklist's candidate list, surfaced by its "doubling" comment in `CURATED_FLAT_BONUSES`),
      Blademaster (1333, Warrior, +120 ConditionDamage, Sword — a different attribute than its
      unconditional Expertise half, not a doubling of it), Axe Mastery (1369, Warrior, +120
      CritDamage, Axe), Honed Axes (970, Ranger, +120 CritDamage, Axe), Ambidexterity (1101,
      Ranger, +120 ConditionDamage, Torch/Dagger/Mace), Strider's Strength (1700, Ranger, +120
      Power, Sword), Swindler's Equilibrium (1192, Thief, +120 Power, Sword/Spear), Dagger Training
      (1245, Thief, +80 Power, Dagger), Staff Master (1884, Thief, +120 Power, Staff), Second
      Opinion (2284, Thief, +90 ConditionDamage, Scepter), Stalwart Defender (580, Guardian, +240
      Toughness, Shield — wiki-verified via raw wikitext since it has no unconditional half at all,
      the only entry in this family with no counterpart in `CURATED_FLAT_BONUSES`). Arachnophobia
      (1099, Ranger), one of this checklist's original candidates, turned out NOT to belong here on
      a fresh check — its second fact is pet-type-conditional (Spider/Devourer), not weapon-gated —
      confirming the checklist's own warning not to trust the Session 148 candidate list blindly.
- [x] **Attunement-gated flat bonuses** (Elementalist only) — done 2026-08-12, see COMPLETED.md
      Session 153. Empowering Flame (id 320, +150 Power, no unconditional half at all) and
      Aeromancer's Training's excluded half (id 223, +150 Ferocity, air) — both wiki-verified, live
      in `trait-attributes.ts`'s `ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES`/
      `activeAttunementAttributeTraitBonus`. Turned out **not** to need a new `CombatState`
      field/UI as this checklist originally assumed — `Build.activeAttunement` already tracks the
      currently-selected attunement (set via the existing F1-F4 `ProfessionMechanicBar` icons), so
      this leg reused persisted `Build` state instead, same shape as the weapon-equipped-gated leg.
- [x] **Shroud/stance-gated flat bonuses** — done 2026-08-12, see COMPLETED.md Session 154. Reaper's
      Onslaught (Necromancer/Reaper, id 2021, +300 Ferocity), Fatal Frenzy (Warrior/Berserker, id
      2046, +300 Power/+300 ConditionDamage WvW value), Sand Sage (Necromancer/Scourge, id 2121,
      +150 BoonDuration/+150 ConditionDuration WvW value) — all wiki-verified, live in
      `combat-state.ts`'s `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES`/
      `mechanicActiveAttributeTraitBonus`. Needed a genuinely new `CombatState.mechanicActive`
      boolean (single field covering all 3 mechanics, mirroring `furyActive`'s shape) since none of
      Shroud/Shade/Berserk-mode has a persisted `Build` field usable as the gate (unlike the
      weapon-equipped/attunement legs) — `Build.activeBundleSkillId` only tracks which skill bar is
      displayed for Shroud, deliberately not gating real totals. New toggle icon in
      `CombatStatePanel.tsx`, shown only when the build has one of the 3 curated traits chosen.
- [ ] **Revealed-state-gated flat bonuses** (Thief only) — Revealed Training's excluded half
      (+120/150 Power while Revealed). Needs a new boolean `CombatState` field + UI, Thief-only.
- [ ] **Health-threshold-conditional flat bonuses** — Empire Divided (Revenant, already the sweep's
      prototype example for this shape), Last Rites (Necromancer, 3 tiers below 75%/50% health).
      Needs a health-% `CombatState` field (slider or preset tiers) + UI.
- [x] **Continuous Might-stack-scaling flat bonuses** — done 2026-08-12, see COMPLETED.md Session
      150. Awaken the Pain (Necromancer, id 915, +10 Power/Might stack), Pinnacle of Strength
      (Warrior, id 1453, +10 Power/Might stack), Applied Force (Engineer/Scrapper, id 1849, +10
      Power/Might stack, WvW value) — all wiki-verified, live in `combat-state.ts`'s
      `MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES`/`mightStackAttributeTraitBonus`. No new UI — reuses the
      existing `CombatState.mightStacks` field. Applied Force's threshold clause turned out to gate
      a separate Stability proc, not the Power bonus, so it fit this family after all. Two loose
      ends spun off:
      - Deadly Strength (Necromancer, per Carapace stack, not Might) still needs its own new
        Carapace-stack `CombatState` field — deferred, not part of this family.
      - Pinnacle of Strength's flat, unconditional +5% critical-hit chance fact is NOT curated
        anywhere — no unconditional flat-crit-chance table exists yet in this codebase (only the
        Fury-gated `FURY_CRIT_CHANCE_TRAIT_BONUSES`). Worth a future small sweep if more
        unconditional flat-crit traits turn up.

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
