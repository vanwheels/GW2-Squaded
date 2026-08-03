# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Next up

- [ ] Sigils aren't factored into the Stats panel yet (user report, 2026-08-01). Confirmed the
      `Sigil` type (`src/shared/types/game-data.ts`) has no structural `bonuses` field at all —
      unlike Rune/Consumable, it's free-text `description` only — so `computeGearAttributeTotals`
      has nothing to read for a sigil's stat contribution. The only sigil effect modeled anywhere
      is the 8 on-kill stacking sigils' flat-per-stack bonus, hand-curated in `combat-state.ts`'s
      `STACKING_SIGILS` table and applied via the `CombatState` stepper — that's a proc/combat-state
      mechanic, not a structural stat grant, so it doesn't cover sigils in general. Needs scoping:
      do any sigils grant an *unconditional* flat stat (rare — most are on-crit/on-swap/on-kill
      procs, which arguably belong in the same "not modeled, out of scope" bucket as other procs),
      or is this report specifically about the stacking sigils' current stack count not visibly
      moving the Stats panel numbers (a wiring bug, not a missing-data problem)? Check
      `StatsPanel.tsx`/`derived-stats.ts` for whether `combatStatePoints` (which is where
      `STACKING_SIGILS` contributions actually land) is even included in the panel's displayed
      totals before assuming new data modeling is needed.
- [ ] Food and utility aren't factored into the Stats panel yet (user report, 2026-08-01). This is
      surprising given the code: `EquipmentEditor.tsx` already has a build-level Food/Utility picker
      wired to `build.foodId`/`build.utilityId`, `computeGearAttributeTotals`
      (`attribute-totals.ts`) already reads both ids and applies their `Consumable.bonuses` via
      `addBonus`, and `data/game-data/food.json`/`utility.json` do carry populated `bonuses` arrays
      (spot-checked live, not empty). So the underlying math path looks wired correctly — next
      session should reproduce live (pick a food/utility with a clear flat bonus, e.g. a
      Healing-Power food, and watch the Stats panel) before assuming missing modeling; likely
      candidates if it really doesn't move: a stale-state bug where `StatsPanel` reads a different
      `build` reference than the Equipment editor's in-progress draft (not committed until saved?),
      or a bonus-attribute-name mismatch between `addBonus`'s expected keys and what
      food/utility's `bonuses[].attribute` actually contains for the specific items tested.
