# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Current Milestone: Known Exceptions Sweep

User-directed 2026-09-29 to reopen every item in the old Known Exceptions section, including the
ones previously marked permanently excluded. Flagged before starting: most of those were reconfirmed
settled across multiple prior sessions with explicit "don't re-investigate without new information"
notes — user confirmed proceeding anyway. Full history: `docs/investigations/coefficient-verification-queue.md`
and `docs/investigations/sep-29-2026-patch-changes.md`.

### [Known Exceptions Sweep — Cleansing Ire Cleanse Count] — Leg 7
Trait 1649's condition-cleanse count has never been modeled (only self-only targeting
classification exists today).
Last touched: 2026-09-29. Re-checks: 0.

### [Known Exceptions Sweep — Untracked Patch Traits] — Leg 8
Latent Stamina, Specialized Elements, Sapping Device, and Adrenal Health aren't in `src/` or
`scripts/` at all. Determine whether each should be modeled going forward (new trait facts) or is
genuinely out of scope for this app, rather than assuming absence means exclusion.
Last touched: 2026-09-29. Re-checks: 0.

## Future Milestones (unscheduled)

### Auto-Update Check
User-directed 2026-09-29 as the next milestone after Known Exceptions Sweep ships. On app launch,
check GitHub for a newer release and either surface a small notification indicator on the Settings
button directing players to update, or prompt the update immediately — exact UX (indicator vs.
immediate prompt) still to be decided when this milestone is scoped into legs. Repo is already
public and electron-updater/GitHub Releases auto-update is in place per
[[repo_now_public_for_autoupdate]]; this is a check/prompt UX layer on top of that, not new
publishing infra.
Last touched: 2026-09-29. Re-checks: 0.

## Unscheduled

### [Discord Bot Profession-Scoped Game-Data Fetch] — Leg 1 (nice-to-have, deprioritized)
A fresh browser session still re-fetches all 26 game-data JSON files (11MB) per render even though
most previews only need one or a few professions' worth of data. `buildGameData()`/
`GameDataProvider` is shared with Electron's load-everything-once design, and a squad preview's
profession set isn't known until the share is fetched and parsed — a genuinely bigger refactor.
Session-reuse already avoids repeat downloads within a warm browser session, so a cold start pays
the full 11MB only once. User confirmed 2026-08-19 the other latency fixes weren't clearly
noticeable either way and is satisfied with "cleaner on the backend" for now — revisit only if
latency becomes a live complaint again, ideally backed by a `wrangler tail` timing pass.
Blocked: waiting on latency becoming a live complaint again.
Last touched: 2026-08-19. Re-checks: 0.

## Known Exceptions — investigated, permanently excluded

Leg 1 of the sweep above (2026-09-29) gave each of these a fresh-eyes re-check — current wiki
content and local API data all re-pulled and compared against the prior conclusions. All 6
reconfirmed closed with no new leads; no code changes needed. Full derivation for each:
`docs/investigations/coefficient-verification-queue.md`.

- Guardian 31295 (Sanctuary, underwater variant)
- Necromancer 10547 (Summon Blood Fiend)
- Necromancer 10670 (2nd Well of Blood id)
- Thief 71802 (Helmet Breaker)
- Soul Grasp
- Grim Specter, Carnivore, Replenishing Despair

Leg 2 (2026-09-29): Relic of Karakosa's Sep 29 patch trigger-location change (heal now centers on
blast-finisher location, not player location). Already a `COMBO`-bucket relic per
`docs/relic-trigger-classification.md` — unbounded trigger, never a `RELIC_TRIGGER_GATES` candidate
for reasons independent of this patch; its heal payload was never curated in `healing-calc.ts`
either (that table has no relic-keyed entries at all). Modeling the new mechanic specifically would
require spatial/positional infra (player vs. finisher vs. ally position) this app has nowhere else.
No code change possible or needed. Full scoping:
`docs/investigations/sep-29-2026-patch-changes.md`.

## Reference — not scheduled

- **Future stat-family candidates** — never-modeled stat-family shapes (per-condition-type
  damage-%, self-stacking buffs, target-status-stack-count, per-skill-category, weapon-type-scoped,
  and more) found during the Outgoing Damage % and data-completeness sweeps. Each affects only 1-4
  skills/traits, not worth building dedicated infra for on its own. Revisit only if a future sweep
  needs the same shape for more candidates: `docs/investigations/future-stat-family-candidates.md`
  and `docs/investigations/data-completeness-gap-shapes.md`.
