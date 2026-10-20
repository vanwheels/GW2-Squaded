# Data-completeness test coverage — design notes

Source: discussion 2026-10-19 (not a bug report) — concern was the volume of skills/traits with
missing or wrong coefficient/boon-condition tooltip data that currently only surfaces when someone
notices in play or during a manual per-profession sweep. Two Explore passes mapped the exact
binding logic and historical bug pattern below; this doc captures their findings for whoever scopes
the milestone.

The project already solved this class of problem once, for trait attribute bonuses:
`src/shared/gear-calc/trait-attribute-completeness.test.ts` scans `traits.json` for every trait
carrying a qualifying fact shape and fails CI if that trait isn't in a curated table *or* a
documented exclusion list. That pattern isn't yet applied to (a) damage/healing/barrier
coefficients, or (b) the known "two separate code paths read the same facts" bug class that has
twice required a double fix (Cleansing Ire, Specter Siphon F1).

## Candidate 1 — coefficient-table completeness test

Would mirror `trait-attribute-completeness.test.ts`'s shape (candidate predicate → `COVERED_IDS`
union → `EXCLUDED_IDS: Record<number, string>` map → uncovered/redundant/stale `it()` blocks), as
a new `src/shared/skill-calc/coefficient-completeness.test.ts`.

**Candidate predicate**, per the binding logic each calculator actually uses:
- `fact.type === 'Damage'` → candidate for `CURATED_DAMAGE_COEFFICIENTS` (`damage-calc.ts:133`,
  matcher at `damage-calc.ts:4007-4011`: `f.type === 'Damage' && f.text === entry.factText &&
  requires_trait` match).
- `fact.type === 'AttributeAdjust' && fact.target === 'Healing'` → candidate for
  `CURATED_HEALING_COEFFICIENTS` (`healing-calc.ts:55`) or `CURATED_BARRIER_COEFFICIENTS`
  (`barrier-calc.ts:86`) — the API mislabels every Barrier fact's `target` as `'Healing'` too
  (`barrier-calc.ts:9-12`), so membership is disambiguated by which table's `factText` list
  matches, not a fact field.
- `fact.type === 'AttributeAdjust' && fact.target === 'Power'` → candidate for
  `CURATED_SIPHON_DAMAGE_COEFFICIENTS` (`siphon-damage-calc.ts:124`) — same shape family.

Scan both `skills.json` and `traits.json`. Important asymmetry: **no trait-keyed damage or
barrier table exists** (`trait-fact-lines.ts:9-10` states this explicitly) — only
`CURATED_TRAIT_HEALING_COEFFICIENTS` (`healing-calc.ts:1264`, currently 1 entry) covers traits at
all. Any `Damage`- or Barrier-shaped fact found on a *trait* can never land in `COVERED_IDS` today;
it always needs an exclusion entry ("no trait-keyed table exists yet") until that infra is built.

**Confirmed non-overlap with existing scripts** (none of these are a completeness/coverage check,
only value-correctness against already-curated entries): `scripts/fetch-skill-coefficients.ts`,
`scripts/fetch-target-counts.ts`, `scripts/lib/wiki-verification.ts`,
`src/shared/skill-calc/coefficient-snapshots.test.ts` (a golden-snapshot drift guard, whose own
header explicitly lists the completeness tests it's distinct from and doesn't include one for
coefficients — confirming the gap), `curated-numeric-fact-values.test.ts` (narrow 3-id regression
guard only).

