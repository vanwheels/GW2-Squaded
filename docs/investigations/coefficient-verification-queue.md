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

- **Elementalist trait 351 (Healing Ripple)** — investigated 2026-09-29 as part of Known Exceptions
  Sweep Leg 3 (Overload Water, the leg's other half, resolved cleanly — see COMPLETED.md). Wiki-
  verified WvW values (raw wikitext, `action=raw`): base 1042, coefficient 0.75 (matches the Sep
  29 patch's "0.5 -> 0.75" per the official patch notes; the trait's own wiki page happens to
  already show 0.75, either pre-emptive datamined content or a merge of a previously-diverged WvW
  value back to parity with PvP — either way, patch notes + current wiki text agree on the
  post-patch number). Live API confirms the WvW base (1042) via `NUMERIC_FACT_WVW_OVERRIDES`
  (`fact-numbers.ts:1590`), already pinned before this leg.
  Blocking discovery: `CURATED_HEALING_COEFFICIENTS` (`healing-calc.ts`) is **skill-id-keyed only**
  and is never consulted for traits — confirmed via `skill-fact-lines.ts`'s own doc comment ("Only
  used for skills, not traits (`TraitsEditor.tsx` keeps using `numericFactLines` directly) — every
  curated table here is keyed by skill id only, so a trait fact never has a real-value match here
  anyway"). `TraitsEditor.tsx` only calls `numericFactLines`, which substitutes the correct WvW
  *base* number (already done, see above) but never applies a Healing Power coefficient — that
  math exists nowhere in the trait-tooltip code path. This isn't specific to Healing Ripple: **no
  trait anywhere in this codebase ever gets a live-scaled healing tooltip number**, only skills do.
  Adding a `healing-calc.ts` entry keyed by trait id 351 would be inert — never read by anything.
  Closing this properly would mean building a new parallel mechanism (a trait-keyed healing-
  coefficient table plus wiring `numericFactLines`/`TraitsEditor.tsx` to consult it) — new
  infrastructure for a single candidate, not the "same file/shape as the resolved precedent" Leg 3
  assumed. Same category of decision as Leg 5 (Tree Song's resource-cost table) and Leg 6
  (Reaver's Curse's per-skill-mapping gap): needs Vanny to decide whether building trait-healing-
  coefficient infra is worth it now, or whether this stays a known gap.

## Known Exceptions — investigated, permanently excluded (settled, don't re-investigate)

- **Guardian 31295 (Sanctuary, underwater variant)** — a frozen pre-2016-balance-pass copy of id
  9128; no wiki coefficient documented for it specifically, and it doesn't appear on any wiki skill
  page at all (`insource:"31295"` search only hits an unrelated item id collision). Underwater is
  out of scope for WvW anyway. Re-confirmed 2026-08-22, then again 2026-09-29 (fresh `insource`
  search still only hits the same item-id collision; local API's own base value for 31295, 266,
  unchanged and still doesn't map to any wiki-documented coefficient).
- **Necromancer 10547 (Summon Blood Fiend)** — wiki's own Notes confirm 0 Healing Power/
  non-scaling, but its 926 wiki base vs. 510 API base still don't reconcile. Moot either way since
  coefficient 0 means curating would be a no-op at best. Re-confirmed 2026-09-29: fresh wikitext
  pull still shows 926/non-scaling, local API base still 510, no change.
- **Necromancer 10670 (2nd Well of Blood id)** — confirmed a frozen legacy duplicate carrying stale
  pre-2023-11-28-patch numbers, not a genuine Scourge variant as originally guessed. Nothing
  reliable to curate it to. Re-confirmed 2026-09-29: wiki infobox still lists `id = 10527, 10670`
  as one canonical pair, current WvW/PvP pulse heal on the wiki is 496 (post-patch), while id
  10670's own local API value is still the stale pre-patch 280 — same gap, unchanged.
- **Thief 71802 (Helmet Breaker)** — Assassin's Reward (trait 1238) sweep leftover. Its own facts
  don't fit any combo/solo interpretation even checking every historical cost patch on both chain
  skills (Debilitating Arc's own Healing facts turned out to be the full Debilitating-Arc→
  Helmet-Breaker combo total, not its own solo cost, which is what made this one hard to isolate).
  Re-confirmed 2026-09-29: fresh raw wikitext for both Debilitating Arc and Helmet Breaker shows
  neither page documents any Healing skill fact at all (only Damage/Crippled/Daze/Evade) — the
  Healing values in play come solely from the app's local API `traitedFacts` (Assassin's Reward's
  `requires_trait` interaction), which the wiki has no visibility into at all. Confirms this was
  never a "wiki hasn't caught up" gap; there's no wiki source to reconcile against, full stop.
- **Soul Grasp** — a different formula shape (weapon-strength-based) rather than a coefficient gap;
  API-mislabeled the same way Barrier's target-mislabeling problem works. Reconfirmed 2026-08-29,
  and again 2026-09-29 — fresh wikitext pull still shows the same
  `{{skill fact|life siphon damage|weapon=focus|coefficient=...}}` shape with no literal base
  number, local API still mislabels the fact `AttributeAdjust`/`target: 'Power'`. Unchanged.
- **Grim Specter, Carnivore, Replenishing Despair** — structurally unreachable: Grim Specter is an
  orphan id, Carnivore/Replenishing Despair are shared-trait "effect skills" (same exclusion shape
  as Assassin's Reward's own trait-gated facts), not real standalone skills to curate. Re-confirmed
  2026-09-29: all 3 still have `professions: []` in the local API. Checked Grim Specter (10632)
  specifically against its wiki-documented parent, Lich Form (10550) — the wiki confirms Grim
  Specter is Lich Form's real weapon-slot-5 skill, but the local API's Lich Form entry has no
  `bundleSkills`/`flipSkill` link to it at all (unlike newer transforms), so it's genuinely
  unreachable from this app's data pipeline, not a data-quality bug to fix. Carnivore/Replenishing
  Despair's wiki titles now resolve to their granting traits (ids 1094/1741) rather than the effect
  skills — consistent with the existing "shared trait formula" conclusion, not a contradiction of
  it.

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
