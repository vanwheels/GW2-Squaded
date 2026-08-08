# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Bugs

- [ ] **`PrefixedBuff`-type facts are completely unmodeled** — flagged by the user 2026-08-07 via a
      concrete live example: Revenant/Salvation's minor trait Serene Rejuvenation ("Legendary
      Centaur skills apply boons in an area") grants Vigor/Regeneration/Swiftness/Resistance×2 on
      top of Ventari's own Natural Harmony/Purifying Essence/Protective Solace/Energy Expulsion
      skills — but none of those bonus boons show up anywhere in the app (tooltip or boon bar). Root
      cause: the GW2 API expresses "trait/skill X adds a boon specifically to skill Y's own effect"
      as a `type: "PrefixedBuff"` fact (same `status`/`duration`/`apply_count` shape as an ordinary
      `type: "Buff"` fact, PLUS a nested `prefix: { status, description }` naming which specific
      other effect it rides on) — `extractFromFacts` (`boon-calc/sources.ts`) only ever checks
      `fact.type !== 'Buff'`, so every `PrefixedBuff` fact is silently skipped, everywhere that
      function is used (tooltips, boon bar, skill picker). This is NOT Revenant/Salvation-specific —
      a full scan of `data/game-data/{traits,skills}.json` found 263 trait facts + 117 skill facts
      of this shape project-wide, completely unhandled. Bigger than a one-line fix: needs a scoping
      pass (does `prefix.status` reliably resolve to a specific already-modeled skill id for correct
      source attribution, or only a display name? are any of these gated the same way regular Buff
      facts are, e.g. `requires_trait`? do the target-count/duration-scaling rules already built for
      `Buff` facts apply identically?) before extending `extractFromFacts` — likely its own
      multi-leg sweep, similar in shape to the Healing/Damage coefficient sweeps, not a quick patch.

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

