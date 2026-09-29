# Sep 29, 2026 patch — change list

Source: https://wiki.guildwars2.com/wiki/Game_updates/2026-09-29 (fetched 2026-09-29).

This app is WvW-only (see README). The patch is overwhelmingly PvP-only splits — those are listed
here for completeness/audit trail but are **out of scope**. Only WvW-only and "PvP and WvW" rows
need any work.

Legend: **[WvW]** = in scope, WvW-only split. **[Both]** = in scope, applies to PvP and WvW.
**(PvP)** = out of scope, PvP-only.

## General / Relics
- Relic of the Pirate Queen: cooldown 1s -> 5s **(PvP)**
- Relic of Karakosa: healing now triggers at blast finisher location rather than player location —
  no mode qualifier given; treat as **[Both]** (global mechanic change, not a numeric split)

## Elementalist
- Healing Rain: healing power scaling 0.1 -> 0.3 **[WvW]**
- Healing Ripple: healing power scaling 0.5 -> 0.75 **[WvW]**
- Stone Heart: damage reduction 25% -> 15% while specialized in earth **(PvP)**

### Tempest
- Overload Water: pulse healing power scaling 0.1 -> 0.3 **[WvW]**
- Latent Stamina: endurance amount 10 -> 15 **[WvW]**

### Evoker
- Altruistic Aspect: stability/resistance durations 5s -> 3s **(PvP)**
- Toad's Fortitude: cooldown 25s -> 30s **(PvP)**
- Specialized Elements: empowered recharge 20% -> 33% **[WvW]**

## Engineer
- Napalm: power coefficient per hit 0.28 -> 0.24 **(PvP)**
- Chain Reactivity: 3rd-trigger base barrier 1,500 -> 1,000 **(PvP)**
- Elixir C: healing per boon 450 -> 350 **(PvP)**
- Galvanic Bomb: no longer dazes **(PvP)**
- Sapping Device: added 8s internal cooldown per target — no mode qualifier; treat as **[Both]**
- Essence of Animated Sand: barrier healing power scaling 0.5 -> 0.65 **[WvW]**
- Bandage Blast: now prioritizes damaged allies; increased healing to allies below 50% health — no
  mode qualifier; treat as **[Both]**

### Scrapper
- Bulwark Gyro: pulse barrier healing power scaling 0.1 -> 0.25 **[WvW]**

### Amalgam
- Mercurial Tendencies: cooldown reduction 4s -> 2s **(PvP)**
- Solid State: cooldown 25s -> 30s; stability duration 5s -> 3s **(PvP)**
- New Genes: stability duration 4s -> 2s **(PvP)**

## Necromancer

### Reaper
- Blighter's Boon: base healing 133 -> 101 **(PvP)**

### Ritualist
- Weapon of Warding: cooldown 30s -> 35s; protection duration 4s -> 3s **(PvP)**
- Weapon of Remedy: cooldown 25s -> 30s **(PvP)**

## Ranger
- Dash (Juvenile Phoenix): fixed issue causing skill to strike more targets than intended — bug
  fix, no mode qualifier; treat as **[Both]**

### Druid
- Natural Mender: outgoing healing effectiveness increase 15% -> 10% **[WvW]**
- Seed of Life: conditions removed 2 -> 1 **[WvW]**
- Cultivated Synergy: conditions removed by Lesser Seed of Life 2 -> 1 **[WvW]**
- Grace of the Land: might stacks 2 -> 1 **[WvW]**

### Galeshot
- Feel the Rush: swiftness duration 5s -> 3s **(PvP)**
- Soothing Breeze: superspeed duration 4s -> 3s **(PvP)**
- Whirlwind: cooldown 25s -> 30s **(PvP)**

## Revenant

### Vindicator
- Tree Song: energy cost 25 -> 15 **[WvW]**
- Drop Urn of Saint Viktor: healing power scaling 0.22 -> 0.5 **[WvW]**
- Saint's Shield: healing power scaling 0.2 -> 0.3 **[WvW]**
- Reaver's Curse: healing/barrier increase 100% -> 200% **[WvW]**

### Conduit
- Release Potential: Assassin: power coefficient per hit 0.45 -> 0.35 **(PvP)**
- Release Potential: Mesmer: torment duration 6s -> 4s **(PvP)**
- Release Potential: Warrior: damage/barrier increase per affinity 15% -> 10% **(PvP)**
- Enhanced Embodiment: recharge reduction 20% -> 15% **(PvP)**
- Expanded Consciousness: energy gained 10 -> 5 **(PvP)**
- Numinous Gift: fury/might durations 10s -> 6s; resistance/resolution/protection/quickness
  durations 5s -> 3s **(PvP)**

