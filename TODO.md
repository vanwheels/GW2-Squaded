# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.
Deep investigation history (cross-checks, historical readings, per-attempt reasoning) lives in
`docs/investigations/`; items below link out to it rather than carrying it inline.

v1.0.0 shipped 2026-08-15 (see COMPLETED.md). README roadmap items 1-4 (scaffolding, build editor +
boon/condition calculator, squad preview builder, sync/share backend) plus the Discord bot are all
implemented and released. Everything below is post-1.0 polish and open curation gaps.

## Open Items

### [In-Game Coefficient Verification Queue] — Leg 4
User is working through live in-game tooltip screenshots to resolve wiki/API coefficient
mismatches on `CURATED_HEALING_COEFFICIENTS`/`CURATED_SIPHON_DAMAGE_COEFFICIENTS`, one at a time.
Queued next: Thief 72991 (Shadow Veil, Spear) and Thief 13113 (Black Powder); Thief 73063
(Vampiric Slash) was added 2026-08-29 as a strong pattern-match candidate. Full per-skill history
and the resolution method: `docs/investigations/coefficient-verification-queue.md`.
Last touched: 2026-08-29. Re-checks: 1.

### [Cosmic Wisdom Assassin-form Baseline Correction] — Leg 1
`boon-calc/sources.ts`'s Cosmic Wisdom Assassin-form entry (`baseValue: 1028`) likely uses the
wiki's inflated PvE-quoted number rather than the true API PvE value (968), based on a pattern
confirmed on 6 other Siphon Damage skills. Not changed yet — Cosmic Wisdom's own mode/formula
wasn't directly tested, only inferred by pattern. Full reasoning:
`docs/investigations/coefficient-verification-queue.md`.
Last touched: 2026-08-23. Re-checks: 0.

### [Healing/Damage Coefficient Tables Visual Spot-Check] — Leg 1
Neither `CURATED_HEALING_COEFFICIENTS` nor `CURATED_DAMAGE_COEFFICIENTS` has been visually
spot-checked in the running Electron app (sandbox limitation blocks screenshotting from this shell
— see the `electron_sandbox_limitation` memory). Do this before extending either table further.
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
