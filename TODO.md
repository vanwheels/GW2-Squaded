# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Current Milestone: Thief Pass + Celestial Fix

Started as five independent Specter-only display/mechanics bugs reported by the user in one batch
(2026-09-20); expanded to the rest of the thief-wide gaps surfaced during that same investigation
pass, plus one unrelated Celestial stat-prefix data fix folded in since it was quick to schedule
alongside. Bundled under one milestone for scheduling convenience, not because every leg shares a
root cause — each leg gets its own investigation. Original Specter batch legs 1-4 done; Leg 5 not
yet root-caused; Triple Threat/Twilight Combo done; the three legs below are untouched.

### [Deadeye's Mark/Skritt Swipe Stale Even the Odds Vulnerability] — Leg 1
Surfaced while completing the Steal/Siphon trait-granted-facts follow-up (see COMPLETED.md "Specter
Siphon F1 Effects"): Deadeye's Mark (43390) and Skritt Swipe (77397) both carry a native
Vulnerability `traitedFact` (requires_trait 1169, Even the Odds) with a STALE pre-2024-10-08-patch
value (duration 10s/5 stacks) instead of the current wiki value (duration 6s/10 stacks) that core
Steal (13014) already has correct natively. Fixing it needs a `BUFF_INSTANCE_VALUE_OVERRIDES.skill`
`'omit'` entry for the stale occurrence plus a fresh correct entry via `synthetic-facts.json` (a
plain duration-only override can't fix it — apply_count is wrong too, same "plain override only
replaces duration" shape documented elsewhere in `sources.ts`). Not fixed in that pass since it's
Deadeye/Antiquary-specific data staleness, not a missing trait-fact gap like everything else that
leg covered.
Last touched: 2026-09-20. Re-checks: 0.

### [Specter Siphon F1 Recharge Split] — Leg 1
Surfaced while curating Siphon (F1)'s ally/enemy effects (see COMPLETED.md): the wiki's raw
infobox splits Siphon's Recharge as `recharge = 18` (PvE) vs. `recharge pvp = 25`/
`recharge wvw = 25`, but this app's local API data for skill 63067 has a flat, unsplit `Recharge:
18` fact (stale, copied from core Thief's "Steal") that the base facts block renders as-is for
every game mode. Standalone data-accuracy gap, unrelated to the effects-display bug that was
actually reported — quick fix once picked up (likely a `NUMERIC_FACT_WVW_OVERRIDES` entry in
`fact-numbers.ts`, same mechanism used for other flat-vs-split Recharge/Number facts).
Last touched: 2026-09-20. Re-checks: 0.

### [Celestial Stat Prefix Concentration/Expertise] — Leg 1
The Celestial stat prefix currently grants Concentration and Expertise; that was removed from
Celestial's stat spread a while back in-game and the app hasn't been updated to match. Standalone,
unrelated to the thief legs above — quick data fix once picked up.
Last touched: 2026-09-20. Re-checks: 0.

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

## Known Exceptions

Investigated and deliberately left open or excluded — don't re-investigate without new
information. Full history: `docs/investigations/coefficient-verification-queue.md`.

- Guardian 31295 (Sanctuary, underwater) — id doesn't exist on the wiki at all; underwater is out
  of scope for WvW anyway. Permanently uncurated.
- Necromancer 10547 (Summon Blood Fiend), 10670 (2nd Well of Blood id) — non-scaling/stale-legacy
  respectively; nothing reliable to curate either to.
- Thief 71802 (Helmet Breaker) — no combo/solo interpretation of its own facts fits, across every
  historical cost patch checked.
- Soul Grasp — a different formula shape (weapon-strength-based, API-mislabeled the same way
  Barrier's mislabeling works), not a coefficient gap; reconfirmed 2026-08-29, same conclusion.
- Grim Specter, Carnivore, Replenishing Despair — structurally unreachable (orphan id /
  shared-trait "effect skills"), not real standalone skills to curate.

## Reference — not scheduled

- **Future stat-family candidates** — never-modeled stat-family shapes (per-condition-type
  damage-%, self-stacking buffs, target-status-stack-count, per-skill-category, weapon-type-scoped,
  and more) found during the Outgoing Damage % and data-completeness sweeps. Each affects only 1-4
  skills/traits, not worth building dedicated infra for on its own. Revisit only if a future sweep
  needs the same shape for more candidates: `docs/investigations/future-stat-family-candidates.md`
  and `docs/investigations/data-completeness-gap-shapes.md`.
