# Post-mortem: Project Revision v2

Scoped and shipped 2026-10-19 (single-day milestone, 4 legs, commits `c288651`..`91b2be7`).

## What shipped

First pass of the global v2 conventions against a project that had no `CLAUDE.md` at all, driven by
the audit at `docs/investigations/project-revision-v2-audit.md` (12 convention items checked).

- **Leg 1 (CI Gate)**: Added `npm run test`/`lint`/`typecheck` steps to `deploy-web.yml` ahead of
  `build:web`, then verified the gate for real — pushed a deliberately-broken test to `main` and
  confirmed every downstream step (lint, typecheck, build, Pages publish) was skipped, then pushed
  the revert and confirmed a clean run deploys normally.
- **Leg 2 (CLAUDE.md Slim)**: Created `CLAUDE.md` and `ARCHITECTURE.md` from scratch. Folded in the
  3 unpromoted postmortem lessons as CLAUDE.md hard rules, dropped 4 machine-local path references
  from TODO.md and 3 postmortems, added the missing AI-assisted-development disclosure line to
  README.
- **Leg 3 (Memory Cleanup)**: Deleted 63 orphaned memory files and reclassified the 36 indexed
  entries — 16 deleted as redundant with code/docs/CLAUDE.md, the rest kept, trimmed, or converted.
  Surfaced 7 open items the audit found with no disposition anywhere (Twin Moon Sweep, Light Aura
  bug, Necromancer life-force gap, Heated Rebuke gap, weapon off-hand mirror bug, 2 skill-side
  override gaps) to Vanny via `AskUserQuestion` and routed each into TODO.md, Known Exceptions, or
  a CLAUDE.md pitfall per her call.
- **Leg 4 (Schema Version)**: Added `schemaVersion` to `Build`/`SquadComp`, stamped on write and
  backfilled on read via one shared `withCurrentSchemaVersion` choke point so sync's opaque-blob
  storage adapters didn't each need their own migration logic. Stamped `Conventions: v2` in
  CLAUDE.md, closing the milestone.

## What went well

- The audit-first structure (one doc enumerating all 12 convention items with per-item status
  before any leg started) meant no leg discovered mid-flight that its scope was wrong — each leg's
  "done when" was already written down before the first file changed.
- Leg 1's CI gate was verified behaviorally, not just read as YAML — pushing a deliberately-broken
  test and watching the real GitHub Actions run skip every downstream step is the kind of check that
  catches a gate wired to the wrong step order or a swallowed exit code, which a diff review alone
  wouldn't.
- Leg 3's memory cleanup didn't just delete orphaned files — it surfaced the 7 open items they
  described to Vanny for an explicit decision rather than silently dropping them or silently
  creating TODO entries on its own judgment. All 4 legs closed same-day with no rework.

## Friction / what didn't go as smoothly

- The milestone's intro paragraph in TODO.md needed a manual update after each leg to stay in sync
  with COMPLETED.md — exactly the drift pattern the Thief Pass + Celestial Fix postmortem had
  already flagged, and which Leg 2 of this same milestone promoted into a CLAUDE.md hard rule. The
  rule existed in time to apply to its own remaining legs (3 and 4), so no drift accumulated here,
  but it's a reminder that a lesson only pays off once it's live, not once it's written.

## Scope creep observed

None. Leg 3's 7 surfaced open items were routed to new TODO/Known-Exception entries rather than
investigated or fixed in-place during the cleanup leg itself.

## What changes for the next milestone

- No new lessons beyond what Legs 2-3 already promoted into CLAUDE.md hard rules (TODO.md intro
  sync, COMPLETED.md archiving at the actual boundary, patch-driven work vs. standing queues as
  separate threads). This milestone's own conduct is the first test of those rules sticking.