- [ ] **Some skills' real effects live entirely outside the GW2 API's `facts` array** — flagged by
      the user 2026-08-07, concrete example: Revenant Scepter 3 "Otherworldly Bond" (id 71952) and
      its flip target "Deactivate Otherworldly Bond" (71858) both carry only Range/Recharge facts —
      nothing describing the actual tether mechanic (different effect on an ally target vs. an enemy
      target, strengthening over time). This app's tooltip only ever renders `skill.facts`/
      `traitedFacts`, so a skill like this shows flavor text and nothing else, with no indication
      anything is missing. User's concern 2026-08-07: this may not be a one-off, and the app has been
      trusting API facts as complete ground truth more than it should — gw2skills.net (further along
      in this same problem space) maintains its own separate, hand-curated data pipeline specifically
      because the official API has real content gaps, but even they lag official patches meaningfully
      (their site only reflected the 7-14-2026 balance patch as of 8-6-2026, over 3 weeks late).
      Building an equivalent hand-curated layer here would fix completeness but hands this app the
      same lag/maintenance burden gw2skills already carries.

      **Red-flag scan DONE 2026-08-08** (see COMPLETED.md Session 115): built
      `scripts/scan-empty-effect-facts.ts` (`npm run scan-empty-effect-facts`) — confirms this is NOT
      an Otherworldly-Bond one-off. Pass 1 (local): of 4702 total skills, 71 player-equippable AND
      reachable ones (a raw `slot: "Downed_*"` id is excluded unless it's also a real Necromancer
      Shroud weapon-bar entry — see `bundle-skills.ts`'s exported `SHROUD_SLOT_SKILLS` — since this
      app has no downed-skill concept at all and an unreachable id isn't a real gap; caught and fixed
      2026-08-08 after the user correctly flagged an initial draft of this scan miscounting 2 genuine
      dead downed-only ids as "actionable") have a substantive description (>=60 chars) but zero facts
      beyond Range/Recharge/Distance/Radius. Pass 2 (wiki): resolved each candidate's wiki page and
      checked for a structured `{{skill fact|...}}` template beyond that same meta set — **41 ids / 35
      unique skill names DO have one** (the wiki documents real mechanic data this app's local API
      data omits entirely, same shape as Otherworldly Bond itself — confirmed live in its own template
      dump: 15+ enemy-target/ally-target/vulnerability/crippled/slow/might/fury/duration/interval
      lines fully describing the tether), 26 confirmed non-issues (kit-equip/legend-stance/shroud
      toggles and "X: Backfired" placeholder skills — the wiki agrees with the API there's nothing
      more to model), 4 unresolved (no wiki page found/verified, needs a manual look). Notable
      clusters in the 35, every attribution verified directly against `skills.json`/
      `specializations.json` (not assumed from naming): all 5 Necromancer/**Harbinger** "Elixir of
      ___" skills (Bliss/Risk/Ambition/Anguish/Promise, each 2 ids — a `GroundTargeted`/non-`GroundTargeted`
      duplicate pair, same shape as this app's other documented duplicate-skill-id cases —
      10-24 wiki fact lines apiece — the biggest single gap) plus Harbinger Shroud's own Voracious Arc
      and Devouring Cut (both real Shroud weapon-bar skills, reachable despite their raw `Downed_*`
      slot label — see above); Necromancer/**Ritualist**'s Summon Spirits and Anguish (same Shroud-slot
      shape); 11 Elementalist/**Weaver** Pistol (7, Weapon_2/3) and Spear (4, Weapon_3) Dual Attacks
      (Raging Ricochet, Dazing Discharge, Shattering Stone, Frostfire Flurry, Flowing Finesse, Molten
      Meteor, Echoing Erosion, Shale Storm, Frostfire Ward, Elutriate, Galvanize); Guardian/**Luminary**'s
      virtue skills (Radiant Resolve/Justice); Thief's Shadowsquall (**Specter**) and Malicious
      Shadowsquall (**Deadeye**) pair; Warrior/**Bladesworn**'s Unsheathe Gunsaber; Revenant's
      Otherworldly Bond (core), Icerazor's Ire (**Renegade**), Twin Moon Sweep (**Conduit**), and
      Legendary Demon Stance (core); Ranger/**Untamed**'s Unleash Ranger/Unleash Pet; and Mesmer/
      **Troubadour**'s Tale of the Tortured Mastermind. **Not yet fixed** — this scan only locates and
      sizes the gap (35 skills' worth); actually modeling any of these requires per-skill `Fact`-shape
      design work beyond a flat coefficient table (dual ally/enemy-target branches, elixir stacking
      tiers, etc.) — scoped as its own follow-up curation item, not started.

- [ ] **Skill tooltips never show a skill's own Misc/Control/Strip-Corrupt/Combo/Aura facts** —
      flagged by the user 2026-08-07, concrete example: skills that apply Superspeed correctly show
      up in the boon/condition bar's "Misc." row but the same skill's own tooltip shows nothing for
      it. Root cause confirmed in `SkillsEditor.tsx`'s `skillTooltipContent`/`factsBlock`: a skill
      tooltip only ever renders `factLine`'s generic numeric lines (`fact-numbers.ts` — has no
      `case 'Buff':` at all) and `boonConditionFactsForSkill`'s output, which is hardcoded to only
      ever produce `category: 'boon'|'condition'`. Every other category — Misc (Stealth/Superspeed/
      Evade), Control, Strip/Corrupt, Combo Field/Finisher, and **Auras** — only exists via a separate
      whole-build aggregation path (`computeNamedFactSources`/`computeAuraSources`/
      `computeComboSources` in `boon-calc/sources.ts`) that feeds only `BoonConditionSummaryPanel`,
      never the per-skill tooltip. Auras are silently missing from tooltips too even though the user
      didn't name them specifically — same hole. Fix shape: a per-skill counterpart to
      `computeNamedFactSources` (run the same matchers directly against one skill's `facts`/
      `traitedFacts` instead of walking the whole build) threaded into `factsBlock`, parallel to how
      boon/condition facts already render there.

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
      - **Option C — static-publish the generated JSON, chosen 2026-08-07**: not a real queryable
        API (no query logic, no auth, no rate limiting to design) — whenever
        `scripts/fetch-*.ts`/the wiki-extraction pipeline (see "Wiki-sourced data pipeline" section
        below) regenerates `data/game-data/*.json`, publish that blob somewhere fetchable and have
        the app pull it on the same launch-time "check for updates, prompt the user" flow already
        decided above, instead of requiring a new app binary for a data-only fix. Reuses
        already-running infra rather than standing up anything new: either a new endpoint on the
        existing `worker/` (Cloudflare Worker, currently just the build-share KV store) or simply the
        public repo's raw GitHub content URL (already public to support electron-updater). Chosen
        specifically because it decouples data-freshness
        from release cadence for both desktop (GitHub Releases lag) and the still-scoped Capacitor
        mobile port (App Store/Play Store review lag is worse) — solves Option A/B's shared weakness
        without their downsides: the app stays local-first/offline-capable (still reads its local
        cache when there's no network; this only changes how that cache gets refreshed), and there's
        no new ops burden (no server logic, no uptime/auth surface — a static blob, not a live API).
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

- [x] Condition Cleanse count as a tracked stat, folded into the existing Strip/Corrupt row (relabel
      "Strips / Corrupts / Cleanses", not a new row) — scoped 2026-08-07. Data shape confirmed same
      as `Strip`/`Corrupt`'s existing `BOON_STRIP_CORRUPT_MATCHERS` pattern: `type: "Number"`,
      `text: "Conditions Removed"`, `value: N`. User-confirmed 2026-08-07 this needs the same
      self-vs-party split the boon target-count sweep needed for ambiguous `"Number of Targets"`
      facts — a `"Conditions Removed"` fact alone doesn't say who it cleanses from, and at least one
      variant text (`"Initial Self Conditions Removed"`) already hints at a self-only case existing
      alongside a party-wide default. Likely needs its own `TARGET_COUNT_OVERRIDES`-style curated
      table (wiki-verified per skill/trait) rather than a blanket matcher, same pacing/rigor as that
      sweep — not a quick matcher add.

      **First-draft classifier built 2026-08-08**: `scripts/fetch-condition-cleanse.ts`
      (`npm run fetch-condition-cleanse`) — same `resolvePage`/wiki-cache skeleton as
      `fetch-target-counts.ts`, but BUILDS a first classification rather than validating an existing
      table (none exists yet). Candidates: every equippable+reachable skill/trait carrying a
      `Number` fact matching `/condition.*remov|remov.*condition/i` (235 total: 193 skill, 42
      trait). Classifies primarily off the wiki infobox's own `description=` prose, restricted to
      the sentence(s) that actually mention "condition" (an earlier draft read unrelated "you"/
      "yourself" mentions elsewhere in the description as self-only evidence and produced confirmed
      wrong verdicts — e.g. Med Pack Drop misread as self-only despite its own `Number of Allied
      Targets: 5` fact — fixed before trusting any output). Live run (2026-08-08): 34 HIGH-CONFIDENCE
      SELF, 8 HIGH-CONFIDENCE PARTY (with a wiki-derived count), 53 PARTY-but-no-count-on-page
      (party certain, count needs the default-5 convention or a manual look), 1 self+pet (not a
      clean fit — Empathic Bond), 21 UNCLEAR, 13 description-never-mentions-conditions (needs a
      Notes-section/manual read), 30 UNRESOLVED COLLISION, and 75 skill ids gated behind
      `requires_trait` (base skill description can't be trusted for these — but they collapse to
      only ~11 distinct granting traits, e.g. Warrior's Cleansing Ire alone explains 30 of the 75
      raw ids, so the real remaining curation burden is much smaller than the raw count suggests).
      Console-report only, same as every other fetch-*.ts pilot — does not write `sources.ts` or any
      data file.

      **`CONDITION_CLEANSE_TARGETS` built 2026-08-08** (see COMPLETED.md Session 117): all 235
      candidates resolved — 211 curated (178 skill + 33 trait, same `skill`/`trait`-split shape as
      `TARGET_COUNT_OVERRIDES`, same default-5 convention) + 24 documented exclusions (mixed
      self/party-on-one-source shapes, "rides on a different effect's own reach" traits, and a few
      genuinely ambiguous descriptions — full list in the table's own doc comment in `sources.ts`).
      The ~11-distinct-trait estimate for the trait-gated cluster turned out to collapse further to 8
      once resolved from local `requires_trait` grouping instead of wiki lookups (which also
      resolved 27 of the 30 UNRESOLVED COLLISION entries for free — see COMPLETED.md for the full
      method).

      **Wired into the UI 2026-08-08** (see COMPLETED.md Session 119), closing this item out:
      `NamedFactSource`/`computeNamedFactSources` gained a `targetCount` field/optional
      `targetCountTables` param (parallel to `resolveTargetCount`/`TARGET_COUNT_OVERRIDES`), a
      `Cleanse` matcher was added to `BOON_STRIP_CORRUPT_MATCHERS`, and the row is relabeled "Strips /
      Corrupts / Cleanses" in the build editor and both squad-editor views (per-slot and party-wide).
      Not verified visually in the running app (Electron sandbox limitation) — otherwise done.

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
         does weapon/utility skills. Same "API gives nothing to render" shape as the Otherworldly Bond
         bug above, not a wiring bug — would need hand-curated content.
      Also flagging: relics can grant dodge-triggered effects too (e.g. Relic of Rivers, "alacrity
      and regeneration at the end of your dodge roll") with only flavor text — same empty-facts
      problem again. User's proposed UI treatment once data exists: a small visual indicator above the
      skill bar (not a real skill slot) with its own custom tooltip for whatever a build's dodge
      grants beyond the normal evade frames.

- [ ] Elementalist Glyph tooltips should swap to show only the currently-selected attunement's
      version, the same "swap not stack" treatment Druid Glyphs already get for Celestial Avatar
      (`glyph-forms.ts`) — flagged by the user 2026-08-07. Partially handled today, just not the way
      requested: `multi-effect.ts`'s `relatedVariantSkills` currently lists *all 4* attunement
      variants stacked in the tooltip as a documentation list, rather than swapping to the one
      matching `Build.activeAttunement` (already tracked, already player-toggleable via the F1-F4
      mechanic bar). Should be a close structural parallel to `glyph-forms.ts`'s
      `glyphFormFactSourceSkill`/`glyphFormDisplayIcon`, keyed on `activeAttunement` instead of
      `celestialAvatarActive`, rather than a new concept.

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

## Wiki-sourced data pipeline (infrastructure)

- [ ] Extend the existing script-based wiki-extraction pattern (`fetch-relic-effects.ts`,
      `fetch-wvw-splits.ts`, `fetch-elite-spec-skills.ts`, `fetch-glyph-forms.ts`,
      `fetch-gear-upgrades.ts` — all: category-narrow candidates, fetch raw wikitext, regex-parse its
      `{{skill fact|...}}`-style templates, cross-validate against local API data where one exists,
      skip+log anything ambiguous rather than guess) to the fact types that have instead been
      curated via token-heavy conversational sweeps so far: `CURATED_HEALING_COEFFICIENTS`/
      `CURATED_DAMAGE_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`, the target-count self-vs-party
      sweep, and the new Condition Cleanse self-vs-party need above. Scoped 2026-08-07, out of a
      discussion prompted by the Otherworldly Bond/incomplete-API-facts bug above and the user's
      concern about full-sweep token cost (a direct conversational sweep the way Healing/Damage were
      done "devours tokens" and isn't sustainable as a recurring pattern).

      Evidence this is worth doing: this file's own "remaining exceptions" lists for the
      Healing/Damage sweeps are almost entirely phrased as "no `coefficient=` param on wiki" / "wiki
      `coefficient=` value disagrees with API" — a structured wikitext template field, the same shape
      `fetch-wvw-splits.ts` already parses mechanically for a different field (`game mode=`). Most of
      both all-9-profession sweeps was very likely reading that one template field by eye when it
      could have been scripted; the genuinely judgment-requiring residual (conflicting values, stub
      pages, missing params) is the comparatively short exception list already in this file.

      Proposed approach:
      1. **DONE 2026-08-07** (see COMPLETED.md Session 110): piloted on one fact type,
         `scripts/fetch-skill-coefficients.ts` (`npm run fetch-skill-coefficients`), on the
         `fetch-wvw-splits.ts` skeleton as proposed. Diffed its live-wiki-derived output against all
         1052 entries in the hand-curated `CURATED_DAMAGE_COEFFICIENTS` (888 skills): 912 MATCH / 63
         MISMATCH / 54 MISSING / 23 SKIP / 0 NOT FOUND. Approach validated — spot-checking a sample of
         the MISMATCH/MISSING rows found real explanations in 3 known shapes, not parser bugs: (a)
         genuine wiki value drift since the sweep curated it (real balance-patch changes — this is
         exactly the staleness detection the pipeline is for), (b) the table's own `requiresTrait`
         duplicate-factText cases (two curated rows sharing one factText, e.g. skill 13075 Crippling
         Shot base 1.75 vs Deadly-Aim-gated 1.925) which this pilot doesn't yet disambiguate — flagged
         as a known gap, not fixed here, (c) wiki name collisions/disambiguation pages (e.g. "Maul" is
         a disambig page; "Uppercut"'s wiki-derived value silently matched the *other* skill the
         original curator's own comment had explicitly warned about, id 14487) — the same exception
         category `fetch-relic-effects.ts` already handles for relics, not yet built for skills.
         **Step 2a DONE 2026-08-08** (see COMPLETED.md Session 111): built name-collision resolution
         (every fetched page cross-checked against its own `| id = N` field; a mismatch or
         `{{disambig}}` page triggers a MediaWiki search-API fallback that verifies each candidate
         title's `id=` before accepting it — generalizes past any single fixed suffix, unlike relics'
         hand-maintained list) and `requiresTrait` disambiguation (trait-gated entries validated as
         `sibling base * (1 + trait's own Damage-Increase%)`, read from the trait's own data, only
         where that shape is unambiguous — otherwise an honest separately-bucketed skip). Re-run:
         MATCH 935 (wiki) + 30 (requiresTrait) = 965, MISMATCH 3 (wiki) + 0 (requiresTrait), MISSING
         15, SKIP 23 (ambiguous wiki) + 21 (requiresTrait shape doesn't fit), UNRESOLVED COLLISION 22
         skills (50 skills' pages needed and got the search-API fallback along the way).
         **Step "investigate the 3 mismatches" DONE 2026-08-08** (see COMPLETED.md Session 112): all
         3 curated values were already correct — every one traced to the same shape (the specific
         wiki page this id fetches under-documents a split/multiplier a related source, a sibling
         id's page or the page's own Notes prose, documents completely) — added a `KNOWN_WIKI_GAPS`
         table so they don't re-surface as false MISMATCHes.
         **Step "investigate MISSING/SKIP/UNRESOLVED" DONE 2026-08-08** (see COMPLETED.md Session
         113): comma-separated `id=` list parsing, case/whitespace-normalized factText matching, and
         a last-resort sibling-id-attribution tier (using `CURATED_DAMAGE_COEFFICIENTS`'s own
         already-verified equality, NOT the API's PvE-only `dmg_multiplier` — an earlier attempt at
         the latter produced 2 live false positives, caught and fixed before landing). Final re-run:
         MATCH 950 (wiki) + 30 (requiresTrait) + 4 (known wiki gap) = 984/1052, **MISMATCH 0**,
         MISSING 12 (was 15), SKIP 43 (was 44), UNRESOLVED COLLISION 11 (was 22). Remaining residual
         in all 3 buckets individually spot-checked and characterized as genuinely irreducible without
         either free-text wiki prose parsing or a fundamentally different signal — recommended as the
         documented judgment tail, not chased further this session. Still not done: output written to
         `data/game-data/` (still console-only).
      2. **DONE 2026-08-08** (see COMPLETED.md Session 114): built `scripts/lib/wiki-cache.ts`, a
         shared on-disk raw-wikitext cache (`.cache/wiki-pages.json`, gitignored) keyed by exact
         title + MediaWiki's own revision id, fetched together in one `action=query`
         (`prop=revisions`, `rvprop=ids|content`) call rather than the old two-call
         `action=raw`-for-content shape. Wired into `fetch-skill-coefficients.ts` (its own
         `fetchRawWikitext` + manual `sleep` removed in favor of `fetchWikiPage`/`flushWikiCache`).
         Re-run against a fresh empty cache reproduced the exact prior numbers (MATCH 984/1052,
         MISMATCH 0, MISSING 12, SKIP 43, UNRESOLVED COLLISION 11) in 5m41s (1148 pages, all real
         fetches); a second immediate re-run — same 984/0/12/43/11 — dropped to 33s, entirely cache
         hits. **Remaining fetch-*.ts scripts migrated 2026-08-08** (see COMPLETED.md Session 118):
         `fetch-wvw-splits.ts`, `fetch-relic-effects.ts`, `fetch-glyph-forms.ts`,
         `fetch-tome-chapters.ts`, `fetch-skill-duplicate-resolutions.ts`, and
         `fetch-soulbeast-beastmode.ts` — every remaining script with its own inline
         `fetchRawWikitext` — all swapped to `fetchWikiPage`/`flushWikiCache`, each script's own
         non-wiki-cache API calls (category-member listings, MediaWiki search) left untouched. Every
         migrated script's output verified against its own pre-migration behavior (either byte-
         identical regenerated output, or — for `fetch-wvw-splits.ts`/`fetch-relic-effects.ts`/
         `fetch-skill-duplicate-resolutions.ts` — a live re-run surfacing genuine pre-existing
         staleness in the *committed data files* themselves, confirmed unrelated to this migration
         by running the untouched pre-migration script standalone and reproducing the identical
         result). `fetch-elite-spec-skills.ts` and `fetch-gear-upgrades.ts` were named here
         previously but turned out not to need this migration at all: the former never fetches raw
         wikitext (category-member queries only), the latter is pure GW2-API, no wiki calls.
         **Genuine data drift found along the way, not migration bugs**: `wvw-fact-overrides.json`
         lost skill 5862 (Elixir U)'s `Vigor: 6` override — the live wiki now documents wvw=4 for its
         Quickness/Stability/Vigor lines (a real balance change since this table was last generated;
         the locally-cached API duration is still 6/7, so `data/game-data/skills.json` itself needs a
         `fetch-game-data` refresh before this can re-resolve — not done here, out of scope for a
         migration pass). `relic-effects.json` (204 -> 122 ids) and `skill-variant-exclusions.json`
         (63 -> 9 excluded ids) both turned out to have been stale for a while independent of this
         session — `relics.json` has held only 122 entries since a much older commit (6db4ef7), and
         `skill-variants.ts`'s own in-code dedup signals have grown to already resolve most of the
         groups the exclusions file used to cover — neither script had been re-run since. The
         `revisionId` each cache entry stores still isn't consulted by anything yet — that's step 4
         below (Game_updates diffing), not built.
      3. Extend the same skeleton to the still-open gap types: target-count/Condition-Cleanse
         self-vs-party wording (not started), and a "does this page even carry the template we need"
         check for the empty-API-facts problem. **Empty-API-facts half DONE 2026-08-08** (see
         COMPLETED.md Session 115 and this file's own "empty-API-facts" bug entry above): built
         `scripts/scan-empty-effect-facts.ts` — rather than a hand-maintained exception list (the
         relics-style approach originally proposed here), it's a live per-candidate presence check
         (does the wiki page's own `{{skill fact}}` templates include a label beyond
         Range/Recharge/Distance/Radius) that sorts every local red-flag candidate into "wiki has more
         than the API" (actionable, 43 ids) vs. "wiki agrees with the API" (confirmed non-issue, 26)
         vs. unresolved (4) — a live classifier, not a static exception list, since the two buckets
         will shift as the API/wiki both change over time. **Target-count half of this bullet DONE
         2026-08-08** (see COMPLETED.md Session 116): built `scripts/fetch-target-counts.ts`,
         diffing `TARGET_COUNT_OVERRIDES` (now exported from `sources.ts`) against live wiki
         wikitext across all 379 curated entries (326 skill + 53 trait) — **MISMATCH 0, AMBIGUOUS 0,
         MATCH 114, OFF-BY-ONE 1** (the known Phalanx Strength "N other targets" convention),
         **MISSING 255** (no wiki evidence either way, relying on the sweep's documented default-5/
         self assumption), UNRESOLVED COLLISION 9. Fully corroborates the 2026-08-06/07 sweep
         wherever the wiki has evidence to check it against — no data file written, validation only.
         **Condition Cleanse half DONE 2026-08-08** (this bullet's other named gap type): built
         `scripts/fetch-condition-cleanse.ts` as a first-draft classifier (proposes a classification
         rather than diffing an existing table, a different shape than this bullet's other two legs —
         see this file's own Condition Cleanse item below for the live-run numbers), then curated
         `CONDITION_CLEANSE_TARGETS` from its output (see COMPLETED.md Sessions 117/119) and wired it
         into the Strip/Corrupt row — that item is now fully closed out, not just data-only.
      4. Wire it to the not-yet-built "Curation-side change detection" mechanism in the Automatic
         game-data refresh item above (Game_updates page diffing) — once that exists, re-running
         these fetch scripts only needs to touch pages it flags as changed, not a periodic full
         re-sweep. This is the actual "update only via the wiki's patch notes" end state the user
         asked about 2026-08-07.

      Known hard limit: some skills' real effects (Otherworldly Bond above) live in wiki prose, not
      any structured template at all — no regex script fixes that; those stay a small hand-curated
      exception list, same shape as relics' existing 7 name-collision cases. The goal is shrinking
      the agent-judgment tail, not eliminating it. Also note: this is all still local flat-file data
      generation (scripts writing into `data/game-data/*.json`, same architecture already in place)
      — not standing up a hosted service/API of our own, no ops burden, same as gw2skills' actual
      infra would imply.

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

- [x] Curation sweep: resolve every skill/trait whose only target-count signal is the ambiguous
      `"Number of Targets"` fact (no `"Number of Allied Targets"`), so
      `BoonConditionSource.targetCount` (`src/shared/boon-calc/sources.ts`) can show a badge for them
      instead of `null`/nothing. Confirmed via a full scan of `data/game-data/skills.json` that this
      fact is genuinely ambiguous, not just theoretically: some skills mean "self-only boon + N
      enemies hit separately" (Grinding Stones: Stability to self, damage to 3 foes; also Convergence,
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
      stragglers (Invoke Torment, Lesser Chilblains) — done 2026-08-06 (Session 102). Seventh leg —
      Ranger (37 skills + 6 traits, no exclusions needed) — done 2026-08-07 (Session 103). Eighth
      leg — Mesmer (22 skills + 12 traits, no exclusions needed; also fixed a scan-script bug that
      had been silently including already-curated ids, which flipped the smallest-remaining-leg pick
      from Guardian to Mesmer) — done 2026-08-07 (Session 104). Ninth leg — Guardian (45 skills + 3
      traits; 1 more, Holy Reckoning, turned out to be a genuine per-buff-line self/party-wide split —
      see the next bullet — and was deliberately left out) — done 2026-08-07 (Session 105). Tenth and
      final leg — Elementalist (51 skills + 5 traits; 2 more, Overload Earth and Hare's Agility,
      turned out to be genuine per-buff-line self/party-wide splits — see the next bullet — and were
      deliberately left out) — done 2026-08-07 (Session 106), closing out this sweep entirely. This
      leg also caught and fixed a stale claim elsewhere in this codebase: an earlier session's doc
      comment on `BoonConditionSource.targetCount` misidentified Heat Wave as a self-only-Vigor
      example, but a fresh wiki fetch showed it's actually party-wide (reused-Number-fact shape) —
      corrected in both that comment and this bullet.
      Stationary-sources spot-check done 2026-08-07 (Session 107): cross-referenced every skill tagged
      with the API's own `Turret`/`SpiritWeapon`/`Well`/`Spirit`/`Banner` categories (not name-matching,
      which missed Sea Swell as a false positive and would've missed anything not literally named
      "Well"/"Spirit") against the curated table. Banners turned out to be a non-issue — they all carry
      their own direct "Number of Allied Targets" fact, so `resolveTargetCount` already handles them
      without an override. Wells/Spirits were already fully covered by the profession legs above. One
      genuine gap found: Engineer's Blast Gyro (31248, miscategorized "Well" but actually a
      delayed-explosion gadget) — now curated self-only.
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
