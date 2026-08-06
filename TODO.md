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

- [ ] Racial skills should be toggleable (show/hide) in the skill pickers, eventually a Settings
      option — noted 2026-08-04. This app has **no race concept modeled at all** (no `race` field
      anywhere in `src/shared/types`, no race data under `data/game-data/`) — new scope, not a tweak
      to existing filtering. Likely full set, found via a Mesmer Elite-slot scan
      (`specializationId: null` + a `professions` array spanning most/all professions): Artillery
      Barrage, Summon 7-Series/D-Series Golem, Summon Power Suit, Charrzooka, Warband Support (Charr);
      Hounds of Balthazar, Reaper of Grenth, Avatar/Remove Avatar of Melandru (Human); Become/Release
      Bear, Wolf, Snow Leopard, Raven (Norn); Summon Druid Spirit, Summon Sylvan Hound, Take Root
      (Sylvari); Mistfire Wolf (Asura?) — worth a full `skills.json` scan to confirm the complete set
      against the wiki's own Racial skill category before implementing. Needs scoping first: (1)
      where the toggle lives (no Settings panel exists yet); (2) default state (show or hide); (3)
      whether the Gear Optimizer needs to respect the same toggle, not just the picker UI.

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

- [ ] 144 Food catalog entries still have no buff data after `borrowSharedContainerBonuses`
      (`fetch-gear-upgrades.ts`, added 2026-08-06 — see docs/game-data.md's Food/Utility section).
      Two different reasons, worth separating before curating further: (1) a distinct "Ascended
      Gourmet Feast" tier (End of Dragons cuisine — Cilantro Lime Sous-Vide Steak and similar) IS a
      real stat-granting shareable item, confirmed via the wiki (e.g. "+100 Power +70 Ferocity +10%
      Karma +5% All Experience Gained +20% Magic Find +20% Gold Find +10% WXP Gained"), but has no
      separate individually-eaten sibling to borrow a match from at all — needs hand-curation
      (~30-40 items, each wiki-verified) rather than another naming heuristic; (2) genuinely
      buff-less items that don't belong being offered as a "Food" pick at all — Mastery-point
      currency ("Elixir/Draught of X Mastery"), crafting materials ("Gift of Quartz"/"Pile of
      Golden Sand"), and achievement/collection rewards ("Threat Report: ...") — these came back in
      the picker when the (wrong) blanket exclusion was reverted 2026-08-06; whether to filter them
      back out by a narrower, verified rule (not the blanket `effectName === null` check that
      wrongly caught Feasts too) is an open question, not decided either way yet.

## Stats panel / boon-condition bar polish

- [ ] Boon tab / Squad tab: distinguish self-only vs. party-wide (up to 5) boon sources. Confirmed
      2026-08-01 the raw API data (already in `data/game-data/skills.json`) carries this signal: a
      skill's `facts` array includes a `type: "Number"` fact with `text: "Number of Targets"` or
      `"Number of Allied Targets"` alongside its `Buff` facts when it hits allies; purely self-targeted
      buffs (e.g. Signet of Fury/Might's passive) carry no such fact. `Fact`
      (`src/shared/types/game-data.ts`) already round-trips this via its index signature, but
      `extractFromFacts` (`src/shared/boon-calc/sources.ts`) currently ignores `Number` facts
      entirely — would need a `targetCount: number | null` added to `BoonConditionSource`. Known
      caveats: (1) a skill with both a self-only and an ally-only buff in the same flat facts array
      can't be bound per-buff-line without a positional heuristic (no concrete example found yet);
      (2) no WvW-override table exists for target count the way `wvwFactOverrides` exists for
      duration; (3) stationary sources (banners/wells/spirits) haven't been spot-checked for the same
      fact shape.
- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Skill picker follow-ups

- [ ] 4 duplicate-named Heal/Utility/Elite skill groups still show duplicate entries with no
      resolving signal found yet: Engineer "Throw Mine" (Gadgeteer-trait-gated — would need the
      picker to know the build's chosen traits, an architecture change), Elementalist "Mist Form",
      Revenant "Protective Solace", Revenant "Jade Winds" (wiki lists all ids together with no
      distinguishing field).
- [ ] **Vindicator's 3 Legendary Alliance Stance utility skills (Nomad's Advance, Scavenger Burst,
      Reaver's Rage) each carry a same-spec non-`GroundTargeted` duplicate id whose relationship to
      the kept id isn't understood yet** — found by the skill-picker duplicate-id audit
      (2026-08-04, COMPLETED.md Session 62). Narrowed 2026-08-04: the canonical `legends.json` ids
      and their real Aspect-of-Saint-Viktor `flipSkill` targets are fully mapped
      (`vindicator-aspect.ts`) — `62962` Scavenger Burst -> `62941` Tree Song, `62832` Nomad's
      Advance -> `62702` Battle Dance, `62878` Reaver's Rage -> `62796` Awakening, none involving
      `62841`/`62793`. So the "legend swap mid-cast" framing this bullet used to carry was wrong —
      that's the (now-implemented) Aspect toggle, fully accounted for above. What's unexplained is
      only the leftover plain non-ground orphans (`62841` Scavenger Burst / `62793` Tree Song
      specifically — Nomad's Advance/Reaver's Rage not yet checked for a same-shape orphan) that
      aren't referenced by `legends.json` and carry no `flipSkill` link to anything. Needs a
      dedicated look at whether they're genuine stale pre-rework duplicates or something else — don't
      wiki-id=-exclude them like the rest of the audit did, that heuristic already false-positived on
      this exact family once (COMPLETED.md Session 62).
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
below has been implemented yet.

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

## Nice-to-haves

- [ ] "Favorites" pin for frequently-used builds in the squad editor's build sidebar; the
      build-picker option's description only shows the profession name today, not a fuller
      spec/gear summary. Partially addressed 2026-08-01 by manual drag-to-reorder on the Builds
      view (`BuildsView.tsx`, `Build.order` — the sidebar follows that order), but that's a full
      custom ordering the user arranges by hand, not a lightweight "pin to top" independent of it —
      still a distinct nice-to-have if wanted.
- [ ] "Favorites" marker for food/utility consumables, to pin preferred choices to the top of the
      selection list (currently the full unfiltered catalog, by design).
- [ ] Settings toggle for underwater weapons/skills, defaulted **off**. Noted 2026-07-31: underwater
      isn't frequently used in WvW and normally shouldn't factor into boon/condition output. When
      off, the Underwater weapon-set editor and its skill bar should stay hidden, and `sources.ts`'s
      boon/condition calculator should skip underwater skill ids the same way it would if nothing
      were equipped there.
- [ ] More curated fury-crit-chance traits in `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
      (seeded 2026-08-01 with only Revenant's Roiling Mists, for the Gear Optimizer's Critical
      Chance metric). A `traits.json` scan found 6 more with the same "extra crit chance while under
      Fury" shape — Engineer's Hematic Focus, Warrior's Furious Burst, Ranger's Vicious Quarry,
      Mesmer's Quiet Intensity, Revenant/Renegade's Brutal Momentum — each needs its current WvW-mode
      value confirmed against the wiki (same as Roiling Mists) before being added.