## Warrior
- Call of Valor: cooldown 20s -> 25s **(PvP)**

### Paragon
- Adrenal Health: paragon chants now grant only one stack **[Both]** (PvP and WvW per patch notes)
- Cleansing Ire: paragon chants now cleanse only one condition **[Both]** (PvP and WvW per patch
  notes)

## In-scope summary (16 changes)

**[WvW]** numeric splits: Healing Rain, Healing Ripple, Overload Water, Latent Stamina,
Specialized Elements, Essence of Animated Sand, Bulwark Gyro, Natural Mender, Seed of Life,
Cultivated Synergy, Grace of the Land, Tree Song, Drop Urn of Saint Viktor, Saint's Shield,
Reaver's Curse (15)

**[Both]** changes: Relic of Karakosa, Sapping Device, Bandage Blast, Dash (Juvenile Phoenix),
Adrenal Health, Cleansing Ire (6)

## Scoping addendum — code cross-reference (2026-09-29)

Per-name check of whether each changed value is already curated somewhere in this codebase (raw
API fact that auto-updates on refetch, hand-curated coefficient/table, or not modeled at all).

**Auto** (raw API fact, verify after a plain refetch, no code change expected):
- Seed of Life — conditions removed 2->1 (trait 31406/32242)
- Cultivated Synergy — Lesser Seed of Life conditions removed 2->1 (trait 2057)
- Grace of the Land — might stacks 2->1 (trait 2001) — tentative: existing
  `wvw-fact-overrides.json` override for this trait only pins boon *duration*, not stack count;
  confirm the stack count itself comes through raw post-refetch.

**Manual** (existing hardcoded coefficient, needs a hand edit — see TODO.md Leg 3 for exact
file/line/value):
- Healing Rain (`healing-calc.ts:672`, skill 5551) — 0.1 -> 0.3
- Essence of Animated Sand (`barrier-calc.ts:161`, skill 72052) — 0.5 -> 0.65
- Bulwark Gyro (`barrier-calc.ts:151-153`, skill 30101) — Pulse Barrier 0.1 -> 0.25
- Natural Mender (`fact-numbers.ts:1216-1221`, trait 1992) — 15 -> 10
- Drop Urn of Saint Viktor (`healing-calc.ts:613`, skill 62738) — 0.22 -> 0.5

**Not modeled** (the specific changed stat isn't curated anywhere in this codebase — these are
pre-existing gaps the patch happens to touch, not regressions; scoping decision needed, see TODO.md
Leg 4):
- Relic of Karakosa — trigger-location mechanic, not a tracked number at all
- Healing Ripple (trait 351) — 0.5 coefficient never curated
- Overload Water (skill 29415) — pulse healing 0.1->0.3 never curated (only its unrelated
  party-wide target count is modeled)
- Bandage Blast — no healing coefficient curated for this skill at all
- Tree Song — energy cost isn't modeled anywhere; this app has no skill-resource-cost table at all
  (architecture gap, not a missing number) — **superseded, see Leg 5 section below: this premise
  was stale, the resource-cost table already existed (shipped 2026-08-28), the actual gap was a
  wiki-search category-scoping bug**
- Saint's Shield (skill 62689) — 0.2 healing-power-scaling coefficient never curated (only an
  unrelated boon-duration override exists)

## Relic of Karakosa trigger-location scoping (2026-09-29, Known Exceptions Sweep Leg 2)

Scoped what modeling "healing now triggers at blast finisher location rather than player location"
would actually require, rather than assuming absence means exclusion.

