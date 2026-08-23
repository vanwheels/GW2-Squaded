import type { Fact, Skill } from '../types'

/**
 * A single wiki-verified `AttributeAdjust` Life Siphon Damage fact: `Damage = baseValue +
 * coefficient * Power`, quoted from the skill's own wiki `{{skill fact|life siphon damage|...|
 * coefficient=...}}` template — same shape and rigor bar as `CURATED_HEALING_COEFFICIENTS`/
 * `CURATED_BARRIER_COEFFICIENTS` (see `healing-calc.ts`'s own doc comment, which this mirrors).
 * A genuinely different fact TYPE (`AttributeAdjust`, `target: 'Power'`) from the ordinary
 * weapon-Damage-fact shape `CURATED_DAMAGE_COEFFICIENTS`/`damage-calc.ts` models (`weaponStrength *
 * coefficient * Power / targetArmor`) — first identified as a real, recurring, previously-uncurated
 * shape by the 2026-08-20 Cosmic Wisdom curation (see `boon-calc/sources.ts`'s
 * `LegendFormEffectDetail`'s own `'siphonDamage'` kind, which this table generalizes into a normal
 * per-skill lookup the way `CURATED_HEALING_COEFFICIENTS` already does for the sibling Healing
 * formula).
 *
 * `factText` matches a fact's `text` field by presence only, not by cross-checking `fact.value`
 * against `baseValue` — same convention as `HealingCoefficient`/`BarrierCoefficient` (see their own
 * doc comments) — since several of these skills carry 2-3 same-text duplicate facts representing
 * different game-mode variants of one displayed line, and only the WvW-correct pair's numbers need
 * to be stored here regardless of which literal duplicate `Array.find` happens to match.
 */
export interface SiphonDamageCoefficient {
  factText: string
  baseValue: number
  coefficient: number
  /** Set only when the wiki-documented value corresponds to a `requires_trait`-gated fact rather
   *  than the skill's ungated one — same purpose as `HealingCoefficient.requiresTrait`/
   *  `BarrierCoefficient.requiresTrait`. Unused by any entry in this table today (no candidate this
   *  sweep found needed it), kept for shape-parity with the sibling tables. */
  requiresTrait?: number
}

