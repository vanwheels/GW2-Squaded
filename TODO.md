# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Scoped features, not yet built

- [ ] Capacitor port for iOS/Android — scoped 2026-08-01, two-part seam: (1)
      `StorageAdapter`/`Repository<T>` (`src/shared/storage/storage-interface.ts`) is already
      backend-agnostic — needs a new implementation (e.g. `@capacitor-community/sqlite`) replacing
      `sqlite-storage.ts`; (2) the renderer never calls that interface directly — it goes through the
      Electron-only preload bridge (`window.gw2Storage`, wired in `src/preload/index.ts` +
      `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent — needs a platform-neutral
      seam or a Capacitor-side shim. Also: native HTML5 drag-and-drop in the squad editor has no
      touch-input fallback yet.

## Coefficient curation — remaining exceptions

`CURATED_HEALING_COEFFICIENTS` and `CURATED_DAMAGE_COEFFICIENTS` are complete sweeps across all 9
professions and all 4 skill slots; `CURATED_SIPHON_DAMAGE_COEFFICIENTS` is a complete sweep of its
14-candidate scope (see COMPLETED.md for the full sweep history). What's left below is specific
skills/traits that were investigated and deliberately left uncurated — don't re-guess a coefficient
for these without a fresh look at the source conflict.

**Healing — Utility (2):**
- Guardian 31295 (Sanctuary, underwater variant): a frozen pre-2016-balance-pass copy of id 9128 —
  no wiki coefficient documented for it specifically (underwater is out of scope for WvW anyway).
- Guardian 62669 (Repose): the wiki page itself is tagged stub — coefficient is an unfilled `?`. Note
  for whoever fills this in: a 2025-11-18 balance patch dropped the WvW/PvP base value from 2595 to
  1635 (PvE unaffected) — don't reuse the older 2595 figure from before that patch if it surfaces.

**Healing — Heal-slot (4):** Engineer 63049 (Rectifier Signet's trait-upgraded pulse heal — no wiki
fact template at all); Necromancer 10547 (Summon Blood Fiend — pet's own fixed-0 Healing Power, no
coefficient param on wiki, expected non-scaling); Necromancer 10670 (2nd Well of Blood id — API
values don't match either PvE/WvW reading of the shared wiki page, likely an undocumented
Scourge-context variant); Revenant 26937 (Enchanted Daggers — wiki 1640 vs. API 1560, same +80
offset also shows up on its Siphon Damage facts).

**Healing — Weapon-slot (4):** Elementalist 72982 (Etching: Jökulhlaup, Spear — no `coefficient=`
param on wiki); Necromancer 30860 (Death Spiral — wiki stub, missing siphon coefficients);
Necromancer 69302 (Life Siphon — wiki 450/300 vs. API 537/238, unexplained); Thief 72991 (Shadow
Veil, Spear — two facts share identical factText with only one wiki-documented coefficient; the
table matches by factText alone so curating risks binding to the wrong fact).

**Healing — Thief's Assassin's Reward trait (id 1238):** 17 of 45 candidate skills stayed uncurated
— 14 for the `Array.find`-binds-to-array-order duplicate-fact trap (a genuine PvE/WvW/PvP
initiative-cost split materialized as 2-3 identical-factText facts this table can't disambiguate,
same shape as Shadow Veil), Black Powder (only its PvE/PvP-grouped value is exposed, no sourced
number for its separate WvW cost), and Measured Shot/Repeater(13111) (each bakes an older, pre-patch
initiative cost into its Healing fact — there's no way to know which N the coefficient would use
without live-testing). See `healing-calc.ts`'s Weapon-slot Thief block for the full per-skill
breakdown. Still worth checking other professions for the same "heal on X while this trait is
active" shape someday.

**Damage** — condition-damage skills (coefficient against Condition Damage rather than Power) were
never in scope for the sweep; would need their own wiki-verification pass
(condition-per-stack-per-second base values are a separate documented constant table) before
extending `CURATED_DAMAGE_COEFFICIENTS` to cover one.

**Siphon Damage (10 of 14 candidates):** curated 2026-08-20 (`CURATED_SIPHON_DAMAGE_COEFFICIENTS`,
`siphon-damage-calc.ts`). Left uncurated: 3 wiki/API value mismatches (Locust Swarm, Signet of
Vampirism, Enchanted Daggers) that reconcile exactly under `wikiQuoted = apiRaw + coefficient *
1000` — suspiciously clean but unprecedented in this codebase and contradicted by 3 sibling skills
on the identical wiki template showing zero such offset, so not trustworthy without real in-game
verification (not available in this environment); 2 explicit wiki stub tags (Death Spiral,
Nightmare Weapon) plus Vampiric Slash's own stub stacked on the same mismatch shape; 1 different
formula shape (Soul Grasp, weapon-strength-based, mislabeled by the API the same way Barrier's API
mislabeling problem works); 3 structurally unreachable ids (Grim Specter orphan; Carnivore/
Replenishing Despair are shared-trait "effect skills", same exclusion shape as Assassin's Reward
above). The already-shipped Cosmic Wisdom Assassin-form entry (`baseValue: 1028`) may be an instance
of the same `wikiQuoted = apiRaw + coefficient * 1000` mismatch — flagged for future in-game
verification, not touched.

**Both Healing and Damage tables**: never visually spot-checked in the running app (Electron sandbox
limitation) — do that before extending either further.

- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for. Superseded by the
      fuller "Outgoing/Incoming Healing Effectiveness %" scoping below (2026-08-21) — don't patch
      this one skill in isolation, it's now part of that larger scoped item.

## Healing/Damage effectiveness % + data-completeness audit (scoped 2026-08-21, not started)

User-initiated research thread, not yet begun — explicitly paused before any curation/coding so the
research itself could be as thorough as possible first. All 5 items below come out of that session.

- [ ] **Outgoing Healing % / Incoming Healing %** — mirrors the existing `outgoingDamagePercent`
      pattern (`derived-stats.ts`): a standalone `StatsPanel` row, NOT folded into per-skill
      Healing-table numbers (same reasoning `outgoingDamagePercent` already established — it isn't
      threaded through the Damage table either). Wiki-confirmed 2026-08-21 via the `Healing` wiki
      page's own Notes section (raw wikitext, not paraphrased): "Outgoing healing modifiers stack
      additively." Also found: Regeneration-specific modifiers (e.g. Relic of Dwayna) stack
      additively among themselves, then MULTIPLY with general outgoing-healing modifiers — relevant
      if a Regen-boosting source is ever curated.

  Candidates found via a full multi-file scan (traits.json facts+traitedFacts+description text,
  sigils.json/runes.json descriptions, relic-effects.json facts+nested `params.desc`/`alt`,
  food.json/utility.json bonuses) — discovered, NOT yet individually wiki-verified:
  - **Outgoing (to allies/others)**: Righteous Rebel (Renegade, 4%, via Kalla's Fervor); Invoking
    Harmony (Salvation, 10/15/20% across 3 tiers — **missing its own Duration fact entirely**,
    believed ~10s, needs a wiki check); Serene Rejuvenation (Salvation, 15/20%, labeled generically
    "Effectiveness Increased" in its own fact — the word "healing" only appears in the trait's prose
    description, not the fact); Absolute Resolve / Life from Death / Dance of Death (Necromancer,
    25/10/100% — self-vs-others unconfirmed); Force of Will (Necromancer, scales per 100 Vitality);
    Stalwart Focus (10/15%, also separately carries an Incoming-Healing fact on the same trait);
    Relic of the Monk (1%/stack to max 10 = 10% — the real value is hidden inside a nested
    `params.desc` string, not the top-level label, which just reads `"effect"`); Superior Sigil of
    Transference (flat 10%); Superior Sigil of Benevolence (a *stacking* sigil, 0.5%/kill to max 25
    stacks = 12.5%); ~25 WvW "Mint"-family food items sharing one flat 10% value (e.g. Bowl of Fruit
    Salad with Mint Garnish); Bowl of Tapioca Pudding (10%) / Canned Rice Ball with "Lucky" Filling
    (8%); Bountiful Maintenance Oil (Station) family (0.6%/100 Healing Power + 0.8%/100
    Concentration — likely reuses the existing attribute-conversion resolver,
    `applyConversions`/`activeConsumableConversions`, rather than needing new infra); Relic of
    Castora (conditional on target health threshold); Relic of the Defender (5% flat + a murky
    block-based min/max mechanic); Relic of Zakiros (7%, ambiguous label).
  - **Incoming (to self)**: Health Insurance, Vital Persistence (2 tiers), Stalwart Focus.
  - **Confirmed false positives, exclude**: every rune's flat "+X Healing" is the Healing Power
    attribute, already modeled elsewhere, not an effectiveness modifier; most "Gain X equal to N% of
    Healing Power" utility items convert INTO Healing Power/Concentration, unrelated mechanic;
    several relics (Flock, Vampirism, Nayos, Karakosa, Sorrow, Biomancer, Nautical Beast) are
    ordinary heal-on-proc coefficients, same shape as `CURATED_HEALING_COEFFICIENTS`, not
    effectiveness modifiers; Relic of the Demon Queen's "Healing Reduction" is an enemy debuff, not
    a self-modifier; Relic of Nourys converts damage into healing (a different mechanic); Bloodstone
    Pot Pie is a joke-food *penalty* ("healing effectiveness is halved").

- [ ] **Outgoing Damage % full pass** — larger scope than the healing side. Sigils currently
      contribute ZERO damage-% anywhere in the app (no `CURATED_SIGIL_DAMAGE_BONUSES` table exists).
      Found 2026-08-21:
  - **Sigils**: Superior Sigil of Force (flat +5%, wiki-confirmed "Does not stack if used on both
    main hand and off hand weapons," "Does not affect Condition Damage and Life stealing" — needs
    its own non-doubling rule, distinct from the already-known active-weapon-set-only rule, see
    `sigil_bonuses_active_weapon_set_only` memory) is the only WvW-relevant unconditional one; ~20
    "Slaying" sigils are PvE-monster-type only (no such monsters exist in WvW); Superior Sigil of
    the Night (3%/10% day-night conditional) needs a design decision on a combat-state toggle.
  - **Relics**: only 1 of 15 "Damage Increase"-tagged relics is curated so far (Fireworks,
    `CURATED_RELIC_DAMAGE_BONUSES`) — the other 14 all carry conditions (health thresholds, combo
    procs, stack counts, class-specific) needing individual wiki verification.
  - **Traits**: ~148 raw fact-label matches on flat-sounding text across all 9 professions, before
    dedup across tiers/traited-variants and before excluding ones whose real condition hides in the
    description rather than the fact text — comparable in size to the biggest coefficient sweeps
    already completed (Healing/Damage).

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

**Shape 1 — opaque/generic fact labels on skills/traits (21 hits):** all but 1 are a `Percent` fact
literally labeled "Effectiveness Increased" with no other field naming what it affects — the same
shape Serene Rejuvenation (already scoped above) turned out to be. Skill: Stone Resonance (44926).
Traits: Perfect Inscriptions (579), Banshee's Wail (799), Soul Comprehension (839), Gluttony (887),
Aquamancer's Training (1676, 2 tiers), Serene Rejuvenation (1814, 4 entries — already scoped),
Hardy Conduit (1948), Soothing Power (2028), Elemental Pursuit (2165), Amplified Siphoning (2288),
Bolstered Bonds (2331), Double Helix (2334, 2 tiers), Bird of Prey (2363), Spirit's Strength (2421,
2 tiers). Each needs its own prose-description read (same as Serene Rejuvenation's own trait
`description` field) to find what the percent actually modifies before it can be curated anywhere.

**Shape 1 — opaque/generic labels on relic/tome-chapter facts (42 hits):** overwhelmingly relic
`"label": "effect"` facts (the wiki template's own generic first-parameter convention for relics —
confirmed structurally universal, not a per-relic authoring gap) plus 2 `"Effectiveness Increased"`
relics (100115, 102245) matching the skill/trait shape above. Full id list: relics 100031, 100063,
100115 (x2), 100194, 100219, 100345, 100368, 100435, 100453, 100527, 100694, 100752, 100775, 100849,
100916, 100924, 100947, 101191, 101943, 102245, 102595, 103424, 103574, 103872, 103984 (x2), 104424,
104501, 104800 (x2), 104849, 104928, 106355, 106916, 107030, 107061, 109351, 109664; tome chapters
"Epilogue: Eternal Oasis", "Epilogue: Unbroken Lines", "Epilogue: Ashes of the Just". Most of these
already have their real content in `params.desc`/`values` (see Shape 2 below) — the generic label
alone isn't itself the actionable signal here, just the marker that led to Shape 2's check.

**Shape 2 — numeric content hidden in `params.desc`/`alt`, not surfaced anywhere in `label`/`values`
(14 hits, all relic/tome-chapter):** concrete percent/flat values. **Correction after checking
`relic-effects-format.ts`'s `formatFactLine`:** this is NOT a tooltip-display gap — a `label ===
'effect'` fact already resolves to `params.desc` at display time (`const detail = fact.params.desc
?? label`), so every relic/tome-chapter hit below already shows its real text in-app. The actual
open gap is the one already scoped above ("Outgoing Damage % full pass" / "Outgoing Healing %"):
none of these values are wired into any calculator (aggregate stats, damage %, healing %) — this
list is just useful raw material for whoever curates those, not a newly-discovered display bug.
Relic of the Monk (100031, "+1% Healing Increase to Others" — the original healing-effectiveness
research seed);
Relic of the Herald (100219, "25 Concentration"); Relic of the Scourge (100368, "+1½% Condition
Duration"); **Relic of the Firebrand (100453, "+20% Boon Duration")**; Relic of the Aristocracy
(100849, "+3% Condition Duration"); Nourys's Hunger (101191, a 6-stat combo line: "+15% Damage, +15%
Condition Damage, -10% Incoming Damage, -10% Incoming Condition Damage, +10% Healing from Outgoing
Boon and Condition Damage, +10% from Outgoing Attack Damage"); relic 103984 (2 lines: Frost Aura
"-10% Incoming Damage", Light Aura "-10% Incoming Condition Damage"); Relic of Thorns (104424, "50
Condition Damage"); Soul of the Titan (104928, "+15% All Stats"); relic 106355 ("+10% Critical
Chance"); relic 107030 ("+100% Incoming Fumble Unrestricted Percent" — likely a parse artifact of
the wiki's own text, needs a raw-wikitext look); **tome chapter "Epilogue: Eternal Oasis" ("+20%
Heal Effectiveness")** — directly relevant to the Outgoing/Incoming Healing % item above; "Epilogue:
Unbroken Lines" ("200 Toughness").

**Shape 3 — Buff/PrefixedBuff fact with a named status but no duration anywhere in its own facts
array (87 hits: 61 skills, 26 traits, after excluding non-player-equippable NPC/monster skill ids —
see the script's own `professions.length > 0` filter):** dominated by one recognizable pattern — a
condition (Immobile/Crippled/Chilled/Blinded/Burning/Bleeding/Poisoned/Torment/Confusion) applied via
"Apply Buff/Condition" with genuinely no `duration` field in the raw API data at all (spot-checked
live: Lightning Reflexes/12494's "Immobile" fact sits right next to a "Vigor" fact that DOES carry
`duration: 10` — confirming this isn't a script bug, the API data itself omits it for that one fact).
Full id/name list not reproduced here — regenerate via `npm run audit-data-completeness` (deterministic
against the current data files, same list every run until the next `fetch-game-data`). Worth grouping
by "which condition, which skill archetype" before wiki-verifying individually — several ids are
already visibly the same root cause repeated: "Wings of Resolve" (4 ids — 30083/30225/30286/30783,
all Guardian/Willbender Profession_2, same duplicate-copy shape the skill-picker duplicate-id audit
already deals with elsewhere) and "A.E.D." (2 ids — 21659/30881, both Engineer Heal) each show their
missing-duration Immobile/condition-cluster fact on every copy, so a wiki fix for the shared root
skill likely resolves all copies at once rather than needing N independent lookups.

- [x] **Recharge/cooldown WvW-override sweep** — DONE 2026-08-22, see COMPLETED.md. Built
      `scripts/fetch-recharge-wvw-overrides.ts` (`npm run fetch-recharge-wvw-overrides`),
      generalizing `RelicEffect.rechargeSeconds`'s "prefer `recharge wvw=`" rule to skills/traits;
      wired into both display (skill/trait tooltips) and calculation (Relic of the
      Zephyrite/Citadel's elite-skill-recharge-derived durations). 149 skills + 4 traits curated;
      211 ambiguous skill names and 86 validation-mismatch/missing-page names left uncurated (see
      `docs/game-data.md`'s new section for the full breakdown) — re-run after a future balance
      patch, same as `fetch-wvw-splits`.

- [ ] **Resource-cost modeling (energy/initiative/upkeep/health-cost) — down the road, deliberately
      not scoped yet.** The app doesn't track Revenant energy cost, Thief initiative cost,
      Revenant upkeep-skill drain, or health-cost skills anywhere today, so none of these are wrong
      per se — they're just entirely absent. User wants these modeled eventually. If/when that
      work starts, remember the wiki infobox template also carries PvE/PvP/WvW-specific variants for
      all 4 (same shape as `recharge wvw=` above) — confirmed real usage via wiki `insource:` search
      2026-08-21: `energy_wvw` (37 hits, Revenant), `upkeep_wvw` (7, Revenant), `initiative_wvw` (7,
      Thief), `health_cost_wvw` (6). (`activation_wvw`/cast-time has zero real wiki usage — confirmed
      not a real category, no need to check it again.) Build the WvW-override read at the same time
      as the base cost modeling, not bolted on after, so this doesn't become a 6th "solved for one
      data source, never generalized" gap.

## Nice-to-haves

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
