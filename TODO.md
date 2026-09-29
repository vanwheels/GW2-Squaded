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

### [Known Exceptions Sweep — Corrupt Row Gap (Slice Through Reality)] — Leg 10
`corrupt-missing-fact-sources.test.ts`'s completeness scan started failing during Leg 7's test run
(unrelated to that change — confirmed still fails on a clean `main` checkout): a new skill "Slice
Through Reality" (3 ids: 80585, 80802, 81302) matches the Corrupt-candidate pattern but isn't in
`CORRUPT_MISSING_FACT_SKILLS` or the test's exclusion list. Needs the same wiki-read-and-classify
treatment the rest of that table got.
Last touched: 2026-09-29. Re-checks: 0.

### [Known Exceptions Sweep — Numinous Gift Duplicate Boon Leak] — Leg 11
Found running the full suite after Leg 9 (unrelated to that change — pre-existing on a clean `main`
checkout too, confirmed via `git stash`). `cosmic-wisdom-trait-effects.test.ts`'s
"Numinous Gift's OWN trait facts are ALSO filtered to equipped legends" test now fails: expected
`['Fury', 'Might', 'Resolution', 'Stability']`, got `['Fury', 'Fury', 'Might', 'Might', ...]` — Fury
and Might each appear twice. Not yet investigated past the test failure itself; likely raw
`skills.json`/trait data drift (same class as the other Sep 29 patch fixes landed this sweep) rather
than a logic bug in `boonConditionFactsForTrait`, but unconfirmed.
Last touched: 2026-09-29. Re-checks: 0.

### [Known Exceptions Sweep — Legend Form Facts Life Siphon Drift] — Leg 12
Found alongside Leg 11, same discovery method (pre-existing on clean `main`, unrelated to Leg 9).
`legend-form-facts.test.ts`'s "appends Lesser Enchanted Daggers' siphon damage + healing to the
Assassin row" test expects `Life Siphon Damage: 1,088` but now gets `971`, plus a new
`Siphon Healing: 968` line and a changed leading description string. Looks like a curated-coefficient
or raw-fact-text drift on this skill, not yet root-caused.
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

### [Adrenal Health Healing Coefficient] — Leg 1
Found while investigating trait 1348 (Warrior Defense minor) for Known Exceptions Sweep Leg 8: its
base healing-per-stack has a real, wiki-documented coefficient (0.6/0.9/1.2 scaling by adrenaline
stage — see `docs/investigations/sep-29-2026-patch-changes.md`'s Leg 8 section for the exact
reference numbers) that was never added to `CURATED_HEALING_COEFFICIENTS`/
`CURATED_TRAIT_HEALING_COEFFICIENTS` in `healing-calc.ts`. Pre-existing gap, unrelated to the
2026-09-29 patch that surfaced it.
Last touched: 2026-09-29. Re-checks: 0.

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

Leg 8 (2026-09-29): Sapping Device (trait 507, Engineer) — its Weakness-on-disable/immobilize was
never modeled in the boon/condition aggregate calculator (pre-existing gap, unrelated to this
patch's added 8s internal cooldown), and "on disable" is an unbounded, combat-dependent trigger with
no fixed cadence to assume, same shape as Relic of Karakosa's COMBO-bucket exclusion above. No
ICD-tracking mechanism exists for trait Buff applications the way relics have `rechargeSeconds`.
Full scoping: `docs/investigations/sep-29-2026-patch-changes.md`.

## Reference — not scheduled

- **Future stat-family candidates** — never-modeled stat-family shapes (per-condition-type
  damage-%, self-stacking buffs, target-status-stack-count, per-skill-category, weapon-type-scoped,
  and more) found during the Outgoing Damage % and data-completeness sweeps. Each affects only 1-4
  skills/traits, not worth building dedicated infra for on its own. Revisit only if a future sweep
  needs the same shape for more candidates: `docs/investigations/future-stat-family-candidates.md`
  and `docs/investigations/data-completeness-gap-shapes.md`.
