# Completed

Entries are added as work lands, most recent first.

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
