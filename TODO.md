# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Bugs

- [ ] **Gear Optimizer doesn't function properly yet** — flagged by the user 2026-08-05 while
      preparing the 0.2.0 release (shipped anyway, marked "early stage/experimental" in
      CHANGELOG.md rather than held back). No specific failure mode captured yet — reproduce live
      (Electron sandbox limitation applies, see memory) and narrow down whether it's a
      search-algorithm bug, a UI wiring issue, or something in the floor/maximize-tier translation
      before attempting a fix.

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

- [ ] Automatic game-data refresh mechanism (balance patches) — manual refresh only for now.
      Decided 2026-07-31: check for updates on app launch, prompt the user to refresh (not a silent
      background refresh) — user stays in control. `data/game-data/meta.json` only records
      `fetchedAt`, not a GW2 API build/version number, so "is there a new patch" isn't detectable
      yet under either option below; fetching `/v2/build` (a single integer) and comparing to a
      stored last-known value is needed regardless of which is chosen.
      - **Option A — live re-scrape in-app**: bundle the existing `scripts/fetch-*.ts` pipeline into
        the packaged app. Bigger lift — those scripts assume a dev Node environment and write
        straight to the repo, not a packaged app's writable user-data directory, and wiki-scraping
        from a shipped consumer app is fragile.
      - **Option B — piggyback on the auto-updater**: "new data" just means "new app version" —
        reuse the Settings-tab update flow already shipped (`src/main/updater/auto-updater.ts`).
        Simpler, but a data-only fix still requires a full version bump/release.
      - **Curation-side change detection** (separate question, direction chosen 2026-08-04): how
        *we* learn a patch changed a coefficient we've already curated, so the curated tables don't
        silently go stale. Official forums are too vague to parse reliably (confirmed via the
        Renegade trait rework — several changes are prose-only, no stated number). Better source:
        the wiki's Game_updates page and per-patch subpages, which give diffable
        `"X coefficient from A to B"` text — fetch the index, pull raw wikitext for patches newer
        than our last check, regex for "coefficient from," cross-reference matched skill names
        against curated tables. **Known limitation**: prose-only reworks (moving a bonus between
        traits, changing a trait's own %) produce no diffable signal — still needs a human read or
        a periodic trait re-review. Not yet built — direction only.

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
      Blocked on the same `/v2/build`-polling mechanism the item above needs; revisit once that's
      decided rather than building a second parallel patch-tracking path.

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

- [ ] Dedicated visual pass over every tooltip type (traits, skills, gear stat prefixes, runes,
      sigils, relics, food/utility, infusions) so they read as one coherent design instead of
      whatever shape each grew into. Content work already landed (skills: `skillFactLines`; traits/
      food/utility: `numericFactLines`/`formatConsumableDescription`) — this is styling only. Target
      look: in-game GW2/gw2skills.net conventions (rarity-colored name header, icon next to title, a
      divider, stat lines as a tidy list rather than a wrapped paragraph, muted flavor text vs.
      bright numeric bonuses). Starting point: `Tooltip.tsx`'s `TooltipBody` + `global.css`'s
      `.tooltip-*` rules already give skills a semi-structured layout — extend that shared vocabulary
      rather than inventing new one-off styling per content type.

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

- [ ] Curation sweep: resolve the remaining ~243 skills/traits (~205 skills + 38 traits, plus a small
      multi-profession "shared skill" bucket not yet broken out) whose only target-count signal is the
      ambiguous `"Number of Targets"` fact (no `"Number of Allied Targets"`), so
      `BoonConditionSource.targetCount` (`src/shared/boon-calc/sources.ts`) can show a badge for them
      instead of `null`/nothing. Confirmed via a full scan of `data/game-data/skills.json` that this
      fact is genuinely ambiguous, not just theoretically: some skills mean "self-only boon + N
      enemies hit separately" (Heat Wave: Vigor to self, Burning to 5 foes; also Convergence,
      Lightning Leap), others reuse the same label to mean an ally count on a pure support skill
      (Healing Rain, Healing Turret's id-5857 variant — Regeneration to up to 5 allies, no enemies
      involved; the equivalent id-6140 variant with no Number fact at all is already curated, see
      below). Curated table shaped like `wvwFactOverrides` (wiki-verified per skill/trait), same
      pacing as the Healing/Damage coefficient sweeps. The smaller sibling bucket — boon + Radius fact
      but no Number fact of any kind — was swept 2026-08-06 (see COMPLETED.md Session 95,
      `TARGET_COUNT_OVERRIDES` in `sources.ts`). This larger bucket's first leg (the 30 skills with no
      `professions` tag — pet/mount/racial/trait-proc skills) was swept 2026-08-06 too (Session 96,
      same table). Second leg — Thief (18 skills + 3 traits; one more, Pitfall, turned out to be a
      confirmed wiki tooltip bug and was deliberately left out, see the table's top comment) — also
      done 2026-08-06 (Session 97). Third leg — Necromancer (18 skills + 1 trait; 2 more, Well of
      Power and Mark of Blood, turned out to be genuine per-buff-line self/party-wide splits and were
      deliberately left out, see the table's top comment) — done 2026-08-06 (Session 98), corrected
      2026-08-06 (Session 99) after 3 of the original 21 candidates (Plague Blast, Dhuumfire, Life
      Reap) turned out to be `Downed_`-slotted skills the app can never actually reach — see the next
      bullet. Fourth leg — Warrior (23 skills + 1 trait, no exclusions needed) — done 2026-08-06
      (Session 100). Fifth leg — Engineer (35 skills + 4 traits; 2 more, Holo Leap and Corona Burst,
      were the already-known dead Holosmith `Downed_`-slot ids from the bullet below and were dropped
      without research) — done 2026-08-06 (Session 101). Sixth leg — Revenant (33 skills + 6 traits;
      2 more, Pain Absorption and Gladiator's Defense, turned out to be genuine per-source conflicts
      and were deliberately left out, see the table's top comment) plus 2 leftover no-profession-tag
      stragglers (Invoke Torment, Lesser Chilblains) — done 2026-08-06 (Session 102). Remaining legs
      are per-profession, smallest first per a live rescan: Ranger (43), Guardian (49), Mesmer (54),
      Elementalist (72) — Ranger is next-smallest. Re-run the scan rather than trusting these numbers
      once another leg lands.
      Stationary sources (banners/wells/spirits) fall into this same ambiguous/no-fact bucket and
      haven't been separately spot-checked.
- [ ] **Scan-methodology fix for all remaining legs**: `Build` has no downed-skill concept at all, and
      neither `skillIdsForBuild` nor `bundleContributionsForBuild` (`sources.ts`) ever produce a
      `slot: "Downed_*"` skill id UNLESS that id is also a real bundle-slot entry point (e.g.
      Necromancer Reaper Shroud's `NECRO_SHROUD_SLOT_SKILLS` in `bundle-skills.ts`, which reuses the
      `Downed_1`-`Downed_4` labels for Shroud's real weapon-bar skills — confirm reachability via that
      map, don't assume `Downed_*` alone means dead). Any `Downed_*` id NOT in one of those maps is
      unreachable — `resolveTargetCount` can never be called with it, so it isn't a real candidate and
      should be dropped from the scan before curating, not just skipped during write-up (caught this
      2026-08-06, Session 99, after 3 dead Necromancer entries slipped into Session 98's table). A
      full-game scan found exactly 2 more already sitting in the still-open pool, already excluded
      from the ~243 estimate above: Engineer's Holo Leap (42965, `Downed_2`) and Corona Burst (44530,
      `Downed_3`) — both real Holosmith downed-state skills, drop them the moment Engineer's leg scan
      turns them up rather than researching a wiki answer for either.
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
      eventual fix needs to cover beyond just "per-trait."
- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Nice-to-haves

- [ ] "Favorites" pin for the squad editor's per-slot build-assignment picker specifically (the
      dropdown that assigns a build to a squad slot). The general Builds/Squads card-grid views
      and the Food/Utility pickers got a Favorites feature 2026-08-06 (middle-click to pin, gold
      star badge — `renderer/lib/favorites.ts`), but that pass explicitly left the squad-slot
      build-assignment picker unwired.
- [ ] More curated fury-crit-chance traits in `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
      (seeded 2026-08-01 with only Revenant's Roiling Mists, for the Gear Optimizer's Critical
      Chance metric). A `traits.json` scan found 6 more with the same "extra crit chance while under
      Fury" shape — Engineer's Hematic Focus, Warrior's Furious Burst, Ranger's Vicious Quarry,
      Mesmer's Quiet Intensity, Revenant/Renegade's Brutal Momentum — each needs its current WvW-mode
      value confirmed against the wiki (same as Roiling Mists) before being added.
