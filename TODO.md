# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Bugs

- [ ] **Gear Optimizer doesn't function properly yet** — flagged by the user 2026-08-05 while
      preparing the 0.2.0 release (shipped anyway, marked "early stage/experimental" in
      CHANGELOG.md rather than held back). No specific failure mode was captured at the time.
      2026-08-07: since live UI reproduction isn't possible (Electron sandbox limitation), built a
      standalone repro script (loads real `data/game-data/*.json`, calls `optimizeGear` directly,
      cross-checks its reported `metricValues` against `computeCharacterStats` — the function
      `StatsPanel` actually renders from — for the exact same resulting build) and found and fixed
      one concrete, reproducible bug: `optimizeGear`'s final re-derivation reimplemented
      `computeCharacterStats`'s accumulation by hand and silently dropped its
      `applyConversions(activeConsumableConversions(...))` step, so any build with a "Gain X Equal
      to N% of Your Y" food/utility item (Superior Sharpening Stone, Tuning Crystals, etc. — 69 WvW
      utility items alone carry this shape, confirmed elsewhere in this codebase as "the dominant
      WvW Utility-consumable shape") would show an optimizer result that understated the converted
      stat versus what the Stats panel computes for that identical build (reproduced a ~100-Power
      understatement on a test Guardian). Fixed in `gear-optimize.ts` — see COMPLETED.md. Left open
      rather than closed: this is confirmed real and fixed, but wasn't necessarily the only issue
      behind the original "doesn't function properly" report, and the fix itself is still unverified
      in the live running app — re-close (or re-open with a fresh failure mode) after an actual
      in-app check.

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

- [ ] Gear Optimizer: make rune and infusion choice searchable (currently `optimizeGear` treats
      equipped runes/infusions as a fixed baseline, same as food/utility when that toggle is off) —
      scoped 2026-08-01, runes + infusions only for now (sigils are procs, not a stat lever the
      floor/maximize model fits). Needs: (1) new `OptimizerSlot` entries — likely a single "rune set"
      slot (WvW runes are usually 6x one rune, so not 6 independent slots) plus per-slot infusion
      capacity, already known via `upgrade-slots.ts`; (2) `statOptionsFor`'s dedup-by-relevant-metric
      pattern extended to rune tiered bonuses (`Rune.bonuses`) and infusion flat points
      (`Infusion.attribute`/`.value`); (3) a "optimize runes/infusions" toggle in
      `GearOptimizerPanel.tsx`, parallel to the existing "optimize food/utility" checkbox.

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

- [ ] Curate more trait attribute bonuses (`trait-attributes.ts`). Only Revenant/Salvation's "Life
      Attunement" is curated so far (+120 Healing Power, 7% Healing→Concentration, found via a
      gw2skills.net cross-check). A `traits.json` scan found ~190 more candidates (168 with an
      `AttributeAdjust` fact, 25 with `BuffConversion`) but the fact type alone doesn't mean "you
      passively gain this" — confirmed live that Revenant/Salvation's "Healer's Gift" is actually the
      coefficient for its own dodge-roll proc, not a stat grant. Each candidate needs its trait
      *description* read for genuine unconditional "gain X" language before being added, same rigor
      as every other curated table — add incrementally as specific builds get tested, not as a bulk
      pass. Watch for conditional variants too: Vindicator's "Empire Divided" (Power/Healing Power
      +240) is conditional on a 50% health threshold, not unconditional like Life Attunement — needs
      its own `CombatState`-style toggle (like `furyActive`) rather than the unconditional table.

- [ ] 76 Food catalog entries still have no buff data after `borrowSharedContainerBonuses` +
      `applyAscendedFeastFormula` (`fetch-gear-upgrades.ts`) — genuinely buff-less items that don't
      belong being offered as a "Food" pick at all: Mastery-point currency ("Elixir/Draught of X
      Mastery"), crafting materials ("Gift of Quartz"/"Pile of Golden Sand"), and achievement/
      collection rewards ("Threat Report: ..."). These came back in the picker when the (wrong)
      blanket exclusion was reverted 2026-08-06; whether to filter them back out by a narrower,
      verified rule (not the blanket `effectName === null` check that wrongly caught Feasts too) is
      an open question, not decided either way yet.

## Stats panel / boon-condition bar polish

- [ ] Two concrete examples turned up 2026-08-06 of a gap `BoonConditionSource.targetCount`'s doc
      comment previously said had no known instance: a skill/trait whose facts array mixes a
      self-only boon and a party-wide boon, distinguishable only by which OTHER trait is chosen —
      not expressible by `TARGET_COUNT_OVERRIDES`' one-value-per-source shape. Guardian's Tome of
      Courage (ids 42259/42371/68646/68650): its base Aegis proc is self-only, but Stability
      (Indomitable Courage) and Protection (Inspired Virtue) become party-wide only when those
      specific traits are also chosen. Willbender's Phoenix Protocol (trait 2195): its Alacrity/
      Regeneration/Resolution are self-only unless Battle Presence (trait 554) is also chosen. Needs
      a per-buff-line (not per-source) target-count model to resolve correctly — scoping, not a
      one-off patch. Two more shapes of the same underlying gap turned up in the Revenant leg
      (Session 102): Pain Absorption (27322/78505) mixes party-wide and self-only under the SAME
      status ("Resistance" twice, different reach) rather than two different statuses; Gladiator's
      Defense (77291) flips self-only vs. party-wide based on which LEGEND is equipped, not which
      trait is chosen — neither is expressible by `requires_trait` gating either, widening what the
      eventual fix needs to cover beyond just "per-trait." A fourth shape turned up in the Guardian
      leg (Session 105): Holy Reckoning (trait 2210) mixes a party-wide Might line ("Triggered virtue
      effects...now grant might to allies") and a self-only Fury line ("Gain fury when activating
      Rushing Justice") under ONE trait with no `requires_trait` distinguishing them at all — both
      lines share a single Radius(360)/Number-of-Targets(5) fact, so even the per-`requires_trait`
      version of a fix wouldn't resolve this one; needs true per-buff-line granularity. Two more
      turned up in the Elementalist leg (Session 106): Overload Earth (skill 29618) mixes a self-only
      base Stability with a party-wide base Protection, both unconditioned (no gate at all, of any
      kind) on one source. Hare's Agility (skill 76583) mixes a self-only base Swiftness with a
      party-wide Fury added by Altruistic Aspect (trait 2415) specifically when traited — a
      documented, real addition (unlike a tooltip bug), but still an unsplittable per-source conflict
      once traited.
- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Nice-to-haves

- [ ] More curated fury-crit-chance traits in `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
      (seeded 2026-08-01 with only Revenant's Roiling Mists, for the Gear Optimizer's Critical
      Chance metric). A `traits.json` scan found 6 more with the same "extra crit chance while under
      Fury" shape — Engineer's Hematic Focus, Warrior's Furious Burst, Ranger's Vicious Quarry,
      Mesmer's Quiet Intensity, Revenant/Renegade's Brutal Momentum — each needs its current WvW-mode
      value confirmed against the wiki (same as Roiling Mists) before being added.