/**
 * Seeded 2026-08-20 — the "Life Siphon Damage sweep" TODO.md nice-to-have, closing the gap the
 * Cosmic Wisdom curation surfaced the same day (see TODO.md/COMPLETED.md): a fresh `skills.json` scan
 * for every `AttributeAdjust`/`target: 'Power'` fact found 27 facts across 14 skill ids (matching the
 * TODO item's own "27 facts across ~15 skills" estimate; one candidate the earlier scan implicitly
 * counted, `Blood Frenzy` id 12424, turned out to be an unreachable `type: 'Monster'` skill with no
 * `professions` and an undefined fact `value` — not a real player-facing candidate, excluded from the
 * 14). Researched via each skill's own raw wikitext (never a paraphrased fetch, same rigor bar as
 * every prior coefficient sweep), cross-checked against this app's own local API `value` for every
 * candidate. Of the 14:
 *
 * **4 landed in the table below** — `Soulcleave's Summit`/`Hungering Maelstrom`/`Soul Shards`/
 * `Xinrae's Weapon` — each because this app's own API-sourced `baseValue` matches the wiki's own
 * quoted `{{skill fact}}` number for the WvW-correct mode either exactly or within a 1-point rounding
 * gap (Soul Shards' WvW pair: API 606 vs wiki 605 — the same "negligible, not a real conflict" bar
 * `CURATED_HEALING_COEFFICIENTS`'s Cleansing Wave entry already established for a 2-point gap).
 *
 * **Locust Swarm, Signet of Vampirism (both facts), Death Spiral, Nightmare Weapon — all 5 candidates
 * RESOLVED 2026-08-23** via live in-game WvW readings (2 Power-differentiated readings per skill; see
 * the in-game-verification checklist memory). Every one of them turned out to follow the same pattern
 * Enchanted Daggers established below: the API's own raw `value` field, taken as-is as `baseValue`,
 * reproduces both live readings exactly once the right coefficient is solved for — confirmed via an
 * interval check (does *some* coefficient exist that rounds both readings correctly for that fixed
 * base?), not just a single-point guess. Locust Swarm: base=37/coefficient=0.08 (matches the API,
 * wiki's 117 was wrong — and coincidentally the exact same base/coefficient pair as this skill's own
 * already-curated `CURATED_HEALING_COEFFICIENTS` Life Siphon Healing entry's untraited PvE half,
 * suggesting Locust Swarm's damage-to-target and heal-to-self are the literal same formula). Signet of
 * Vampirism: Passive Life-Siphon Damage base=129/coefficient=0.022 and Active Life Siphon Damage
 * base=163/coefficient=0.084 (both API raws confirmed correct, wiki's 151/247 were wrong). Death
 * Spiral (previously blocked entirely on the wiki's own `{{stub||missing siphon coefficients}}` tag —
 * no coefficient documented anywhere): base=1764/coefficient=0.005, live-derived with no wiki
 * involvement at all. Nightmare Weapon (also wiki-stub-tagged for its WvW/PvP half specifically):
 * base=606/coefficient=0.025 — notably the same base as this skill's own already-curated Life Siphon
 * Healing fact (606), though the coefficients differ (0.025 damage vs 0.15 healing), so it's not a
 * fully shared formula the way Locust Swarm's is. All 4 skills are Necromancer; Nightmare Weapon's own
 * code comment elsewhere in this codebase previously mis-attributed it to Harbinger — it's actually a
 * Ritualist utility skill (confirmed both by the live screenshot's character panel and this app's own
 * `specializations.json`, which already has Ritualist modeled — not a data gap, just a stale comment).
 *
 * **Enchanted Daggers (API 968/808 vs wiki 1028/858, both modes) — RESOLVED 2026-08-23.** 2 live
 * in-game readings at known Power (2,771 Power -> 947 Siphon Damage; 1,214 Power -> 869 Siphon
 * Damage) solve directly to base=808/coefficient=0.05 (predicts 946.55 -> rounds to 947, and
 * 868.7 -> rounds to 869 — both exact matches), confirming the WvW-mode API value (808) is correct
 * and the wiki's 858 was the stale/wrong side of the `+coefficient*1000` coincidence, not the API.
 * The same in-game pass also confirmed this skill's `Initial Heal`/`Siphon Healing` facts (see
 * `CURATED_HEALING_COEFFICIENTS`'s own comment on this skill) — worth revisiting
 * `boon-calc/sources.ts`'s `LEGEND_FORM_EFFECT_DETAILS` Assassin-form entry (`baseValue: 1028`,
 * the WIKI's quoted PvE number) in light of this: if Enchanted Daggers' own PvE fact (968) follows
 * the same "API is correct, wiki added a spurious +1000*coefficient" pattern this WvW reading just
 * confirmed, that entry is likely inflated and should probably read 968 instead — not changed here
 * since Cosmic Wisdom's own formula/mode wasn't part of this verification pass.
 *
 * **1 stayed uncurated on an explicit wiki maintenance tag** — Vampiric Slash (Thief, id 73063 — a
 * different skill from the Necromancer/Reaper "Death Spiral" resolved above, despite the similar
 * flavor text) carries its own stub tag (`{{stub|skill|Need better calculation of base life siphon
 * damage}}`) with a single flat coefficient that reproduces the same unresolved `+coefficient*1000`
 * pattern above (API 1210 vs wiki 1410) — doubly unreliable, left out on both grounds; not yet
 * live-verified.
 *
 * **1 stayed uncurated as a different formula shape entirely** — Soul Grasp: the wiki's own
 * `{{skill fact|life siphon damage|weapon=focus|coefficient=...}}` template has no literal base
 * number at all, only a `weapon=` parameter — the same template shape `CURATED_DAMAGE_COEFFICIENTS`/
 * `damage-calc.ts` models via the ordinary weapon-strength formula, not this table's
 * `baseValue + coefficient * Power` one. This app's local API still mislabels the fact
 * `AttributeAdjust`/`target: 'Power'` (matching every other candidate in this sweep) rather than the
 * `Damage` type `damageLinesForSkill` actually reads, so neither table can reach it without new
 * routing — same shape as Barrier's own API mislabeling problem (`barrier-calc.ts`'s top comment),
 * just a different pair of tables. Not built here — out of scope for this sweep.
 *
 * **3 are structurally unreachable, not a real gap** — Grim Specter (`professions: []`, no
 * trait/skill anywhere in this app's local data references it — a genuine dead orphan id, same shape
 * as `CURATED_HEALING_COEFFICIENTS`'s Natural Harmony orphan) and Carnivore/Replenishing Despair
 * (both `professions: []` too, but each is the separate "effect skill" a real MAJOR TRAIT — Ranger's
 * Carnivore id 1094, Necromancer's Replenishing Despair id 1741 — grants; same "shared trait formula,
 * not a per-skill design" shape already excluded throughout `CURATED_HEALING_COEFFICIENTS`'s Weapon-
 * slot section for Thief's Assassin's Reward, since `TraitsEditor.tsx` reads trait facts via
 * `numericFactLines` directly, never through this skill-id-keyed table — see `skill-fact-lines.ts`'s
 * own top comment).
 */
