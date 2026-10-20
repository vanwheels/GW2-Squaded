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
