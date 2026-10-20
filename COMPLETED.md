# Completed

Entries are added as work lands, most recent first.

Everything through "Tooling & Cleanup" (shipped 2026-10-19, Prettier Adoption + Project Cleanup and
the Light Aura Squad Builder Bug investigation) is archived in
`docs/archive/completed-2026-10-19-to-2026-10-19.md`.
Everything through "Project Revision v2" (shipped 2026-10-19), plus the 4 milestones before it that
had fallen behind on archiving (Auto-Update Check, Web App Port, Sync Backend Foundation,
Continuous Cross-Device Sync) and Polish/Parity's completed Legs 1-2, is archived in
`docs/archive/completed-2026-09-29-to-2026-10-19.md`.
Everything through the "Known Exceptions Sweep" milestone (shipped 2026-09-29) is archived in
`COMPLETED-archive-known-exceptions-sweep.md`.
Everything through the "Sep 15, 2026 patch + fixes" milestone (shipped 2026-09-16) is archived in
`COMPLETED-archive-sep-15-2026-patch.md`.
Everything before that, back through v1.0.0, is in `COMPLETED-archive-pre-1.0.md`.

### Coefficient-Table Completeness Test — Leg 2 (2026-10-19)
Built `src/shared/skill-calc/damage-coefficient-completeness.test.ts` for
`CURATED_DAMAGE_COEFFICIENTS`, the 5th and final table of this milestone's scope. Built the
reachable/equippable-id filter Leg 1 deferred (ids listed in `professions.json`'s `weapons[*].
skills`/`professionSkills`, or tagged `Heal`/`Utility`/`Elite` in `skills.json`'s `slot` field) as
self-contained test logic rather than a new `src/shared` runtime module, matching every other
completeness test's own pattern — confirmed via a dry run it has one known scope gap (bundle-
reachable Kit/Conjure/Dragon-Slash ids aren't in the filter) that hides zero real misses today.
Shrunk the naive 745-candidate problem to 267; 91 resolved as structurally-provable duplicates/
non-equippable ids (same-name sibling already curated, flip-target, turret/gadget sub-ability,
weapon- or mechanic-slot duplicate), the remaining 176 (42 Soulbeast Beastmode + 134 spanning
Shroud/Shatter/Jade Sphere/Mech Core/Revenant-legend/festival content) confirmed with the user as
too varied to triage inline and deferred to two new TODO items ([Damage Coefficient Sweep — New/
Uncurated Skill Content], [Trait-Side Damage Proc Tooltip Coverage]) rather than guessed at. Full
suite (625 tests), lint, and typecheck all pass. See commit TODO_HASH.

### Coefficient-Table Completeness Test — Leg 1 (2026-10-19)
Built `src/shared/skill-calc/coefficient-completeness.test.ts`, mirroring `trait-attribute-
completeness.test.ts`'s shape, for `CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`/
`CURATED_TRAIT_HEALING_COEFFICIENTS`/`CURATED_SIPHON_DAMAGE_COEFFICIENTS` (4 of the originally
scoped 5 tables). Split `CURATED_DAMAGE_COEFFICIENTS` into its own Leg 2 after a dry-run scan found
its naive candidate predicate matches 1,666 skills against only 931 curated — most of the 745
"uncovered" hits are structurally unreachable (chain-continuation/duplicate-tier ids, NPC/pet
skills), needing a new equippable-id filter before the predicate means anything. Every real hit
from the 4 shipped tables' scan (280 total candidates) got a recorded decision: known exceptions,
structurally-unreachable buckets (downed-state, pet, orphan, chain/duplicate ids), traits already
categorized by the sibling attribute-completeness test, or a genuine backlog deferred to two new
TODO items ([Healing/Barrier/Siphon Coefficient Sweep Refresh], [Trait-Side Heal/Barrier/Siphon
Proc Tooltip Coverage]) rather than wiki-verified inline. Full scan numbers and the Damage-leg
split rationale: `docs/investigations/data-completeness-test-coverage.md`. Lint, typecheck, and the
full test suite (619 tests) all pass. See commit
`53fd58f131d5010dd6d23a3f3c971dfb3ef37fac`.
