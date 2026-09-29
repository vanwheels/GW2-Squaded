# Post-mortem: Sep 29, 2026 patch

Scoped 2026-09-29, shipped 2026-09-29 (single-day milestone, 3 legs, commits `c7b82fa`..`599e57b`).

## What shipped

- **Scoping (Leg 1)**: full raw change list pulled from the patch notes, filtered down to the
  WvW-relevant subset (this app excludes PvP-only splits entirely, which was the majority of the
  patch). Captured in `docs/investigations/sep-29-2026-patch-changes.md`.
- **Refetch and Auto-Verify (Leg 2)**: refreshed the raw game-data cache (`fetch-game-data`,
  committed clean). `fetch-wvw-splits` reproduced the known blind-rerun regression
  ([[fetch_wvw_splits_unsafe_blind_rerun]]) and was reverted rather than committed. Of the 3 target
  values, Grace of the Land's might stacks needed no edit; Seed of Life and Cultivated Synergy's
  Lesser Seed of Life needed a new skill-side `CURATED_NUMERIC_FACT_VALUES` override table, since
  skills had no equivalent of traits' `NUMERIC_FACT_WVW_OVERRIDES` fallback
  ([[skill_side_numeric_fact_wvw_override_gap]]).
- **Curated Coefficient Edits (Leg 3)**: updated the 5 already-curated hardcoded coefficients the
  patch changed (Healing Rain, Drop Urn of Saint Viktor, Essence of Animated Sand, Bulwark Gyro's
  Pulse Barrier, Natural Mender), plus two stale "no PvE/WvW split" comments the patch made
  inaccurate.
- **Deliberate scope exclusion**: 9 changed values with no pre-existing curation (Relic of
  Karakosa's trigger-location mechanic, Healing Ripple, Overload Water, Bandage Blast, Tree Song's
  energy cost, Saint's Shield's healing scaling, Reaver's Curse's healing/barrier %, Cleansing Ire's
  cleanse count, and 4 traits not in the codebase at all) were user-confirmed 2026-09-29 to defer —
  the patch landed on pre-existing gaps rather than breaking anything already modeled, so building
  fresh curation for them wasn't part of this milestone. Logged in TODO.md's Known Exceptions
  section for future reference.

## What went well

- The `fetch-wvw-splits` blind-rerun regression ([[fetch_wvw_splits_unsafe_blind_rerun]]) was
  caught and reverted before it could silently drop 81 skills — the "diff before committing" habit
  from the prior incident held.
- The coefficient edits in Leg 3 were pure data updates to an existing, well-understood shape (no
  new infra needed) — scoping correctly identified them as a small, isolated leg.
- Deferring the 9 no-pre-existing-curation values kept this milestone tightly scoped to "things the
  patch broke in already-modeled code," rather than expanding into a full fresh-curation sweep.

## Friction / what didn't go as smoothly

- None notable — a small, cleanly-scoped 3-leg milestone with no rework.

## Scope creep observed

None. The 9 deferred items were identified at scoping time and explicitly kept out rather than
being absorbed mid-milestone.

## What changes for the next milestone

- No process changes needed — patch-driven milestones with this shape (scope, refetch/verify,
  curate) continue to split cleanly into legs that fit within a single session each.
