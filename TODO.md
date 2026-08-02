# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Next up

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
- [ ] Stretch goal, not currently planned: a per-skill "Damage" tooltip breakdown mirroring the
      Healing breakdown idea below — hovering a DPS stat would list each weapon/utility skill on the
      bar with its computed damage at current Power/Precision/Ferocity/condition stats.
- [ ] "Healing" row in `BoonConditionSummaryPanel`'s Miscellaneous section — deliberately deferred
      to the "Healing and Damage numbers" pass below (per user direction 2026-08-01), not attempted
      as part of the Control/Auras/Miscellaneous/Strip&Corrupt/Combo work (see COMPLETED.md): unlike
      Stealth/Superspeed/Evade/Breaks Stun/Barrier, "does this build grant Healing" has no single
      clean fact shape — `AttributeAdjust` facts carry 100+ distinct free-text labels for it ("Healing",
      "Ally Healing", "Heal per Condition Removed", ...), AND it's nearly always-true for every build
      (everyone has a heal skill) so a naive presence check wouldn't be a useful signal — needs the
      same real magnitude computation the "Healing"/"Damage" tooltip stretch goals below are already
      about, not another boolean icon.
- [ ] Stretch goal, not currently planned: a per-skill "Healing" tooltip breakdown (hovering the
      Healing stat lists each heal skill on the bar with its computed heal amount at current Healing
      Power).
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

### Gear Optimizer (net new feature)
Correction to the 2026-08-01 feedback note: the GW2 stat formulas are **not** missing research —
`src/shared/gear-calc/attribute-totals.ts` already implements itemstat-combo → attribute-point math
(`attribute_adjustment * multiplier + value`, per-slot budgets in `ATTRIBUTE_ADJUSTMENT`) and
`derived-stats.ts` converts points → derived percentages. This is a **search/optimization**
problem over already-known math, not a formula-research problem.
- **Inputs**: profession (`ProfessionId`) + a set of stat floors (e.g. `BoonDuration >= 900pts`,
  i.e. 60%) chosen from the 9 core attributes in `ALL_CORE_ATTRIBUTE_KEYS`
  (`attribute-totals.ts`). Decided 2026-08-01: once floors are satisfiable, maximize one
  user-chosen secondary stat with the remaining gear budget (not "fewest stat combos" or "first
  valid combo").
- **Search space**: per-slot choice of `ItemStat.id` (from `data/game-data/itemstats.json`, 178
  combos total) across the 12 armor/trinket slots + 2-4 weapon slots (`EquipmentSlotKey`), plus
  which rune (6-armor-piece rune bonuses via `addRuneBonuses`) and which relic/sigils contribute
  flat/percent bonuses. Full combinatorial space is large per-slot-independent but each slot's
  contribution is linear and independent given the adjustment constants, so this reduces to a
  bounded integer/linear-programming-style search (or greedy allocation + backtracking), not
  brute-force over every combination — needs a small `gear-optimize.ts` module in
  `src/shared/gear-calc/` alongside the existing calc code.
- **Open decision, not yet resolved**: whether to search the full 178-combo `itemstats.json` list
  or a curated "actually obtainable in current GW2" subset (~20-30 real meta combos — Berserker's/
  Viper's/Diviner's/Minstrel's/etc.). The raw dataset has no "is this obtainable/current" flag, so
  the full-dataset option risks suggesting legacy/unobtainable stat combos (e.g. old PvP-only
  combos). Recommend curating a short allowlist before building the search, but this needs a
  confirmation pass (spot-check a handful of combos against the current in-game vendor/crafting
  list) rather than guessing which of the 178 are current.
- **Output**: a full `EquipmentSlot` map (itemStatId per slot, at minimum) the user can review and
  apply to a build — likely a new "Gear Optimizer" nav view (`NavBar.tsx`/`App.tsx` gain a
  `ViewKey`) with a "copy to build" action rather than editing a `Build` in place, so the user can
  compare a couple of candidate outputs before committing.
- **Out of scope for a first pass** (revisit if requested): factoring in rune/sigil/relic choice
  into the search itself (treat those as fixed inputs the user already picked, only optimize the
  9 itemstat slots), and food/utility consumable stat contributions.

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
