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

- [ ] **Duplicate builds/squads from a right-click menu.** `BuildsView.tsx`/`SquadsView.tsx` (the
      main Builds/Squads tab card lists) have no context menu today — only `BuildsSidebar.tsx` (the
      squad editor's build roster) does, via the reusable `ContextMenu` component
      (`common/ContextMenu.tsx`, a portaled `{x, y, items}` menu) with "Preview"/"Edit". Add the same
      `onContextMenu`/`ContextMenu` wiring to both main-page card `<li>`s, with a "Duplicate" item
      that clones the record under a fresh id: `createBuild`/`createSquadComp` already exist
      (`builds-store.tsx`/`squad-comps-store.tsx`) — spread the source record with a new
      `crypto.randomUUID()` id, fresh `createdAt`/`updatedAt`, `order: Date.now()` (same pattern
      `handleImport` in both views already uses), and probably an adjusted name (e.g. append " (Copy)")
      so the duplicate doesn't look identical in the list. A squad's duplicate should NOT duplicate
      its member builds too (same "reference, don't clone" relationship the editor already has) —
      only `SquadCompSharePayload`'s import path clones builds, and that's for a different reason
      (a shared squad's builds aren't in the importer's database yet at all).

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
      (+15% WvW/PvP Heal Effectiveness) that nothing in the app accounts for — not a Healing fact
      itself, it modifies *other* incoming/outgoing heals. App has no general outgoing/incoming
      heal-modifier concept yet (distinct from the boon/condition uptime system); needs scoping, not
      a one-off patch for this skill.

## Trait/skill data-correctness pass (scoped 2026-08-20)

User flagged several concrete tooltip bugs from a quick glance; investigation the same day traced
most of them to one systemic root cause plus 2 standalone gaps. Agreed order: quick wins first
(done), then the AttributeAdjust infra leg (done), then the main sweep; Corruption-stat and
Mesmer-stunbreak stay separate investigations slotted in afterward.

`AttributeAdjust` fact-type WvW-duplicate dedup — **done 2026-08-20**: `numericFactLines`
(`fact-numbers.ts`) now filters `AttributeAdjust` facts through `NUMERIC_FACT_WVW_OVERRIDES` the
same way it already did `Number`/`Percent`. Resolved Battle Scarred's (id 1755) "Life Siphon Damage"
duplicate (wiki-confirmed pve 117 vs. wvw+pvp 58) and Expanded Consciousness's (id 2358) "Healing"
duplicate (389). Battle Scarred's *other* AttributeAdjust fact, "Life Siphon Healing," stays
deliberately uncurated — the live API carries an unexplained 3rd value (68) alongside the 2
wiki-documented ones (117/58) with nothing on the wiki page to say what it is; picking blind between
58/68 risks hiding the correct value instead of the wrong one. Firebrand's Imbued Haste (id 2148,
250/150 Condition Damage/Healing/Vitality dupes) belonged to the main sweep below, not this infra
leg — closed 2026-08-20 as part of that sweep's Guardian leg (needed its own small infra addition,
a `target`-field fallback for `AttributeAdjust` facts with no `text` — see below).

