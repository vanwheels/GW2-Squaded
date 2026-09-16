# Coefficient verification queue — investigation history

Deep history behind TODO.md's "In-Game Coefficient Verification Queue" and "Cosmic Wisdom
Assassin-form Baseline Correction" items, and the coefficient-curation Known Exceptions. Covers
`CURATED_HEALING_COEFFICIENTS`, `CURATED_DAMAGE_COEFFICIENTS`, and
`CURATED_SIPHON_DAMAGE_COEFFICIENTS`. See also the
[ingame_coefficient_verification_checklist_2026-08-23] memory, which the user drives directly with
live in-game screenshots.

## Method established

Several skills' wiki-quoted base values turned out inflated by exactly `coefficient * 1000`
relative to the API's true base — i.e. the wiki quotes the tooltip at 1000 Power/Healing Power
rather than 0. This "wiki quotes the tooltip at base-1000-Power" pattern resolved 6 mismatches
outright once spotted (Enchanted Daggers, Locust Swarm, Signet of Vampirism x2, Death Spiral,
Nightmare Weapon — all confirmed 2026-08-23 via live in-game WvW readings, all landed on the API's
raw base value, not the wiki's). It's now the first thing checked against any new base/coefficient
mismatch before queuing a skill for live verification.

## Active queue (next up for live verification)

Empty as of 2026-09-16 — Shadow Veil, Black Powder, and Vampiric Slash (the last 3 queued skills)
are all resolved; see "Resolved precedent" below. No new candidates queued yet.

## Known Exceptions — investigated, needs a user decision

Empty as of 2026-09-16 — Necromancer 69302 (Life Siphon), the last item here, is now resolved; see
"Resolved precedent" below.

## Known Exceptions — investigated, permanently excluded (settled, don't re-investigate)

- **Guardian 31295 (Sanctuary, underwater variant)** — a frozen pre-2016-balance-pass copy of id
  9128; no wiki coefficient documented for it specifically, and it doesn't appear on any wiki skill
  page at all (`insource:"31295"` search only hits an unrelated item id collision). Underwater is
  out of scope for WvW anyway. Re-confirmed 2026-08-22.
- **Necromancer 10547 (Summon Blood Fiend)** — wiki's own Notes confirm 0 Healing Power/
  non-scaling, but its 926 wiki base vs. 510 API base still don't reconcile. Moot either way since
  coefficient 0 means curating would be a no-op at best.
- **Necromancer 10670 (2nd Well of Blood id)** — confirmed a frozen legacy duplicate carrying stale
  pre-2023-11-28-patch numbers, not a genuine Scourge variant as originally guessed. Nothing
  reliable to curate it to.
- **Thief 71802 (Helmet Breaker)** — Assassin's Reward (trait 1238) sweep leftover. Its own facts
  don't fit any combo/solo interpretation even checking every historical cost patch on both chain
  skills (Debilitating Arc's own Healing facts turned out to be the full Debilitating-Arc→
  Helmet-Breaker combo total, not its own solo cost, which is what made this one hard to isolate).
- **Soul Grasp** — a different formula shape (weapon-strength-based) rather than a coefficient gap;
  API-mislabeled the same way Barrier's target-mislabeling problem works. Reconfirmed 2026-08-29,
  same conclusion both times.
- **Grim Specter, Carnivore, Replenishing Despair** — structurally unreachable: Grim Specter is an
  orphan id, Carnivore/Replenishing Despair are shared-trait "effect skills" (same exclusion shape
  as Assassin's Reward's own trait-gated facts), not real standalone skills to curate.

## Resolved precedent (for context, already shipped — see COMPLETED.md)

Guardian 62669 (Repose), Engineer 63049 (Rectifier Signet/Mech Core: J-Drive), Revenant 26937
(Enchanted Daggers' Initial Heal), Elementalist 72982 (Jökulhlaup), Necromancer 30860 (Death
Spiral, both Healing and Damage facts), Locust Swarm, Signet of Vampirism (both facts), Nightmare
Weapon, Thief 72991 (Shadow Veil), Thief 13113 (Black Powder), Thief 73063 (Vampiric Slash), and 16
of 17 Assassin's Reward (trait 1238) candidates were all resolved via this same method (live
in-game readings and/or wiki `split=`/resource-field disambiguation) and are already curated in
`healing-calc.ts` / `siphon-damage-calc.ts`. See COMPLETED.md for the per-skill sessions
and the `healing_damage_coefficient_curation` / `siphon_damage_sweep_2026-08-20` /
`coefficient_curation_leftovers_sweep_2026-08-22` memories for the fuller narrative.

Cosmic Wisdom's own Assassin-form Life Siphon Damage entry (`boon-calc/sources.ts`, id 78971 — no
API resolution at all) is a related but distinct case: RESOLVED 2026-09-16 via 2 live in-game WvW
readings (2,704 Power -> 1072 damage; 2,304 Power -> 1049 damage), but NOT via the base-1000-Power
pattern above — the pattern-based guess (968, this skill's own PvE base) was directly tested and
rejected outright (predicted slopes didn't match, unlike every other skill on this list). The
readings solved instead to `baseValue: 917`/`coefficient: 0.0575` — see `siphon-damage-calc.ts`'s
top comment and `sources.ts`'s own comment on the entry for the full derivation.

**Necromancer 69302 (Life Siphon)** — RESOLVED 2026-09-16 after 3 prior re-checks (original
discovery, the 2026-08-23 live-reading attempt, and a same-day fresh wikitext re-pull). The wiki
documents 450 PvE/0.082 and 300 WvW+PvP/0.036, neither matching this app's API-sourced base values
537/238; a 2026-08-23 reading pair (Power 2,678 -> 2,786, Healing Power pinned at 0) showed the
heal moving 238 -> 249 anyway, suggesting a Barrier-style Power-mislabeling. The 2026-09-16 wikitext
re-pull (revision 3178287, unchanged) argued against that theory instead — the Pulse Heal facts use
the plain `{{skill fact|healing|...}}` template with no `scaling=power-only` marker (contrast
Battle Scarred, trait 1755, which does carry that marker on its genuinely Power-scaled sibling
fact), and the page's own Mechanics section explicitly denies true damage-derived lifesteal.
Settled by a targeted follow-up reading instead of more reasoning: Power pinned at 1,810, Healing
Power varied 376 -> 957, heal moved 276 -> 334 — solves cleanly to `baseValue: 238`/`coefficient:
0.1` (238 exactly matches this app's own already-stored API base; 0.1 replaces the wiki's stale-
looking 0.036). This confirms the fact genuinely is Healing-Power-scaled after all; the 2026-08-23
Power-varied pair's movement is unexplained (most likely an unrecorded confound, e.g. Healing Power
not actually pinned at 0) but is superseded by the cleaner, internally-consistent pair. See
`healing-calc.ts`'s own entry (id 69302) for the full derivation notes.
