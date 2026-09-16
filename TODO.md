# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Current Milestone: Sep 15, 2026 patch + fixes

### [New Relic Coefficient Curation] — Leg 3
The Sep 15, 2026 patch added 6 new relics (Lantern, Last Tyrant, Eternal Alchemy, Tyrian Hero,
Curator, Visionary). Leg 1 (2026-09-16) closed Tyrian Hero and Curator. Leg 2 (2026-09-16)
reconfirmed the remaining 4 (Lantern, Last Tyrant, Eternal Alchemy, Visionary) still have no
`{{Relic infobox}}` wiki page. User is now supplying live in-game WvW tooltip readings for these
directly (one relic at a time), curated via a new `synthetic-relic-effects.json` overlay (same
shape as `synthetic-facts.json`, merged in `build-game-data.ts` — see `docs/game-data.md`'s
"Relics with no wiki page yet" section). Lantern (109936) is done: Reveal 6s, 5 targets, 600
radius, 20s ICD. Last Tyrant (109942) is done: Damage coefficient 0.399 (derived from 2 Power
readings, tight-bounded interval), Burning 1 stack/8s (corroborated against the existing
`CONDITION_DAMAGE_FORMULAS.Burning` constant — see `synthetic-relic-effects.test.ts`'s doc
comment), Maximum Stacks 5, 5 targets, 240 radius, 12s ICD. Not wired into
`RELIC_TRIGGER_GATES`/`RELIC_NAMED_FACT_SOURCES` — its explosion trigger (5 stacks of Tyrant's Fury
from the player's own other burning applications) is a conditional, rotation-dependent trigger with
no fixed frequency, same non-deterministic-trigger exclusion class documented on `RelicEffect`
elsewhere. Eternal Alchemy (109980) is done: Healing base 37 + 0.023 Healing Power coefficient
(derived from 2 Healing Power readings, exact match), no ICD (user-confirmed, fires on every
self-boon grant). Still needed: Visionary.
Last touched: 2026-09-16. Re-checks: 0.

### [Tyrian Hero Superspeed Breakdown Tooltip Overlap] — Leg 1
User-flagged 2026-09-16, in-app screenshot. The Superspeed breakdown tooltip (hover the Superspeed
icon in the build editor's boon/condition panel) renders Tyrian Hero's row with overlapping/garbled
text ("Up2s55" instead of "Up to 5" + "2.5s (on Shout or Command skill use)"). Root cause:
`NamedFactSource.targetCount` (`sources.ts:5516`) is documented as "only actually populated for
matcher names present in `NAMED_FACT_TARGET_COUNT_TABLES` (currently just Cleanse) — null for every
other name" — but `computeRelicNamedFactSources` (`sources.ts:6086`) doesn't respect that
invariant: it always reads the relic's own `targets` fact regardless of `entry.name`, so Tyrian
Hero's Superspeed row is the first non-Cleanse named fact to ever carry a non-null `targetCount`.
The renderer/CSS (`BoonConditionSummaryPanel.tsx`'s `namedFactIconItemsFor`) was never exercised
with both a `targetCount` badge and a long `detail` string on the same line, which is what's
overlapping. Fix needs a decision: either gate `computeRelicNamedFactSources`'s targetCount the
same way the skill/trait pipeline does (drop it for non-Cleanse names, simplest, matches the
documented invariant), or fix the layout to handle both fields together (needed anyway if a future
relic hits the same shape).
Last touched: 2026-09-16. Re-checks: 0.

## Unscheduled

### [In-Game Coefficient Verification Queue] — Leg 4
User is working through live in-game tooltip screenshots to resolve wiki/API coefficient
mismatches on `CURATED_HEALING_COEFFICIENTS`/`CURATED_SIPHON_DAMAGE_COEFFICIENTS`, one at a time.
Queued next: Thief 72991 (Shadow Veil, Spear) and Thief 13113 (Black Powder); Thief 73063
(Vampiric Slash) was added 2026-08-29 as a strong pattern-match candidate. Full per-skill history
and the resolution method: `docs/investigations/coefficient-verification-queue.md`.
Blocked: waiting on the user's next live in-game screenshot(s) for the queued skills.
Last touched: 2026-08-29. Re-checks: 1.

### [Cosmic Wisdom Assassin-form Baseline Correction] — Leg 1
`boon-calc/sources.ts`'s Cosmic Wisdom Assassin-form entry (`baseValue: 1028`) likely uses the
wiki's inflated PvE-quoted number rather than the true API PvE value (968), based on a pattern
confirmed on 6 other Siphon Damage skills. Not changed yet — Cosmic Wisdom's own mode/formula
wasn't directly tested, only inferred by pattern. Full reasoning:
`docs/investigations/coefficient-verification-queue.md`.
Blocked: needs a direct live in-game verification of Cosmic Wisdom's own formula, same as the
In-Game Coefficient Verification Queue leg above.
Last touched: 2026-08-23. Re-checks: 0.

### [Healing/Damage Coefficient Tables Visual Spot-Check] — Leg 1
Neither `CURATED_HEALING_COEFFICIENTS` nor `CURATED_DAMAGE_COEFFICIENTS` has been visually
spot-checked in the running Electron app (sandbox limitation blocks screenshotting from this shell
— see the `electron_sandbox_limitation` memory). Do this before extending either table further.
Blocked: needs the user to manually verify in the running app; this shell can't screenshot Electron.
Last touched: 2026-08-22. Re-checks: 0.

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

- **Necromancer 69302 (Life Siphon)** — re-checked 2026-08-23 with 2 live WvW readings; still
  unresolved. Healing Power confirmed 0 in both readings, yet the displayed value moved with Power
  — may be another Barrier-style API target mislabeling (genuinely Power-scaled, not
  Healing-Power-scaled). **Needs a decision**: keep chasing with more live readings under a
  different hypothesis, or accept the API value as-is and stop investigating.
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