export const CURATED_SIPHON_DAMAGE_COEFFICIENTS: Record<number, SiphonDamageCoefficient[]> = {
  // Revenant — Enchanted Daggers (Legendary Assassin). 2 identical-text "Siphon Damage" facts
  // (PvE 968, WvW/PvP 808) with no `requires_trait` to disambiguate — resolved via live in-game
  // testing 2026-08-23 (see this file's top comment); WvW value used, per this table's convention.
  26937: [{ factText: 'Siphon Damage', baseValue: 808, coefficient: 0.05 }],
  // Revenant — Soulcleave's Summit (Renegade Elite). Base value unchanged across modes but the
  // coefficient itself splits (PvE 0.1 vs WvW+PvP 0.04, both share base 325) — WvW value used, same
  // "coefficient-only split" shape already curated for this skill's own Healing facts.
  45773: [{ factText: 'Life Siphon Damage', baseValue: 325, coefficient: 0.04 }],
  // Necromancer — Locust Swarm. Resolved via live in-game WvW testing 2026-08-23 (see this file's top
  // comment) — API's raw base (37) confirmed correct, wiki's 117 was wrong. Same base/coefficient as
  // this skill's own already-curated Life Siphon Healing (untraited PvE half) — likely one shared
  // formula for both halves of the siphon.
  10557: [{ factText: 'Life Siphon Damage', baseValue: 37, coefficient: 0.08 }],
  // Necromancer — Signet of Vampirism. Both facts resolved via live in-game WvW testing 2026-08-23
  // (see this file's top comment) — API's raw bases (129, 163) confirmed correct, wiki's 151/247 were
  // wrong.
  21762: [
    { factText: 'Passive Life-Siphon Damage', baseValue: 129, coefficient: 0.022 },
    { factText: 'Active Life Siphon Damage', baseValue: 163, coefficient: 0.084 }
  ],
  // Necromancer/Reaper — Death Spiral (greatsword 3). Previously blocked entirely on the wiki's own
  // `{{stub||missing siphon coefficients}}` tag (no coefficient documented anywhere on the page);
  // resolved via live in-game WvW testing 2026-08-23 with no wiki involvement at all (see this file's
  // top comment).
  30860: [{ factText: 'Life Siphon Damage', baseValue: 1764, coefficient: 0.005 }],
  // Necromancer — Hungering Maelstrom (sword 4). PvE+WvW grouped (1764/0.005) vs PvP-only
  // (1228/0.005, same coefficient) — WvW value used; API exposes only the PvE+WvW-grouped fact
  // locally (no separate PvP-only duplicate), matching the wiki's own grouped number exactly.
  71813: [{ factText: 'Life Siphon Damage', baseValue: 1764, coefficient: 0.005 }],
  // Necromancer — Soul Shards (spear-skill proc effect, e.g. Perforate). Genuine 3-way split, WvW a
  // standalone value (PvE 1504/0.1, WvW 605/0.038, PvP 456/0.038) — WvW value used; this app's own
  // API base (606) is 1 point off the wiki's quoted 605, a negligible rounding gap, not a real
  // conflict (same bar as CURATED_HEALING_COEFFICIENTS's Cleansing Wave entry).
  73108: [{ factText: 'Siphon Damage', baseValue: 606, coefficient: 0.038 }],
  // Necromancer — Nightmare Weapon (Ritualist utility, not Harbinger — see this skill's own
  // `CURATED_HEALING_COEFFICIENTS` comment for the correction). Previously blocked on the wiki's own
  // `{{stub||pvp/wvw dmg coefficient}}` tag for this specific game-mode half; resolved via live
  // in-game WvW testing 2026-08-23. Same base as this skill's own Life Siphon Healing fact (606),
  // though the coefficients differ (0.025 damage vs 0.15 healing).
  76739: [{ factText: 'Life Siphon Damage', baseValue: 606, coefficient: 0.025 }],
  // Necromancer — Xinrae's Weapon (Ritualist Elite). PvE/WvW+PvP base-value split (PvE 1990 vs
  // WvW+PvP 1001, same 0.005 coefficient) — WvW value used; matches this skill's own already-curated
  // Siphon Healing facts exactly (same page, same split, same coefficient).
  76941: [{ factText: 'Life Siphon Damage', baseValue: 1001, coefficient: 0.005 }]
}

export interface SiphonDamageLine {
  label: string
  value: number
}

/**
 * Real, current-build-scaled Life Siphon Damage lines for one skill — `Damage = baseValue +
 * coefficient * power` per curated entry, gated the same `requires_trait` way as
 * `healingLinesForSkill`/`barrierLinesForSkill`. Returns `[]` for any skill with no curated entry
 * rather than falling back to an unscaled/wrong number. Matched against `AttributeAdjust`/
 * `target: 'Power'` facts — unlike Barrier (which the API mislabels `target: 'Healing'` too), no
 * false-positive collision was found on `target: 'Power'` during this sweep's full `skills.json` scan
 * (the one non-siphon match, `Blood Frenzy` id 12424, is an unreachable Monster-type skill with no
 * real fact value at all — see this file's own top comment).
 */
export function siphonDamageLinesForSkill(skill: Skill, power: number, activeIds: ReadonlySet<number>): SiphonDamageLine[] {
  const entries = CURATED_SIPHON_DAMAGE_COEFFICIENTS[skill.id]
  if (!entries) return []

  const allFacts: Fact[] = [...skill.facts, ...skill.traitedFacts]
  const lines: SiphonDamageLine[] = []
  for (const entry of entries) {
    const fact = allFacts.find(
      (f) =>
        f.type === 'AttributeAdjust' &&
        f.target === 'Power' &&
        f.text === entry.factText &&
        (f.requires_trait ?? null) === (entry.requiresTrait ?? null)
    )
    if (!fact) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    lines.push({ label: entry.factText, value: Math.round(entry.baseValue + entry.coefficient * power) })
  }
  return lines
}