**Stated limitation (would stay out of scope):** this predicate only catches facts that already
carry a matching `Damage`/`AttributeAdjust` shape. It would **not** catch a coefficient embedded
purely inside a `Buff`-type fact template with no `AttributeAdjust` counterpart — e.g. Adrenal
Health (trait 1348, already logged in TODO.md's Leg 13 note), confirmed to carry zero
`AttributeAdjust`/`Healing` facts, only `Buff`/`Time`/`Number` facts. That's a structurally harder
problem (no fact-type signal to scan for) — not solved by this test, and shouldn't be mistaken for
closed by it.

**Triage shape, once built:** run the scan once, then classify every hit — already-known non-gap
shapes (forced trait-side exclusions, anything matching an existing Known Exception) get an
`EXCLUDED_IDS` reason; a genuine small miss gets wiki-verified and curated directly (same as the
original trait-attribute sweep's 1 genuine miss, Kinetic Accelerators); a genuine miss needing real
research gets logged as its own separately-trackable TODO item rather than wiki-verified inline,
per this project's own rule to keep curation queues separate from infra work.

## Candidate 2 — cross-pipeline tooltip consistency test

Confirmed via Explore: Buff/PrefixedBuff tooltip rendering (boon/condition grants) is **already**
structurally shared — both the per-skill/per-trait tooltip (`boonConditionFactsForSkill`/
`boonConditionFactsForTrait`, `sources.ts:4565-4620`) and the aggregate calculator
(`computeBoonConditionSources`, `sources.ts:5625+`) call the same `extractFromFacts()`
(`sources.ts:4363-4555`) — so a fix to `BUFF_INSTANCE_VALUE_OVERRIDES`/`wvw-fact-overrides.json`/
`synthetic-facts.json` is automatically consistent across both by construction. No test is needed
for that path — it would be vacuous, since it's one function.

The actual recurring-bug site is different: `skillFactLines`/`traitFactLines`
(`skill-fact-lines.ts`/`trait-fact-lines.ts`, the *generic* non-Buff fact loop over
`Number`/`Percent`/`Time`/`AttributeAdjust`/`Distance` facts via `factLine()` in
`fact-numbers.ts:32-94`) has no structural link to the separate "named fact" correction pipeline
(`computeNamedFactSources`/`namedFactsForSkill`, `sources.ts:~6965-7103`, e.g.
`CLEANSING_IRE_CLEANSE_FACTS` at `sources.ts:6883-6926`). This is exactly what caused the 2-commit
Cleansing Ire fix: `5ba40f2` fixed the aggregate/named-fact pipeline; `7082b72`, filed separately,
fixed `skillFactLines`'s independent raw-fact render — same curated table, two unsynced consumers.

**Design shape:** a small registry-driven test (not a backlog-generator scan like candidate 1 —
today there's exactly one table of this shape), as a new
`src/shared/skill-calc/tooltip-pipeline-consistency.test.ts`:
- A `RAW_FACT_CORRECTIONS` list declares each known "pipeline-C corrects a raw fact that
  pipeline-A would otherwise render un-corrected" case: `{ skillId, rawFactText,
  correctionSource }`. Seed it with the Cleansing Ire entries as the first, already-fixed example.
- For each entry, assert `skillFactLines(...)`'s output (a) does not include the raw, uncorrected
  fact text, and (b) does include a line sourced from the correction table (mirroring
  `cleansingIreTooltipLine()`, `skill-fact-lines.ts:113-121`, and the exclusion `continue` at
  `skill-fact-lines.ts:222-229`).
- The point: *forgetting* to add a registry entry (and the matching `skillFactLines` patch) when a
  future `computeNamedFactSources`-style correction table is added should fail CI — not that the
  registry auto-discovers new cases.

## Open scope question for whoever plans this

Whether these are one milestone with 2 legs, or 2 separately-scheduled items — they touch different
systems (coefficient tables vs. tooltip-rendering/named-fact pipeline) and are each independently
closable, so splitting is the likely call, but not decided here.

## Candidate 1 outcome: Leg 1 actual scan (2026-10-19)

Running the predicates above for real, before writing any test code, found the scale assumption in
this doc's design section didn't hold for Damage specifically — worth recording so Leg 2 doesn't
repeat the same dry run.

**Damage (deferred to Leg 2):** `fact.type === 'Damage'` matches 1,666 skills against only 931
curated — 745 "uncovered," ~8x the trait-attribute test's precedent (98 candidates). Breakdown: 181
have `professions: []` (orphan/NPC ids); of the remaining 564 with real professions, only 155 are
the id `professions.json` actually lists for that weapon slot or profession-mechanic slot — the
other ~400+ are weapon-skill chain continuations (confirmed via a worked example: Guardian's
"Faithful Strike" id 9108 carries a real Damage fact but `professions.json`'s own Scepter Weapon_1
entry lists 9098, not 9108) or duplicate weapon-tier ids (Eviscerate/Kill Shot/Earthshaker/Path to
Victory/Bloodthirster each appear under 2-5 ids). ~103 more are Heal/Utility/Elite-slot skills,
which `professions.json` doesn't enumerate at all (no top-level `skills` list, unlike weapon/
mechanic slots), so a different reachability check is needed for those. Net: Leg 2 needs the same
equippable-id cross-reference Leg 1 used for its `WEAPON_CHAIN_OR_DUPLICATE`/
`MECHANIC_CHAIN_OR_DUPLICATE` buckets, extended to cover Heal/Utility/Elite skill ids too (likely
via `skill-variants.ts`'s existing Heal/Utility/Elite collapsing logic, not a fresh reachability
concept).

**Healing/Barrier/Siphon (Leg 1, shipped):** Larger than the trait-attribute test's 98-candidate
precedent too, but tractable — 399 skill-side Healing/Barrier candidates (260 covered, 139
excluded), 16 skill-side Siphon candidates (10 covered, 6 excluded), 105 trait-side Healing
candidates (1 covered: Healing Ripple #351, 104 excluded), 31 trait-side Siphon candidates (all
excluded, no trait-keyed table exists). Nearly every trait-side candidate turned out to already
have a categorization decision one hop away: every `AttributeAdjust` fact (any target) is *also* a
candidate in `trait-attribute-completeness.test.ts`, so cross-referencing that file's
`EXCLUDED_TRAIT_IDS`/flat-stat tables (confirmed per-id via grep, not assumed) resolved the bulk of
both trait pools without fresh wiki research. The 139+6=145 excluded skill ids split cleanly into:
known exceptions already in TODO.md (7-9 ids, some not yet cross-referenced into the Known
Exceptions section before this leg — Sanctuary/Summon Blood Fiend/Well of Blood/Helmet Breaker were
already there but hadn't been checked against this predicate), downed-state/pet/orphan ids
(structurally unreachable, same precedents as Candidate 1's design above), weapon-tier/mechanic
duplicates (55 ids, same shape as Damage's), and a genuine 51-skill backlog of newer content never
swept (counted by distinct id — skill 80985/Vampiric Predation carries both an uncovered Healing-
and an uncovered Siphon-shaped fact, so it's excluded in both pools but is one skill). Same for the
trait side: 11 distinct trait ids are a genuine newer-content backlog (trait 2286/Natural Fortitude
likewise carries both an uncovered Healing- and an uncovered Siphon-shaped fact). Both backlogs are
deferred to TODO.md's [Healing/Barrier/Siphon Coefficient Sweep Refresh] and [Trait-Side Heal/
Barrier/Siphon Proc Tooltip Coverage] items rather than wiki-verified inline.

Shipped as `src/shared/skill-calc/coefficient-completeness.test.ts`.
