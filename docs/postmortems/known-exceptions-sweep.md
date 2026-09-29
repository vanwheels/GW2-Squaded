# Post-mortem: Known Exceptions Sweep

Scoped 2026-09-29, shipped 2026-09-29 (single-day milestone, 13 legs, commits `425bd46`..`9354992`
plus several doc-only/no-code-change legs).

## What shipped

User-directed to reopen every item in the old Known Exceptions section, including ones previously
marked permanently excluded, on the premise that a fresh-eyes re-check might catch something the
prior "don't re-investigate without new information" notes missed.

- **Leg 1**: re-verified all 6 old permanently-excluded dead-ends against current wiki wikitext and
  live API data. All 6 reconfirmed closed, no new leads.
- **Leg 2**: Relic of Karakosa's patch-driven trigger-location change scoped and excluded — would
  need spatial/positional infra the app has nowhere else.
- **Leg 3**: Healing Ripple/Overload Water coefficients. Overload Water was a data update; Healing
  Ripple required new infra (`CURATED_TRAIT_HEALING_COEFFICIENTS` + `healingLinesForTrait` +
  `trait-fact-lines.ts`) since the existing coefficient table was skill-id-keyed only.
- **Leg 4**: Bandage Blast and Saint's Shield healing coefficients curated/updated.
- **Leg 5**: Tree Song energy cost. Real bug, not a gap — `fetch-resource-costs.ts`'s wiki search
  category silently excluded Vindicator's whole Legendary Alliance skill set, not just Tree Song.
- **Leg 6**: Reaver's Curse Healing/Barrier % folded into Saint's Shield's existing dodge-replacement
  computation.
- **Leg 7**: Cleansing Ire cleanse count — hand-curated table added for the aggregate
  Cleanse-row/per-skill-chip pipeline.
- **Leg 8**: audited the 4 traits the prior sweep had dismissed via absence-of-grep-hit. 2 were real
  `NUMERIC_FACT_WVW_OVERRIDES` gaps and got fixed; Sapping Device confirmed permanently out of scope;
  Adrenal Health's specific patch change confirmed out of scope but surfaced an unrelated healing-
  coefficient gap, deferred to its own leg.
- **Leg 9**: follow-up fix for Cleansing Ire — Leg 7's fix only covered the aggregate pipeline; the
  separate per-skill tooltip path needed its own fix.
- **Leg 10**: Corrupt Row Gap (Slice Through Reality) — confirmed NPC-only, excluded.
- **Leg 11**: Numinous Gift duplicate boon leak — a real regression from the same-day patch data
  refresh, fixed via a `wvw-fact-overrides.json` entry.
- **Leg 12**: Legend Form Facts Life Siphon Drift — a stale regression-test expectation, not a real
  coefficient drift. Test-only fix.
- **Leg 13**: Adrenal Health's healing coefficient (deferred from Leg 8), investigated and
  permanently excluded — the coefficient lives inside a wiki Buff-fact template with no
  `AttributeAdjust`/`Healing` fact to bind a curated entry to; surfacing it would need new
  per-stack-heal-value infra nothing else in the codebase uses. Same shape as Leg 2/Leg 8's
  exclusions.

## What went well

- The "reopen everything, including permanently-excluded items" premise paid off more than expected.
  Legs 5, 7, and 8 all found the original TODO framing was stale, incomplete, or simply wrong (Leg 5:
  assumed-missing infra that had actually shipped weeks earlier; Leg 7: undersold how much of the
  cleanse-count data was stale/missing; Leg 8: "not found in `src/`" was a grep-hit absence, not a
  real scoping conclusion) — re-deriving from current wiki wikitext and live API data instead of
  trusting prior notes caught real bugs (Legs 5, 11) alongside the expected reconfirmations (Leg 1).
- Precedent set early (Leg 2's Relic of Karakosa exclusion) gave later legs (8, 13) a consistent bar
  for "real mechanic, no binding infra, not worth building for one candidate" — both closed the same
  way without re-litigating the standard.
- Adjacent findings were consistently deferred to their own leg/TODO item rather than absorbed
  in-place (Leg 8 -> Leg 13 for Adrenal Health; Leg 7 -> Leg 9 for Cleansing Ire's second pipeline),
  keeping each leg's diff reviewable.

## Friction / what didn't go as smoothly

- Two fixes (Cleansing Ire, and per the codebase's recurring "tooltip vs. aggregate are separate
  pipelines" trap) needed a same-milestone follow-up leg because the first pass only covered one of
  two rendering paths. Worth checking both the aggregate/boon-calc path and the per-skill tooltip
  path up front for any future fact-table fix, rather than treating a single green pipeline as done.
- COMPLETED.md archiving had fallen behind: two prior milestones ("Thief Pass + Celestial Fix",
  "Sep 29, 2026 patch") shipped without being archived at their own boundaries. Caught up at this
  milestone's close (`COMPLETED-archive-known-exceptions-sweep.md` now covers all three).

## Scope creep observed

None absorbed silently. Leg 8 surfacing Adrenal Health's healing-coefficient gap mid-investigation
was logged as a new TODO item and deferred to its own leg (13) rather than expanded in place.

## What changes for the next milestone

- Archive COMPLETED.md at the actual milestone boundary going forward, not several milestones later.
- Next milestone (Auto-Update Check) still needs its UX decided (notification indicator vs.
  immediate prompt) before it can be scoped into legs.
