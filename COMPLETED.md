# Completed

Entries are added as work lands, most recent first.

### Light Aura Squad Builder Bug — Leg 2 (2026-10-19)
Traced every path Light Aura could reach `computeBoonConditionSources`/`computeAuraSources`
(branch-conditional facts, relic facts, skill/trait facts, additive-flip dedup) and the display
filters in `BoonConditionSummaryPanel.tsx`/`SlotTile.tsx`: all correctly gate aura-category facts
to the Auras row only. Found the actual root cause of the confusion: this exact bug (same wording)
was already fixed 2026-08-19 (`sources.ts`'s `category !== 'aura'`/`=== 'aura'` branch-loop
filters, guarded by `radiant-resolve-aura-routing.test.ts`, still passing). The TODO entry was a
stale duplicate — resurrected from an orphaned memory file during Memory Cleanup Leg 3
(2026-10-19) without checking it had already shipped a fix. Vanny re-verified live: Boons/Auras
rows match between the two views for the Luminary Guardian build. No code change needed. See
commit `c5a9244e8697376d76fa8293c8b40b74d7e49c28`.

### Prettier Adoption + Project Cleanup — Leg 1 (2026-10-19)
Installed Prettier mirroring ChoiceBuds' `.prettierrc`/`.prettierignore` shape, added
`eslint-config-prettier` as the last ESLint config entry so stylistic rules never fight Prettier,
ran a full-codebase format pass (295 files), and wired `prettier --check .` into `npm run lint`.
Lint, typecheck, and both the main and worker test suites all pass clean. See commit
3da84f6fb913571e9bb78ffc15b3438f7286916d.

Everything through "Project Revision v2" (shipped 2026-10-19), plus the 4 milestones before it that
had fallen behind on archiving (Auto-Update Check, Web App Port, Sync Backend Foundation,
Continuous Cross-Device Sync) and Polish/Parity's completed Legs 1-2, is archived in
`docs/archive/completed-2026-09-29-to-2026-10-19.md`.
Everything through the "Known Exceptions Sweep" milestone (shipped 2026-09-29) is archived in
`COMPLETED-archive-known-exceptions-sweep.md`.
Everything through the "Sep 15, 2026 patch + fixes" milestone (shipped 2026-09-16) is archived in
`COMPLETED-archive-sep-15-2026-patch.md`.
Everything before that, back through v1.0.0, is in `COMPLETED-archive-pre-1.0.md`.