- [ ] **Main sweep: WvW/PvE duplicate-fact values, all 8 non-Revenant professions.** Root cause
      (confirmed 2026-08-20): the raw GW2 API bakes PvE/WvW/PvP fact variants into `facts` as literal
      duplicate entries with no discriminator tag. 2 mechanisms already exist and are proven
      (Revenant's full curation, COMPLETED.md) — `wvw-fact-overrides.json` (+`fetch-wvw-splits.ts`)
      for `Buff`/`PrefixedBuff` boon/condition facts, `NUMERIC_FACT_WVW_OVERRIDES`
      (`fact-numbers.ts`) for `Number`/`Percent`/`AttributeAdjust` facts — leg-granularity is one
      whole profession, not one spec line (user's call 2026-08-20, given the scale: 8 professions ×
      ~9 spec lines each).

      **Guardian — done 2026-08-20** (1st leg). Scanned all 9 spec lines/108 traits for
      Number/Percent/AttributeAdjust/Time labels (or Buff statuses) repeated within one trait's base
      facts; wiki-verified each candidate's raw `{{trait fact}}` split before curating. Found and
      fixed 2 real infra gaps along the way (not profession-specific, so they now apply everywhere):
      `numericFactLines` never matched `Time`-typed facts against `NUMERIC_FACT_WVW_OVERRIDES` at all
      (found via Righteous Instincts/Loremaster/Illuminating Inspiration's "Interval"/"Recharge Time
      Reduced" dupes), and never fell back to `AttributeAdjust`'s `target` field when `text` was
      absent (Firebrand's Imbued Haste, id 2148 — closes out this exact gap called out above).
      23 traits curated total across `NUMERIC_FACT_WVW_OVERRIDES` (Guardian block, `fact-numbers.ts`)
      + 1 in `wvw-fact-overrides.json` (Resolute Subconscious, id 625 — a genuinely-identical
      duplicate needing dedup, not an actual pve/wvw value difference). 2 real gaps found and
      deliberately left uncurated (documented in `fact-numbers.ts`'s own Guardian-leg comment, not
      modeled wrong): Heavy Light's Stability grant (id 1963) splits 6s pve/3s wvw+pvp per the wiki,
      but the live API only ever carries the pve value — same "wiki-documented value missing from
      the API entirely" shape as Vindicator's Song of Arboreum Vigor loose end; Phoenix Protocol (id
      2195) grants 2 independent Alacrity concepts ("on Trigger"/"on Activation") that ALSO swap to
      Resolution entirely in WvW, a multi-concept-collision-plus-boon-swap shape `WvwFactOverride`
      can't express (same as Darkrazor's Daring/Found Purpose's Entity slot).

      **Warrior — done 2026-08-20** (2nd leg). Same process, all 9 spec lines/111 traits scanned.
      26 traits curated into `NUMERIC_FACT_WVW_OVERRIDES` (Warrior block, `fact-numbers.ts`) + 1 into
      `wvw-fact-overrides.json` (Sundering Burst, id 1316 — 2 concepts sharing one Vulnerability
      status but both sharing the identical split, safe to collapse). "Pure Strike" needed its wiki
      title disambiguated to "Pure Strike (trait)" (the bare title is a same-named skill page). 2
      genuinely-identical dupes found needing no override (already collapse via `numericFactLines`'s
      own dedup): Stalwart Strength (1708) and Bloody Roar (1928), both a flat 10%/10% Damage
      Increase with no wiki split at all. Peak Performance's (1444) "Peak Performance" effect Buff
      carries an embedded pve-10%/wvw-7% sub-value via the wiki's `effect bonus number=` param that
      neither this table nor `WvwFactOverride` can express (both only override a flat number/
      duration) — left as a documented gap, not modeled wrong. End-to-end verified via a standalone
      script against the real `numericFactLines` (Electron sandbox still blocks visual verification).

      **Mesmer — done 2026-08-20** (3rd leg). Same process, all 9 spec lines/111 traits scanned.
      20 traits curated into `NUMERIC_FACT_WVW_OVERRIDES` (Mesmer block, `fact-numbers.ts`), closing
      the previously-flagged Troubadour's Shredding (2343) instance. 3 genuinely-identical dupes
      needing no override (already collapse via `numericFactLines`'s own dedup): Compounding Power
      (723, "Maximum Stacks" 5/5), Illusionary Inspiration (1915, "Healing Increase to Others" 5/5),
      and Restorative Illusions (1866, 4 clone-tier Healing facts each identical across all 3 modes
      despite different `coefficient=` values, same shape as Warrior's Vigorous Shouts). Life of the
      Party (Troubadour, id 2367) has a real pve/wvw/pvp Might/Quickness split, but on
      `PrefixedBuff`-typed per-linked-skill (Lively Lute/Crescendo) facts — out of this table's scope,
      same shape as Vindicator's Reaver's Curse/Salvation's Generous Abundance, left for a future
      per-skill-mapping leg. End-to-end verified via a standalone script against the real
      `numericFactLines` (Electron sandbox still blocks visual verification).

      **User-caught follow-up, same day:** this leg's scan only checked `Number`/`Percent`/
      `AttributeAdjust`/`Time` facts — missed Illusionary Defense (675), a `Buff`-type Protection
      duplicate the same leg should have caught. Fixed (COMPLETED.md Session 267): a
      `BUFF_INSTANCE_VALUE_OVERRIDES.trait[675]` entry drops its 2 pvp-only occurrences, plus a
      `synthetic-facts.json` copy onto Cry of Frustration (Mesmer core F2, id 10190) so the boon
      shows on the F2 skill's own tooltip too (missed by the 2026-08-14 trait-granted-boons-on-skills
      sweep, which only scanned named `improves skill=` wiki fields — this trait's generic
      `improves mechanic slot = 2` fell through). **Remaining 5 legs must also scan `Buff`-type
      facts for same-status duplicates**, not just the 4 numeric types — check both
      `wvw-fact-overrides.json`'s existing per-status mechanism and `BUFF_INSTANCE_VALUE_OVERRIDES`
      (for the 2+-concepts-share-one-status shape) as candidates surface.

      Remaining 5 professions (Engineer, Ranger, Thief, Elementalist, Necromancer) still open. Do one
      profession-leg, then check in (see `pacing_large_sweeps` memory).

- [ ] **Corruption stat undercounts real "boon corrupt" sources.** `BOON_STRIP_CORRUPT_MATCHERS.Corrupt`
      only matches `Number`-type facts whose text matches `/boons? converted/i`. Confirmed via
      Necromancer's Well of Corruption (id 39987/43892-ish, "converting boons on foes into
      conditions"): its raw API `facts` array has **no boon-conversion count fact at all** — same
      "API just omits it" shape as past target-count/attribute-bonus sweeps, not a wording mismatch.
      Needs a wiki-sourced manual-override sweep (same shape as `NUMERIC_FACT_WVW_OVERRIDES` or the
      target-count override tables) for skills/traits where boon-corruption is real but unrepresented
      in the API facts, plus a check of whether any source actually uses "corrupted" phrasing the
      current regex would also miss.

- [ ] **Mesmer Shatter 4 (Distortion) shows "Breaks Stun" unconditionally.** Should only be true with
      Mental Defense (Inspiration GM trait, id 2005) equipped. Investigated 2026-08-20: Distortion's
      raw API facts (id 10192) carry no `StunBreak` fact at all, gated or not, and Mental Defense's
      own facts don't add one either (traits can't carry `StunBreak`-typed facts) — couldn't find the
      code path producing the always-on display via the normal matcher/fact pipeline
      (`MISCELLANEOUS_MATCHERS['Breaks Stun']`, `branch-conditional-facts.ts`). Needs a fresh
      investigation pass, not a quick fix — start by confirming live in the running app (or a fresh
      screenshot) exactly which component/string is rendering it.

## Stats panel / boon-condition bar polish

- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

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
