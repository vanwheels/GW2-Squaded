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

- **Thief 72991 (Shadow Veil, Spear)** — two identical-factText Healing facts exist; only one
  (1290) has a documented wiki coefficient (0.5). The other (2570) is undocumented and its
  relationship to the first — a PvE/WvW split of the same quantity, or a genuinely different
  quantity like a multi-block total — can't be determined from the wiki page alone, which declares
  `split = pve, wvw pvp` but only gives one mode-agnostic skill fact template. The healing-coeff
  table matches by factText alone, so curating the known half risks binding to the wrong fact.
  Needs a live reading to disambiguate.
- **Thief 13113 (Black Powder)** — only exposes its PvE/PvP-grouped initiative value; no
  live-API-sourced fact pairs with the wiki's explicit WvW-only cost (7). This is the Assassin's
  Reward (trait 1238) sweep's other leftover alongside Helmet Breaker (see Known Exceptions below).
- **Thief 73063 (Vampiric Slash)** — re-checked 2026-08-29: a fresh wikitext pull found
  base=1210 (API) / coefficient=0.2 (wiki), and 1210 + 0.2×1000 = 1410, an exact match to the
  wiki's quoted 1410 — the same base-1000-Power pattern that resolved the 6 skills above. A strong
  candidate, but not curated on pattern-matching alone; queued for a live reading instead of
  guessed. Unrelated to Death Spiral despite similar flavor text (Vampiric Slash carries its own
  explicit wiki stub tag).

## Flagged, not yet fixed

- **Cosmic Wisdom Assassin-form entry** (`boon-calc/sources.ts`, `baseValue: 1028`) — taken from
  this skill's own wiki-quoted *PvE* number. Given the base-1000-Power pattern confirmed on 6 other
  Siphon Damage skills, this is likely inflated the same way and should probably read 968 (the PvE
  API value) instead. Not changed yet — Cosmic Wisdom's own mode/formula wasn't directly tested,
  only inferred by pattern from unrelated skills. Flagged 2026-08-23 for a follow-up pass.

## Known Exceptions — investigated, needs a user decision

- **Necromancer 69302 (Life Siphon)** — wiki documents coefficients 0.082 PvE / 0.036 WvW+PvP,
  paired with base values 450/300 that don't match this app's API-sourced values 537/238 under
  either mode ordering. 2 live WvW readings taken 2026-08-23 didn't resolve it: Healing Power was
  confirmed 0 in both, yet the displayed value still moved with Power — suggesting this may be
  another Barrier-style API target mislabeling, genuinely Power-scaled rather than
  Healing-Power-scaled. Re-checked twice (original discovery + the 2026-08-23 live-reading attempt)
  with no resolution. **Needs a decision**: keep chasing with more live readings under a different
  hypothesis, or accept it as permanently uncurated.

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
Weapon, and 15 of 17 Assassin's Reward (trait 1238) candidates were all resolved via this same
method (live in-game readings and/or wiki `split=`/resource-field disambiguation) and are already
curated in `healing-calc.ts` / `siphon-damage-calc.ts`. See COMPLETED.md for the per-skill sessions
and the `healing_damage_coefficient_curation` / `siphon_damage_sweep_2026-08-20` /
`coefficient_curation_leftovers_sweep_2026-08-22` memories for the fuller narrative.