Cross-checked against `docs/relic-trigger-classification.md`, the full prior audit of all 112
relics' triggers: Relic of Karakosa (101268) is already classified `COMBO` bucket — its trigger is
"field+finisher combo," one of the 8 relics that doc's methodology marks unbounded, same reasoning
as the dodge relics. It was never a candidate for `RELIC_TRIGGER_GATES` (the deterministic-trigger
integration mechanism built in that sweep's leg 2) for reasons that predate and are independent of
this patch's location change — a combo-finisher proc has no fixed cadence this app can assume
without inventing one, the same bar every other COMBO-bucket relic fails.

Separately, its heal payload was never curated in `healing-calc.ts` either — that table only holds
skill/trait `Healing` facts (keyed by skill/trait id), not relic facts; relics have no equivalent
table anywhere in the codebase. So there is no existing number or trigger assumption for this patch
change to have broken — nothing regressed, because nothing was modeled.

Modeling the *new* mechanic specifically (heal centered on the blast-finisher's landing spot instead
of the player) would additionally require a spatial/positional model — player position vs. finisher
position vs. each ally's position — which this app has zero infrastructure for anywhere; it's a
static per-build calculator, not a positional combat simulator. Even the *old* mechanic (heal
centered on player, allies within radius) was never modeled, since combo-finisher triggers are
already excluded as unbounded. The location change doesn't introduce a new gap — it changes the
targeting rule of an already-unmodeled, already out-of-scope mechanic.

**Conclusion: permanently excluded, not deferred.** No code change possible or needed — same shape
as Relic of Sorrow/Leadership (`docs/relic-trigger-classification.md` legs 4/6): not a fit for any
existing table's shape, and no new shape would close the gap without building spatial-simulation
infra this app has no other use for. Moved to TODO.md's Known Exceptions section.
- Reaver's Curse (trait 2259) — 100%->200% healing/barrier increase is explicitly flagged in
  `fact-numbers.ts`'s own comment as out of scope for that table, "left for a future
  per-skill-mapping leg" — pre-existing known gap
- Cleansing Ire (trait 1649) — condition-cleanse count never modeled (only self-only targeting
  classification exists)
- Latent Stamina, Specialized Elements, Sapping Device, Adrenal Health — not found anywhere in
  `src/` or `scripts/` at all

## Tree Song energy cost (2026-09-29, Known Exceptions Sweep Leg 5)

This leg's own TODO.md entry (and this doc's line 136 above) claimed "this app has no
skill-resource-cost table at all" — **wrong, stale premise**. A resource-cost table shipped
2026-08-28 (`data/game-data/resource-costs.json`, `scripts/fetch-resource-costs.ts`,
`src/shared/skill-calc/resource-cost-lines.ts`, wired into all 4 skill-tooltip call sites) — the
TODO item's own framing hadn't been checked against current code before being written.

Re-running `fetch-resource-costs.ts` unmodified reproduced the exact same 108-skill output as the
committed file (byte-identical `git diff`) — Tree Song (id 62941) was never a candidate at all, not
merely dropped during parsing. Root cause: the script's energy-search is scoped to
`incategory:"Revenant skills"`, but Vindicator's "Legendary Alliance" (Kurzick/Luxon) utility
skills — Tree Song, Battle Dance, Selfish Spirit, Scavenger Burst, and others — are wiki-categorized
only under `Legendary Alliance skills`/`Vindicator skills`/`Kurzick skills`/`Luxon skills`, **not**
`Revenant skills` (confirmed live: every other legend's skills, e.g. Impossible Odds/Empowering
Misery, carry `Revenant skills` alongside their legend-specific category; Tree Song does not). This
silently excluded the entire Legendary Alliance skill set from the original 2026-08-28 run, not
just Tree Song — a systematic category-scoping bug, not a one-off missing entry.

Fixed by adding a second search, `insource:"energy" incategory:"Legendary Alliance skills"`, merged
into the existing candidate list. Re-run found 118 skills (10 new, all cleanly parsed — no new skip
lines), including Tree Song: `{"energy":15,"energyWvw":25}`.

**Separately caught: that fetched WvW value (25) is itself pre-patch/stale.** Tree Song's infobox
page was last edited 2026-06-13 (confirmed via `action=query&prop=revisions`), predating today's
patch. `Game_updates/2026-09-29`'s own wording — "Reduced the energy cost from 25 to 15 in WvW
only" — is the actual source of truth; the infobox simply hasn't been hand-edited by a wiki
contributor to catch up yet. Same wiki-lag class of issue Saint's Shield hit in Leg 4. Handled the
same way: a small `RESOURCE_COST_WVW_OVERRIDES` map in `resource-cost-lines.ts` (not a direct edit
to the auto-regenerated JSON, which a future blind re-run would silently clobber) overrides
`energyWvw` to 15 for skill 62941, with a comment noting it should be deleted once the wiki page
itself is edited and a re-fetch picks up 15 on its own.

Closed as a code fix, not a scoping/exclusion decision — see `scripts/fetch-resource-costs.ts` and
`src/shared/skill-calc/resource-cost-lines.ts` for the actual changes.

## Untracked Patch Traits (2026-09-29, Known Exceptions Sweep Leg 8)

The prior scoping addendum's "not found anywhere in `src/` or `scripts/` at all" line for Latent
Stamina, Specialized Elements, Sapping Device, and Adrenal Health was an absence-of-a-grep-hit
observation, not a real scoping decision — this leg actually investigated each one (live wiki
wikitext + a check of what infra already exists for its fact shape) rather than assuming absence
meant exclusion.

