# Post-mortem: Tooling & Cleanup

Scoped 2026-10-19, shipped 2026-10-19 (single-day milestone, commits `3da84f6`..`c5a9244`).

## What shipped

- **Leg 1 (Prettier Adoption + Project Cleanup)**: installed Prettier mirroring ChoiceBuds'
  `.prettierrc`/`.prettierignore` shape, added `eslint-config-prettier` as the last ESLint config
  entry so stylistic rules never fight Prettier, ran a full-codebase format pass (295 files), and
  wired `prettier --check .` into `npm run lint` so drift can't creep back in silently. Commit
  `3da84f6`.
- **Leg 2 (Light Aura Squad Builder Bug)**: investigated a reported Boons-bar/Auras-bar divergence
  for a Luminary Guardian build. Traced every path Light Aura could reach the boon/condition and
  aura aggregate calculators plus both display components, and found all of them correctly gated.
  Root cause: the bug (identical wording) had already been fixed on 2026-08-19, with a regression
  test (`radiant-resolve-aura-routing.test.ts`) still passing — the TODO entry was a stale duplicate
  resurrected from an orphaned memory file during Project Revision v2's Memory Cleanup Leg 3
  without checking whether it had already shipped a fix. Vanny re-verified live that the rows
  match. No code change needed. Commit `c5a9244`.

## What went well

- Prettier adoption landed clean on the first pass — one commit, full-codebase format with no
  manual touch-up needed, and lint/typecheck/both test suites (main + worker) passed clean
  immediately after.
- Leg 2's investigation was thorough rather than reflexive: rather than guessing at a fix for a
  reported symptom, it traced the actual data paths, found a passing regression test for the exact
  bug, and confirmed with Vanny live before closing the item — avoiding a wasted or duplicate fix.

## Friction / what didn't go as smoothly

- Leg 2 only existed because an already-fixed bug was resurrected as a new open TODO item.
  Project Revision v2's Memory Cleanup Leg 3 surfaced "Light Aura bug" from an orphaned memory file
  and routed it straight into TODO.md without cross-checking COMPLETED.md or git history for prior
  work on the same symptom — the fix had shipped two months earlier (2026-08-19). The cost here was
  contained (a short re-verification leg), but the same failure mode on a less-well-tested bug could
  cost a full reinvestigation or a duplicate fix.

## Scope creep observed

None within either leg. The milestone bundled two genuinely unrelated threads (lint tooling vs. a
bug investigation) under one "Tooling & Cleanup" title, but both were already scoped that way at
planning time (04b800d), not absorbed mid-milestone.

## What changes for the next milestone

- Before routing an item sourced from an old/orphaned memory file (or any stale note) into TODO.md
  as a new open item, grep `COMPLETED.md` and `git log` for the same symptom/component first. A
  memory file is a pointer to what was once true, not confirmation that it's still true.
