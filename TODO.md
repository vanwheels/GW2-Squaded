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

- [ ] Curate more trait attribute bonuses (`trait-attributes.ts`) — sweep started 2026-08-12,
      profession-by-profession (see [[pacing-large-sweeps]]). Revenant/Salvation's "Life Attunement"
      (+120 Healing Power, 7% Healing→Concentration) plus, as of the **Mesmer leg (8 candidates,
      done)**, Virtuoso's "Quiet Intensity" (10% Vitality→Ferocity, wiki-verified 2026-08-12) are now
      curated. Mesmer leg findings: 5 of the 8 candidates were proc heal coefficients, not stat
      grants, same shape as Revenant's "Healer's Gift" (All's Well That Ends Well, Illusionary
      Inspiration, Restorative Illusions, Restorative Mantras, Raconteur — each fires "when you use/
      summon/end X," not an unconditional gain); 2 were conditional-on-boon flat bonuses, not
      unconditional (Chaotic Persistence: Concentration+Expertise "while affected by regeneration";
      Sharpening Sorrow: Expertise "while under Fury" after casting Bladesong Sorrow) — same shape as
      Vindicator's "Empire Divided" (Power/Healing Power +240 at ≤50% health), needs its own
      `CombatState`-style toggle rather than this unconditional table, not scoped further yet.
      **Engineer leg (17 candidates, done 2026-08-12)**: 5 curated — Compounding Chemicals (+75
      Concentration, WvW value), Chemical Rounds (+120 Condition Damage), Thermal Vision (+60
      Expertise, WvW value), Hybrid Vigor (+240 Vitality), Blast Shield (10% Power→Vitality). 9
      excluded as proc-heal/barrier coefficients (Soothing Detonation, Chain Reactivity, System
      Shocker, Ex Machina, Kinetic Accelerators, Heat Therapy, Crystal Configuration: Eclipse, Mech
      Core: Barrier Engine, Innervating Alloy). 3 flagged as new conditional shapes, not added to
      this unconditional table: Energy Amplifier (+250 Power/+250 Healing "while you have
      regeneration" — same Chaotic-Persistence-shaped boon-conditional gap as the Mesmer leg, no
      Regeneration toggle exists in `CombatState`); Applied Force (+10 Power, WvW value, once might
      stacks reach the 10-stack threshold — a *new* conditional shape, might-threshold rather than
      boon-presence, but `CombatState.mightStacks` already exists so this one's a smaller lift than
      Energy Amplifier's); No Scope (+150 Ferocity while Fury is active, no split — same Fury-gated
      shape as `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES` but a flat CritDamage bonus
      instead of a crit-chance %, so it doesn't fit that table either — would need a sibling table,
      e.g. `FURY_FEROCITY_TRAIT_BONUSES`).
      **Guardian leg (21 candidates, done 2026-08-12)**: 11 curated — Honorable Staff (+60
      Concentration, WvW value), Right-Hand Strength (+80 Precision, unconditional part only),
      Radiant Power (+150 Ferocity), Power of the Virtuous (13% Vitality→Condition Damage, WvW
      value), Zealous Blade (+120 Power, unconditional part only), Kindled Zeal (10%
      Power→Condition Damage), Defender's Dogma (+180 Vitality), Conceited Curate (+180 Vitality,
      unconditional part only), Power for Power (+120 Power), Searing Pact (+120 Condition Damage),
      Light's Gift (+180 Vitality). 8 excluded as proc-heal coefficients (Pure of Heart, Selfless
      Daring, Writ of Persistence, Altruistic Healing, Monk's Focus, Glacial Heart, Renewing
      Splendor, Hunter's Fortification — all "heals when/on X" procs, same Healer's-Gift shape).
      1 flagged as a **new conditional shape not yet seen in this sweep**: Imbued Haste
      (Firebrand minor) grants +250/150 Condition Damage, Healing Power, and Vitality (PvE/WvW+PvP
      split) "while affected by quickness" — same boon-gated-flat-bonus family as Chaotic Persistence
      (Mesmer, regeneration-gated) and Energy Amplifier (Engineer, regeneration-gated), but the first
      one gated on Quickness specifically; strengthens the case that this whole family needs a
      generalized "which boons are currently up" toggle in `CombatState`, not per-boon one-offs. Also
      surfaced a **second new conditional shape**: weapon-equipped-gated flat bonuses — Right-Hand
      Strength's other half (+80 Power while wielding a one-handed weapon in main hand), Zealous
      Blade's other half (+120 Power while wielding a greatsword, wiki fact literally labeled "Power
      While Wielding Greatsword"), and Stalwart Defender (+240 Toughness while wielding a shield, no
      split) all share this shape. Unlike the boon-gated family, this one doesn't need a new
      ephemeral toggle — `build.equipment` + `isActiveWeaponSlot` (the same helpers
      `detectActiveStackingSigil` in `combat-state.ts` already uses) can derive it directly from the
      build itself, so it's a smaller lift; still out of scope for this unconditional table, would
      need its own `WEAPON_CONDITIONAL_TRAIT_BONUSES`-style table.
      **Elementalist leg (19 candidates, done 2026-08-12)**: 8 curated — Aeromancer's Training (+150
      Ferocity, unconditional half only), Ferocious Winds (7% Precision→Ferocity), Strength of Stone
      (10% Toughness→Condition Damage), Burning Rage/Sunspot (+180 Condition Damage), Gathered Focus
      (+120 Concentration, WvW value), Elemental Enchantment (+120 Concentration, WvW value),
      Soothing Power (+300 Vitality), Elemental Refreshment (+180 Vitality, unconditional half only).
      7 excluded as proc-heal/barrier coefficients (Earthen Blast, Flow like Water, Healing Ripple,
      Arcane Restoration, Elemental Bastion, Master's Fortitude, Spirit's Succor). 4 flagged as
      already-known or new conditional shapes, not added to this unconditional table: Raging Storm
      (+180 Ferocity while under Fury — same Fury-gated-flat-bonus shape as Guardian's No Scope, both
      still waiting on a `FURY_FEROCITY_TRAIT_BONUSES` table); Power Overwhelming (+150 Power at/above
      the might threshold — same might-threshold-gated shape as Engineer's Applied Force); Arcane
      Lightning (+150 Ferocity for 15s after using an Arcane skill, via a self-applied "Arcane
      Lightning" buff — a *new* shape, on-skill-use temporary buff rather than a standing conditional,
      doesn't fit any flagged table so far); and a **new attunement-gated family**: Empowering Flame
      (+150 Power while in fire attunement) plus Aeromancer's Training's other half (+150 additional
      Ferocity while attuned to air) both grant a flat bonus only while a specific attunement is
      active — `CombatState` has no current-attunement toggle, would need one (same shape category as
      the weapon-equipped-gated and boon-gated families already flagged, just keyed on attunement
      instead).
      **Revenant leg (19 candidates, done 2026-08-12)**: 4 curated — Reinforced Potency (+60
      Concentration, WvW value; the trait's "for each active boon" language only modifies its
      separate strike-damage fact, not the flat Concentration one), Seething Malice (+120 Condition
      Damage — the exception this sweep's notes warned about: WvW groups with PvE here, not PvP),
      Elevated Compassion (13% Power→Concentration, no split — a genuine unconditional passive added
      by the 2023-07-18 patch "in addition to" this trait's two heal/boon procs, even though it's
      absent from the wiki's condensed description field), Versed in Stone (4% Toughness→Power, WvW
      value — a standalone "Gain power based on your toughness" sentence alongside two conditional/
      proc effects, same multi-clause shape as Life Attunement/Quiet Intensity). 14 excluded as
      proc-heal/barrier coefficients (Fiendish Tenacity, Shining Aspects, Battle Scarred, Rapid Flow,
      Glaring Resolve, Generous Abundance, Healer's Gift, Resilient Spirit, Words of Censure,
      Righteous Rebel, Redemptor's Sermon, Balance in Discord, Expanded Consciousness) plus 1 already-
      known health-threshold-conditional shape (Empire Divided — the very trait used as this sweep's
      prototype example for that family, Vindicator). Life Attunement was already curated from before
      this sweep started, not recounted.
      **Necromancer leg (29 candidates, done 2026-08-12)**: 11 curated — 5 flat (Lingering Curse:
      +200 Condition Damage, no split, despite the raw API fact's `target` reading `"None"` — a data
      quirk the wiki resolved; Furious Demise: +180 Precision; Vital Persistence: +180 Vitality;
      Alchemic Vigor: +240 Vitality; Boon of Creation: +60 Concentration, WvW value) and 6 conversions
      (Target the Weak: 13% Precision→Condition Damage, no split; Spiteful Fortitude: 10%
      Power→Vitality, no split; Fell Beacon: 4% Condition Damage→Expertise, WvW value; Implacable Foe:
      13% Vitality→Ferocity, no split; Dark Gunslinger: 13% Vitality→Expertise, WvW value; Twisted
      Medicine: 13% Vitality→Concentration, no split). 13 excluded as proc-heal/life-siphon/barrier
      coefficients (Transfusion, Vampiric, Overflowing Thirst, Life from Death, Signets of Suffering,
      Terror, Vampiric Presence, Blood Renewal, Blighter's Boon, Augury of Death, Feed from
      Corruption, Desert Empowerment, Spirit's Gift — life-siphon-on-hit is the same shape family as
      Healer's-Gift proc-heals, just health-drain-flavored instead of heal-flavored). 5 flagged as new
      or already-known conditional shapes, not added to this unconditional table: Reaper's Onslaught
      (+300 Ferocity while in Reaper's Shroud — a **new shroud-gated flat-bonus family**, same shape
      category as the attunement-gated/weapon-equipped-gated families already flagged, just keyed on
      shroud state) and Sand Sage (Concentration+Expertise while an active shade is up — same
      shroud/stance-gated family, Scourge's shade mechanic instead of shroud); Deadly Strength (Power
      + Condition Damage per Carapace stack, Death Magic) — a **new stack-scaling family**, distinct
      from Applied Force's single-threshold gate because Carapace stacks scale continuously; Awaken
      the Pain ("Might grants you more power," Spite minor) — same continuous stack-scaling family as
      Deadly Strength, keyed on Might instead of Carapace; Last Rites (Healing Power at three
      increasing tiers below 75%/50% health, Blood Magic minor) — same health-threshold-conditional
      shape as Vindicator's Empire Divided, just three tiers instead of one.
      **Warrior leg (22 candidates, done 2026-08-12)**: 9 curated — 5 flat (Blademaster: +120
      Expertise, no split; Forceful Greatsword: +120 Power, base/unconditional value only — see
      below; Axe Mastery: +120 Ferocity, no split; Roaring Reveille: +60 Concentration, WvW value;
      Inspiring Implements: +60 Concentration, WvW value) and 4 conversions (Great Fortitude: 10%
      Power→Vitality + 10% Power→Ferocity, no split on either — despite a wiki-noted discrepancy with
      2021 patch notes claiming the ferocity half should read from Vitality, current data/description
      both agree on Power; Wounding Precision: 4% Precision→Expertise, WvW value; Vigorous Shouts:
      13% Power→Healing Power, no split; Blood Reaction: 5% Precision→Ferocity + 10%
      Power→Condition Damage, both WvW-specific values out of a genuine 3-way pve/pvp/wvw split — see
      below). 10 excluded as proc-heal/barrier coefficients (Last Stand, Might Makes Right, Soldier's
      Comfort, Shrug It Off, Mending Might, Dual Wielding, Dead or Alive, Resolute Counter,
      Unshakable Mountain, Invigorating Tempo — all "heals/grants barrier when/on X" procs, same
      Healer's-Gift shape). 3 flagged as new or already-known conditional shapes: Deep Strikes
      (+180 Condition Damage while under Fury, Arms minor) — same Fury-gated flat-bonus family as
      Engineer's No Scope/Elementalist's Raging Storm, but targeting Condition Damage instead of
      Ferocity, so it wouldn't fit a `FURY_FEROCITY_TRAIT_BONUSES` sibling table either — reinforces
      that this family needs a generalized "which boon, which stat" toggle, not per-stat one-offs;
      Pinnacle of Strength ("Might applied to you grants more power," Strength minor) — same
      continuous stack-scaling family as Necromancer's Deadly Strength/Awaken the Pain, keyed on
      Might same as Awaken the Pain; Fatal Frenzy (+300 Power/+150-300 Condition Damage, "Berserk
      mode increases power and condition damage," Berserker minor) — a full instance of the
      shroud/stance-gated family (Reaper's Onslaught/Sand Sage), keyed on berserk mode. **Two data-
      shape notes worth remembering**: (1) Forceful Greatsword's weapon-gated doubling ("double these
      bonuses while wielding a greatsword") is NOT materialized as a second fact the way Right-Hand
      Strength/Zealous Blade/Axe Mastery's weapon-gated halves are — the trait exposes only the
      single always-active base value, confirmed via wiki version history ("120 power base, plus an
      additional 120 power when wielding greatsword"), so the doubled state is invisible to a
      fact-only scan; (2) Blood Reaction's berserk-mode doubling is the same invisible-doubling shape
      but applied to a *conversion percentage* rather than a flat bonus — a new sub-variant of the
      berserk/stance-gated family (multiplier-on-a-conversion, not an additive threshold bonus) to
      keep in mind if that family ever gets modeled.
      **Ranger leg (23 candidates, done 2026-08-12)**: 7 curated — 6 flat (Honed Axes: +120 Ferocity,
      unconditional half only — other half is the weapon-equipped-gated shape, gated on wielding an
      axe; Lingering Magic: +120 Concentration, WvW value; Arachnophobia: +150 Expertise,
      unconditional half only — other half gated on pet type; Ambidexterity: +120 Condition Damage,
      no split — its historical PvE/PvP+WvW split was consolidated by the 2019-03-05 update; Strider's
      Strength: +120 Power, unconditional half only — other half is weapon-equipped-gated, gated on
      wielding a sword; Natural Fortitude: +240 Vitality) and 1 conversion (Wellspring: 7%
      Power→Healing Power, no split — wiki separately flags an in-game rounding anomaly where the
      actual gain computes to 6.5%, used the declared 7% fact value per this table's usual
      convention). 4 excluded as a **new pet-only-stat shape**, distinct from proc-heals: Fang and
      Claw (precision/ferocity to feline/avian/drake pets only), Pet's Prowess (pet move speed/crit
      damage), Natural Healing (pet health regen), Pack Alpha (pet's own power/condition
      damage/precision/toughness/vitality) — all grant stats to the ranger's *pet*, not the ranger's
      own character sheet, so out of scope for this player-attribute table regardless of the
      unconditional language. 11 excluded as proc-heal/barrier/life-siphon coefficients (Windborne
      Notes, Evasive Purity, Allies' Aid, Rugged Growth, Invigorating Bond, Live Vicariously, Verdant
      Etching, Cultivated Synergy, Eternal Bond, Predator's Cunning, Nature's Shield — plus Natural
      Fortitude's own life-siphon half, excluded while its Vitality half was curated). 1 flagged as an
      already-known conditional shape: Vicious Quarry ("Fury grants ferocity," Skirmishing major) —
      same Fury-gated flat-bonus family as Guardian's No Scope/Elementalist's Raging Storm/Warrior's
      Deep Strikes, still waiting on a `FURY_FEROCITY_TRAIT_BONUSES`-style table; this trait's *other*
      effect (crit chance while under Fury) is the one already tracked in `combat-state.ts`'s
      `FURY_CRIT_CHANCE_TRAIT_BONUSES` TODO entry below.
      **Remaining leg (~29 candidates, Thief) not yet swept** — each
      candidate needs its trait *description* read for genuine unconditional "gain X" language, same
      rigor as every other curated table; regenerate the candidate list per-profession via a
      `traits.json` scan for `AttributeAdjust`/`BuffConversion` facts joined against
      `specializations.json` if picking this back up in a new session.

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