**Latent Stamina (trait 1962, Tempest)** — genuine gap, now fixed. "Endurance Gained" is a plain
`Number` fact, the exact shape `NUMERIC_FACT_WVW_OVERRIDES` (`fact-numbers.ts`) exists for. Live
wiki infobox is pre-patch-stale (pve+wvw=10, pvp=15, unchanged since 2022-02-28) — same wiki-lag
pattern as Tree Song (Leg 5) — so the patch notes themselves ("Increased the endurance amount from
10 to 15" **[WvW]**) are the source of truth: wvw splits off from pve and rises to match pvp's
existing 15. Added `1962: { 'Endurance Gained': 15 }`.

**Specialized Elements (trait 2437, Evoker)** — genuine gap, now fixed, but not a new entry: this
trait already had a `NUMERIC_FACT_WVW_OVERRIDES` row (`2437: { 'Empowered Skill Recharge': 20 }`)
from the original Elementalist leg of the main sweep (2026-08-20) — the "not found anywhere"
grep in the earlier addendum missed it because that grep was for the trait *name*, not its id. Same
wiki-lag shape as Latent Stamina (live infobox still pve=33/pvp+wvw=20); patch notes ("Increased
the empowered recharge from 20% to 33%" **[WvW]**) mean wvw now matches pve at 33, pvp stays at 20.
Updated the existing entry to 33 in place rather than adding a duplicate key (which fails the
TypeScript build outright — caught by `npm run typecheck` before landing).

**Sapping Device (trait 507, Engineer)** — confirmed genuinely out of scope, not a gap. This is the
real Engineer Inventions trait (reworked from Autodefense Bomb Dispenser 2026-07-15): applies
Weakness when you disable or immobilize a foe. Its Weakness application was never modeled in the
boon/condition aggregate calculator at all (`sources.ts` has zero references to id 507) — a
pre-existing gap unrelated to this patch, same "not modeled" bucket as Bandage Blast/Overload Water
in the original addendum. The patch's own change (an added 8s internal cooldown per target) doesn't
introduce anything new to fix, since nothing was modeled to begin with. More importantly, even if it
were being modeled fresh: "on disable/immobilize" is an unbounded, combat-dependent trigger with no
fixed per-rotation cadence this app can assume, the same shape that already permanently excludes
Relic of Karakosa's COMBO-bucket trigger (this doc, Leg 2) — this app has no ICD-tracking mechanism
for trait Buff applications the way relics have their own `rechargeSeconds` field. **Permanently
excluded**, moved to TODO.md's Known Exceptions section.

**Adrenal Health (trait 1348, Warrior Defense)** — confirmed genuinely out of scope for this
patch's specific change, but surfaced a separate, real, pre-existing curation gap along the way.
This is the real core Warrior Defense minor trait ("Gain health based on adrenaline spent"), not
something new from a "Paragon" chant skill as the patch-notes summary's placement under "Warrior >
Paragon" might suggest — its `traitedFacts` are cross-spec-gated by Paragon's own minor traits
(`requires_trait: 2373` collapses the whole effect to 1 stack; `requires_trait: 2226`, a different,
non-Paragon id, provides the normal 2/3/4-stack progression). The patch's "paragon chants now grant
only one stack" change lives entirely in that `requires_trait: 2373`-gated `apply_count` value —
`NUMERIC_FACT_WVW_OVERRIDES` explicitly can't touch it (its own `numericFactLines` guards on
`requires_trait == null`, deliberately, per its Serene Rejuvenation-leg comment) and no mechanism
anywhere in this codebase can override a Buff fact's `apply_count` at all (`WvwFactOverride` is
documented as duration-only in half a dozen places — Icerazor's Ire, Razorclaw's Rage, Darkrazor's
Daring, Fox's Fury). Same established architecture limit, not a new one this leg introduces.

Separately found while reading the trait's own wiki page: its base (untraited) healing-per-stack
IS a real, wiki-documented `{{coefficient|healing|...}}` value (0.6/0.9/1.2 scaling by adrenaline
stage, reference builds 2992/4488/5985 pve — 2610/3915/5220 wvw — 2106/3158/4212 pvp) that has never
been curated in `CURATED_HEALING_COEFFICIENTS`/`CURATED_TRAIT_HEALING_COEFFICIENTS`
(`healing-calc.ts`) at all — a genuine, pre-existing, patch-unrelated gap. Not fixed in this leg
(out of this leg's actual scope, which is the patch-driven trait list, not a general healing-
coefficient sweep) — logged as its own TODO.md item instead.