- [ ] Gear Optimizer should also let rune and infusion choice be search variables (not just gear
      stat-prefix + optional food/utility, which is all it searches today) — noted 2026-08-01, scope
      to runes + infusions only for now, leave sigils out (sigils are procs, not a stat lever the
      optimizer's floor/maximize model fits — see the sigils item above). Currently
      `gear-optimize.ts`'s `optimizeGear` treats the build's equipped runes/infusions as **fixed**
      baseline contributions (see its "Baseline" comment — `computeGearAttributeTotals(fixedBuild,
      ...)` folds them in before the search ever runs) exactly like it treats food/utility when
      `optimizeFoodUtility` is off. Making runes/infusions searchable means: (1) new `OptimizerSlot`
      entries for rune choice (per equipped rune count/tier — WvW rune sets are usually 6x one
      rune, so likely a single "rune set" slot analogous to how weapon pairs collapse to one slot,
      not 6 independent slots) and each infusion slot already present on gear
      (`armorTrinketInfusionCapacity`/`weaponUpgradeCapacity` from `upgrade-slots.ts` already know
      capacity per slot); (2) `statOptionsFor`'s dedup-by-relevant-metric-delta pattern should
      extend cleanly to runes (`Rune.bonuses`, tiered 1pc/2pc/.../6pc like the existing rune bonus
      parsing in `attribute-totals.ts`) and infusions (`Infusion.attribute`/`.value`, already a
      single flat point). Needs a UI decision too: `GearOptimizerPanel.tsx` currently has one
      "optimize food/utility" checkbox — likely wants a parallel "optimize runes/infusions" toggle
      rather than always searching them, consistent with the existing opt-in pattern.
- [ ] Healing tooltip breakdown done 2026-08-02; Damage tooltip breakdown also done 2026-08-02
      (`src/shared/skill-calc/damage-calc.ts`, `CombatState.targetArmorClass` +
      `TARGET_ARMOR_VALUES` in `combat-state.ts`). Both briefly lived as their own aggregated row on
      `BoonConditionSummaryPanel` (Sessions 54-55) but moved into each skill's own tooltip instead
      per user feedback — a per-skill number read in place was easier to follow than a separate
      summary icon (Session 56, `SkillsEditor.tsx`'s `skillTooltipContent` now calls
      `skill-fact-lines.ts`'s `skillFactLines` instead of the generic `numericFactLines` for skills;
      traits are unchanged, still generic-only). See COMPLETED.md Sessions 54-56 for the full
      curation writeup. `CURATED_DAMAGE_COEFFICIENTS` is still seeded incrementally (1 skill per base
      profession, not a bulk pass) — extend as specific builds get tested, same policy as the
      trait-attribute table.  `CURATED_HEALING_COEFFICIENTS` (`healing-calc.ts`) was instead taken to
      a full category sweep 2026-08-02 — see the item below for the writeup and what's still
      uncurated in it. Neither table has been visually spot-checked in the running app yet (Electron
      sandbox limitation) — do that before extending `CURATED_DAMAGE_COEFFICIENTS` further, and
      before starting the tooltip-visual-pass item below. Condition-skill damage (coefficient against
      Condition Damage rather than Power) was not scoped as part of this work — the curated skills
      above are all direct-hit Power damage; a condition-damage skill would need its own
      wiki-verification pass (condition-per-stack-per-second base values are a separate,
      well-documented wiki constant table, not skill-specific coefficients) before extending
      `CURATED_DAMAGE_COEFFICIENTS` to cover one.
- [ ] Mesmer Troubadour's Heal skill, "Tale of the Second Scion" (id 76695), shows no Healing numbers
      at all in this app (user screenshot comparison, 2026-08-02) — confirmed root cause: the GW2 API
      returns only 3 facts for this skill (`Recharge`, `Number of Targets`, `Radius`) with **zero**
      `AttributeAdjust`/Healing facts, unlike every other Heal-slot skill checked this session. The
      in-game tooltip and gw2skills.net both show real "Self-Healing"/"Ally Healing" numbers plus a
      "Scion's Reprieve" buff (+15% Heal Effectiveness) that the API doesn't expose either. This
      isn't a missing `CURATED_HEALING_COEFFICIENTS` entry — `healingLinesForSkill` only ever renders
      a number when a matching real API fact exists to gate it (deliberate, see that function's doc
      comment), and there's no fact here to match against at all. Fixing this needs a new mechanism
      that doesn't require a backing API fact (e.g. a wiki-only synthetic-fact table, injected the
      way `wvw-fact-overrides.json` patches values but for facts that don't exist yet) — scoped as
      its own follow-up rather than folded into the Heal-skill sweep above, since it's an
      architecture change, not a data-curation one. Likely worth checking whether other very recent
      (Janthir Wilds-era) skills have the same API gap before building a one-off fix just for this
      skill.
- [ ] Healing-coefficient curation strategy changed 2026-08-02: user explicitly rejected build-by-
      build curation ("the spirit of theorycrafting is scouting all classes for unique optimizations,
      not just through builds") in favor of a full category sweep across all professions before
      moving to the next category. `CURATED_HEALING_COEFFICIENTS` (`healing-calc.ts`) is now a
      complete pass over every equippable Heal-slot skill with a qualifying `AttributeAdjust`/
      `target: 'Healing'` fact (85 candidates found via a full `skills.json` scan; parallel research
      agents per profession fetched each skill's raw wikitext directly via curl — never through
      WebFetch's summarizing model, which caused a real wrong-number error earlier this session, see
      `healing_damage_coefficient_curation` memory). Utility-slot skills were swept the same way
      2026-08-02 (40 candidates found via the same scan approach, but 17 were the API mislabeling a
      Barrier fact as Healing — see the new Barrier item below; of the 23 genuine Healing candidates,
      20 landed in the table, 3 stayed uncurated, see below). Elite-slot skills were swept 2026-08-02
      too (only 12 candidates — 1 was the same Barrier trap, excluded; of 11 genuine candidates, 10
      landed in the table, 1 stayed uncurated, see below). **Weapon-slot skills swept 2026-08-02,
      the last category in the agreed plan** — of 648 distinct weapon-skill ids across every
      profession's weapons (including the newer Janthir Wilds Spear), 110 carried a Healing-type
      fact; 17 were the Barrier trap (excluded) and a newly-found third trap surfaced too: 38
      candidates (nearly every initiative-costing Thief skill) turned out to be one shared trait,
      Assassin's Reward (id 1238, "heal per initiative spent"), duplicated onto each skill's own
      facts via `requires_trait` — a trait-bonus formula, not a per-skill design, so none of those
      38 are curated either (see the dedicated item below). Necromancer's Chillblains (id 10605) is
      a one-off instance of the same shape (only healing fact requires trait 778, Transfusion) and
      is excluded the same way. Of the remaining 55 genuine candidates, 49 landed in the table
      (`healing-calc.ts`'s new "Weapon-slot skills" section), 6 stayed uncurated — see below.
      `CURATED_HEALING_COEFFICIENTS` is now a complete pass over Heal + Utility + Elite + Weapon
      slots across every profession.
      1 Elite skill was investigated but left uncurated:
      - **Revenant 29114 (Energy Expulsion, Legendary Centaur Stance flip-skill)**: a fresh live
        `/v2/skills/29114` API pull (not just this app's cached `skills.json`) still returns a
        completely different fact set — a "Healing Fragment"/"Number of Fragments"/"Knockback"
        mechanic — than the wiki's current page describes (a single knockdown+heal, no fragments at
        all). A genuine, unresolved API/wiki mechanic mismatch, not a stale local cache — left
        uncurated rather than guessing which source to trust.
      3 Utility skills were investigated but left uncurated, same reasoning bar as the Heal-skill
      gaps below — don't just re-guess a coefficient:
      - **Guardian 31295 (Sanctuary, underwater/self-cast variant)**: shares its name with id 9128 but
        is a distinct, frozen-in-a-pre-2016-balance-pass copy (no `GroundTargeted` flag, half the
        radius) — the wiki's "Sanctuary" page only documents 9128's formula, no coefficient exists
        anywhere for 31295. Underwater is out of scope for WvW anyway (see the underwater-toggle
        nice-to-have below), so likely not worth chasing further.
      - **Guardian 62669 (Repose)**: the wiki page is literally tagged `{{stub|skill|heal coeff}}` —
        base values are documented (PvE 2595 vs WvW/PvP 1635) but the coefficient itself is an
        unfilled `?` placeholder on the wiki, not something this app can derive.
      - **Revenant 29082 (Natural Harmony, Ventari facet)**: wiki lists base value 1124, but a fresh
        `/v2/skills/29082` API pull independently confirmed this app's own known base value (1620) is
        current and correct — a real, reconfirmed wiki/API disagreement, not a stale read.
      A handful of Heal skills were investigated but left uncurated — each needs a fresh look before
      being added, don't just re-guess a coefficient:
      - **Elementalist 44239 (Aquatic Stance)**: wiki's current skill-fact template (base 6400)
        matches neither this app's own API base value (6480) nor the wiki's own most recent
        version-history text (which also says 6480) — looks like a stale/unedited wiki template.
      - **Engineer 63049 (Rectifier Signet)**: the Mech Core: J-Drive trait-upgraded pulse heal
        (`requires_trait` 2298) has no wiki skill-fact template at all, only incomplete prose in the
        Notes section that doesn't even cover all 3 game modes.
      - **Engineer 76738 (Mitotic State)**: this app's own API base value (305) doesn't reconcile with
        either wiki-listed value (7625 PvE/WvW, 5500 PvP) — 7625/305 = 25 exactly, suggesting 305 may
        be a per-tick amount from a 25-tick heal-over-time while the wiki fact is the pre-summed
        total, but no interval/tick-count fact confirms this on the wiki page.
      - **Necromancer 10547 (Summon Blood Fiend)**: the pet's heal scales off the pet's own fixed
        (permanently-0) Healing Power stat, not the player's — the wiki fact has no `coefficient=`
        param at all, consistent with this being a genuinely non-scaling number for this app's
        formula.
      - **Necromancer 10670 (2nd Well of Blood id)**: shares Well of Blood's wiki page/values with id
        10527 (already curated), but this app's own API base values for 10670 (5240/280) don't match
        either the PvE or WvW reading of that shared page — likely a Scourge-context variant the wiki
        doesn't separately document.
      - **Revenant 26937 (Enchanted Daggers)**: the "Initial Heal" fact has a wiki base value (1640)
        that doesn't match this app's own API base value (1560) — a real +80 wiki/API discrepancy
        (the same offset also shows up on this skill's Siphon Damage facts), so unclear which source
        is stale.
      5 Weapon-slot skills were investigated but left uncurated, same reasoning bar as above:
      - **Elementalist 72982 (Etching: Jökulhlaup, Spear)**: wiki's own `{{skill fact|healing|532}}`
        template has no `coefficient=` parameter at all.
      - **Necromancer 30860 (Death Spiral)**: wiki page is explicitly tagged
        `{{stub||missing siphon coefficients}}` — neither Life Siphon Healing fact has a documented
        coefficient.
      - **Necromancer 69302 (Life Siphon)**: wiki base values (450 PvE / 300 WvW+PvP) don't match
        this app's API values (537 / 238) under either mode ordering — a genuine, unexplained
        conflict.
      - **Ranger 31889 (Astral Wisp, post-2026-07-15 rework)**: wiki's rewritten page gives one base
        value (1288) across all modes with only the coefficient split, but the API shows two
        duplicate-text facts both valued 322 (~1288/4) — a pulse-count relationship neither source
        documents post-rework. Left uncurated rather than guessing the pairing.
      - **Thief 72991 (Shadow Veil, Spear)**: two facts share the identical factText "Healing" (2570
        and 1290) and the wiki only documents a coefficient for one of them (1290) — since this
        table matches facts by factText alone, curating it risks binding the coefficient to whichever
        fact `Array.find` happens to return first. Left entirely uncurated.
- [ ] Barrier is an entirely unmodeled resource bar, surfaced clearly by the Utility-skill sweep
      2026-08-02: of 40 Utility-slot skills the GW2 API tags with a Healing-type `AttributeAdjust`
      fact, 17 turned out to actually be Barrier facts (the API mislabels Barrier's `target` as
      "Healing" too, not just genuine heals) — e.g. Barrier Signet, Banner of Defense, "Brace
      Yourselves!", Bulwark Gyro, Utility Goggles, Serpent Siphon, Imminent Threat, and more. The
      Elite-skill sweep (also 2026-08-02) hit the same trap once more: Warrior's "We Will Never
      Yield!" (id 76562) tags its "Minimum Barrier"/"Maximum Barrier" facts as Healing too — same
      exclusion applied, not curated. Barrier
      scales off Healing Power with the exact same `base + coefficient * HealingPower` shape as a real
      heal (confirmed on several of these skills' wiki pages), but this app has no Barrier-amount UI
      or formula anywhere — `CURATED_HEALING_COEFFICIENTS`/`healingLinesForSkill` only ever renders
      real Health-restoring heals, and Barrier facts are deliberately excluded from it (same call
      already made for Necromancer's Sand Flare in the original Heal-slot sweep). Given how common
      this turned out to be in the Utility category specifically (nearly half the candidates), a
      genuine `CURATED_BARRIER_COEFFICIENTS`/`barrierLinesForSkill` pair (mirroring
      `healing-calc.ts`'s shape) displayed as its own tooltip line — not folded into the Healing
      number, since Barrier and Health are different bars — is probably worth scoping as its own
      category sweep at some point, now that the Heal/Utility/Elite/Weapon Healing-coefficient sweep
      itself is complete (see the item above).
- [ ] Trait-bonus healing formulas smeared across many skills' own facts, surfaced by the weapon-skill
      sweep 2026-08-02: Thief's Assassin's Reward trait (id 1238, Deadly Arts, "heal yourself for
      each point of initiative spent") shows up as a `requires_trait`-gated Healing fact on ~38
      different weapon skills (nearly every initiative-costing one), and Necromancer's Transfusion
      trait (id 778) does the same to Chillblains (id 10605). Neither is curated in
      `CURATED_HEALING_COEFFICIENTS` — a shared trait formula duplicated per-skill by the API isn't a
      per-skill design, same reasoning already used to leave Signet of Courage's Perfect
      Inscriptions-boosted variant unreflected. If this app ever wants to show these, the right shape
      is a small generic trait-bonus table (like `FURY_CRIT_CHANCE_TRAIT_BONUSES`) — one entry per
      trait with its own wiki-verified per-point coefficient, applied to whichever skill's
      requires_trait-gated fact matches, rather than 38+ near-duplicate per-skill entries. Worth
      checking whether other professions have an equivalent "heal on X while this trait is active"
      trait before scoping — Assassin's Reward/Transfusion may not be the only two.
- [ ] Follow-up to the tooltip-overhaul items above, noted 2026-08-02, updated 2026-08-02: trait
      and food/utility tooltips now carry real structured content (traits: `numericFactLines` lines
      appended below the description via `factsBlock`, same as skills; food/utility:
      `formatConsumableDescription` in `format-description.ts` builds `bonuses[].raw` lines + a
      `Duration:` line from `durationMs`/`applyCount`, falling back to raw `description` only for
      buff-less consumables like Feast reagents — `effectName` deliberately left unused, it's just
      the buff category label ("Nourishment"/"Enhancement") and added no useful info next to the
      bonus lines already shown). The Healing/Damage tooltip breakdown item above has now landed
      (2026-08-02, both halves) — this visual pass is unblocked. Do a dedicated visual pass over
      **every** tooltip in the app — traits, skills, gear stat prefixes, runes, sigils, relics,
      food/utility, infusions — so they read like a single coherent design instead of whatever shape
      each one organically grew into while the content work landed. Target look: in-game GW2
      tooltip / gw2skills.net conventions (rarity-colored item name header, icon next to title, a
      divider between name and effect text, stat lines as a tidy list rather than a wrapped
      paragraph, muted/secondary color for flavor text vs. bright color for real numeric bonuses).
      Starting point already exists — `Tooltip.tsx`'s `TooltipBody` plus `global.css`'s
      `.tooltip-*` rules (`.tooltip-title`, `.tooltip-description`, `.tooltip-numeric-facts`,
      `.tooltip-boon-facts`, `.tooltip-skill-variant`) already give skills a semi-structured layout
      — extend that shared vocabulary to the newly-enriched tooltip types rather than inventing new
      one-off styling per content type.
- [ ] Curate more trait attribute bonuses (`trait-attributes.ts`, added 2026-08-02). Traits can
      grant a flat attribute bonus or an attribute-to-attribute % conversion — found via a user
      cross-check against gw2skills.net (Revenant/Salvation's "Life Attunement" was silently
      missing from our totals). Only that one trait is curated so far (verified: +120 Healing
      Power, 7% Healing→Concentration). A `traits.json` scan found **~190 more candidates**
      (168 traits with an `AttributeAdjust` fact, 25 with `BuffConversion`) but **the fact type
      alone doesn't mean "you passively gain this"** — confirmed live that "Healer's Gift" (also
      Revenant/Salvation) has an unambiguous single-value `AttributeAdjust` fact that's actually
      the base-heal coefficient for its own dodge-roll proc, not a stat grant at all. Each
      candidate needs its trait *description* read for genuine unconditional "gain X" language
      (not a skill/proc/conditional effect) before being added, same wiki-verification rigor as
      every other curated table in this codebase (`CURATED_RELIC_DAMAGE_BONUSES`,
      `FURY_CRIT_CHANCE_TRAIT_BONUSES`) — add entries incrementally as specific builds get tested,
      not as a bulk pass. A concrete second example surfaced 2026-08-02: Vindicator's "Empire
      Divided" (Power +240 / Healing Power +240) is **conditional** on being above/below a 50%
      health threshold, not unconditional like Life Attunement — that's a different shape than
      `CURATED_FLAT_BONUSES` handles (which assumes "always active once the trait is active") and
      would need its own `CombatState`-style toggle (like `furyActive`) before it could be modeled
      safely; don't force it into the unconditional table. Note: the *dominant* Stats-panel
      discrepancy the user was chasing across Sessions 49-51 turned out to be a separate, bigger
      bug (see COMPLETED.md Session 51, `itemStatId` category mismatch) — trait bonuses are a real
      but comparatively small remaining gap now.
- [ ] Discord bot (client of the backend API) — scoped 2026-08-01: the worker
      (`worker/src/index.ts`) is currently just an anonymous KV blob store with 2 endpoints —
      `POST /shares` (create) and `GET /shares/:id` (fetch by random id). There is **no** user-
      account concept and **no** "list a user's builds/squads" endpoint, so a bot can only do
      "given a share link/id, post an embed of that build/squad" today — it cannot browse or
      manage anyone's saved library. Real scoping blocked on: what should the bot actually do
      (post-a-share-as-embed only, vs. a fuller command set that would need new
      auth+listing endpoints on the worker, a bigger lift than the bot itself)? Needs a follow-up
      conversation on desired bot commands before this can be sized.
- [ ] Capacitor port for iOS/Android — scoped 2026-08-01: the seam is real but two-part, not just
      "swap storage adapter." (1) `StorageAdapter`/`Repository<T>` (`src/shared/storage/
      storage-interface.ts`) is already backend-agnostic — a Capacitor build needs a new
      implementation (e.g. `@capacitor-community/sqlite` or Preferences) satisfying the same
      interface, replacing `sqlite-storage.ts`. (2) The renderer never calls that interface
      directly — it goes through the Electron-only preload bridge (`window.gw2Storage`, wired in
      `src/preload/index.ts` + `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent;
      a Capacitor build would call its storage plugin directly from the renderer instead of over
      IPC, so `window.gw2Storage`'s call sites need a platform-neutral seam (or a Capacitor-side
      shim that mimics the same shape) rather than assuming Electron IPC always exists.
  - Native HTML5 drag-and-drop (squad editor) has no touch-input equivalent yet — needs a touch
    fallback if/when this lands.
- [ ] Automatic game-data refresh mechanism (balance patches) — manual refresh only for now.
      Decided 2026-07-31: check for updates on app launch, prompt the user to refresh (not a silent
      scheduled background refresh) — user stays in control of when the fetch runs. Scoped
      2026-08-01, mechanism still undecided (needs a follow-up decision before implementing):
      `data/game-data/meta.json` currently only records `fetchedAt`, not a GW2 API build/version
      number, so "is there a new patch" isn't even detectable yet under either option below.
      - **Option A — live re-scrape in-app**: bundle the existing fetch/scrape pipeline
        (`scripts/fetch-*.ts`, currently dev-only Node/tsx scripts hitting the GW2 API + wiki) into
        the packaged app so it can re-pull data on demand. Bigger lift: those scripts assume a dev
        Node environment and write straight to `data/game-data/*.json` in the repo, not a
        packaged app's writable user-data directory, and wiki-scraping from a shipped consumer app
        is fragile (layout changes break it with no one watching).
      - **Option B — piggyback on the auto-updater**: "new data available" just means "new app
        version available" — reuse the Settings-tab update flow already shipped
        (`src/main/updater/auto-updater.ts`). Data only changes via a new release; no in-app
        scraping. Simpler, but means a data-only fix still requires a full version bump/release.
      - Detecting a patch either way likely means fetching GW2 API's `/v2/build` endpoint (a single
        integer) on launch and comparing to a stored last-known value — that part is small and
        needed regardless of which option is chosen.
- [ ] Stretch, deferred 2026-08-01: frame a build's "last updated" (now shown plainly as a relative
      timestamp on its card, see COMPLETED.md) relative to GW2 balance patches instead — e.g. "not
      reviewed since the last patch" — rather than just "3 days ago". Blocked on the same
      patch-build-number detection the item above needs (`/v2/build` polling + a stored
      last-known-build value don't exist yet); revisit once that mechanism is decided rather than
      building a second, parallel patch-tracking path here.

## Stats panel / boon-condition bar polish

- [ ] Boon tab / Squad tab: distinguish self-only vs. party-wide (up to 5) boon sources. Confirmed
      2026-08-01 the raw GW2 API data (already ingested into `data/game-data/skills.json`) carries
      this signal: a skill's `facts` array includes a `type: "Number"` fact with
      `text: "Number of Targets"` or `"Number of Allied Targets"` (`value` usually 5) alongside its
      `Buff` facts when the skill hits allies; purely self-targeted buffs (e.g. Signet of Fury/
      Signet of Might's passive/active) carry no such fact. `Fact` (`src/shared/types/game-data.ts`)
      already round-trips this via its index signature, but `extractFromFacts`
      (`src/shared/boon-calc/sources.ts`) currently ignores `Number` facts entirely — would need a
      `targetCount: number | null` (null = self only) added to `BoonConditionSource`, read from the
      first `Number` fact whose `text` contains "Target" among a skill's facts. Known caveats before
      building this: (1) the facts array is flat, so a skill with a self-only buff AND a separate
      ally-only buff in the same list (rare, not yet found a concrete example) can't be bound
      per-buff-line without a positional heuristic; (2) no WvW-style override table exists yet for
      target count the way `wvwFactOverrides` exists for duration, so any trait/WvW-driven target-
      count change would need the same manual wiki-verification pass docs/game-data.md describes for
      durations; (3) stationary sources (banners/wells/spirits) haven't been spot-checked for the
      same fact shape.
- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Skill picker follow-ups

- [ ] 4 duplicate-named Heal/Utility/Elite skill groups still show duplicate entries in the picker
      with no resolving signal found yet: Engineer "Throw Mine" (Gadgeteer-trait-gated — would need
      the picker to know the build's chosen traits, an architecture change), Elementalist "Mist
      Form", Revenant "Protective Solace", Revenant "Jade Winds" (wiki lists all ids together with no
      distinguishing field).
- [ ] Known limitation, documented in code (`weapon-calc/weapon-skills.ts`): Weaver's "Dual Attack"
      weapon-skill-3 replacements (e.g. 3 different Fire-tagged ids sharing `specializationId: 56`)
      can't be disambiguated — which one is live depends on Weaver's second active attunement, a
      combat-state axis this app's static loadout model has no equivalent for. Falls back to the
      first candidate deterministically.
- [ ] Ranger Profession_4 "Eternal Bond" F-skill stays unresolved — no per-pet data exists for it
      (unlike Soulbeast's F1-F3, which resolve from `soulbeast-beastmode.json`).
- [ ] Unconfirmed edge case: whether any skill has a distinctly different effect specifically on its
      last charge before recharging (vs. every charge being identical) — no concrete example found
      to verify against; revisit if one surfaces.

## Skill bar UI/UX feedback pass (2026-07-31)

Large feedback pass from a full skill-bar walkthrough (screenshots per profession/general). Nothing
below has been implemented yet — captured here for a future session to pick up. Two UX questions
were resolved while triaging this list (see the affected items): multi-option F-icon toggles
(Firebrand's 3 Tomes) switch directly to whichever icon is clicked rather than cycling in sequence,
and the Ranger pet-swap/Untamed-swap text buttons get replaced by the cycle icon rather than gaining
it alongside.

### Engineer
- [ ] Edge case, explicitly deferred: Engineer's weapon-skill kit-swap is tied to `Skills`
      (Heal/Utility/Elite choices), not to profession specialization, so the Firebrand-style F-icon
      click-toggle pattern doesn't map cleanly onto it. Keep the current text-toggle row for kits
      as-is for now; revisit later.

### Elementalist
- [ ] Weaver's weapon-skill-3 "Dual Attack" ambiguity — already tracked in "Skill picker follow-ups"
      above and in `weapon-calc/weapon-skills.ts`; flagged again here as still open, no new action.

### Mesmer
- [ ] Troubadour's "Tales" skills and Mirage's "Mirror" skills fall into the generic "Other" category
      bucket in the skill picker (`groupSkillsByCategory` in `SkillsEditor.tsx`, driven by
      `skill.categories[0]`) instead of their own "Tales"/"Mirror" headers — and this leaks into other
      Mesmer specs' pickers too, not just Troubadour/Mirage's. Needs investigation into why the
      category grouping isn't picking up the right `categories[0]` for these, and why it's
      cross-contaminating unrelated specs.

### Necromancer
- [ ] "Necrotic Traversal" (2nd half of Summon Flesh Wurm's flip-skill chain) is filed under "Other"
      in the skill picker category grouping — should be associated with/grouped near Summon Flesh
      Wurm instead.

## Feature feedback pass (2026-08-01) — scoped 2026-08-01

Feedback list from the user; scoped below with concrete implementation approach and open decisions.
Nothing here is implemented yet.

## Nice-to-haves

- [ ] "Favorites" pin for frequently-used builds in the squad editor's build sidebar; the
      build-picker option's description only shows the profession name today, not a fuller
      spec/gear summary. Partially addressed 2026-08-01 by manual drag-to-reorder on the Builds
      view (`BuildsView.tsx`, `Build.order` — the sidebar now follows that same order), but that's
      a full custom ordering the user arranges by hand, not a lightweight "pin to top" independent
      of it — still a distinct nice-to-have if wanted.
- [ ] "Favorites" marker for food/utility consumables, to pin preferred choices to the top of the
      selection list (currently the full unfiltered catalog, by design).
- [ ] Settings toggle for underwater weapons/skills, defaulted **off**. Noted 2026-07-31 (UI polish
      session): underwater isn't frequently used in WvW and normally shouldn't factor into
      boon/condition output. When off, the Underwater weapon-set editor and its skill bar should
      stay hidden, and `sources.ts`'s boon/condition calculator should skip underwater skill ids
      the same way it would if nothing were equipped there.
- [ ] More curated fury-crit-chance traits in `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
      (added 2026-08-01 for the Gear Optimizer's Critical Chance metric, seeded with only
      Revenant's Roiling Mists). A `traits.json` scan found 6 more profession traits with the same
      "extra crit chance while under Fury" shape — Engineer's Hematic Focus, Warrior's Furious
      Burst, Ranger's Vicious Quarry, Mesmer's Quiet Intensity, Revenant/Renegade's Brutal
      Momentum — each needs its current WvW-mode value confirmed against the wiki (same as Roiling
      Mists) before being added.
