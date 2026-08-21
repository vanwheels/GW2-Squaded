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
 * **3 stayed uncurated on a genuine, unresolved wiki/API value mismatch** — Locust Swarm (API 37 vs
 * wiki 117), Signet of Vampirism (API 129/163 vs wiki 151/247, both facts), Enchanted Daggers (API
 * 968/808 vs wiki 1028/858, both modes) — every one of these 5 number-pairs reconciles PERFECTLY if
 * `wikiQuoted = apiRaw + coefficient * 1000` (i.e. as if the wiki's own number were the tooltip value
 * at a Power-1000 reference build stacked ON TOP of the API's already-reference-built value), which
 * is suspiciously exact to be pure noise — but no other curated table in this codebase has ever
 * needed or used a "subtract coefficient times the target stat's base value" adjustment (every
 * existing `HealingCoefficient`/`BarrierCoefficient`/`DamageCoefficient` entry trusts the API's raw
 * `value` verbatim as `baseValue`, matching Healing/Barrier's own base-0 attribute trivially), and
 * `Soulcleave's Summit`/`Hungering Maelstrom`/`Xinrae's Weapon` above show ZERO such offset on the
 * exact same `{{skill fact|life siphon damage}}` template shape — so this isn't a universal formula
 * quirk, it's a real per-page inconsistency with no reliable way to tell which of the two patterns a
 * given skill follows without an actual in-game reference (not available in this environment — see
 * `electron_sandbox_limitation`). Left uncurated rather than guess which source is stale, same bar as
 * every other unreconciled case in this codebase (Enchanted Daggers' own `Initial Heal`/`Siphon
 * Healing` facts already carried a similar unexplained gap before this sweep — see
 * `CURATED_HEALING_COEFFICIENTS`'s own comment on this skill). Worth flagging for a future session:
 * `boon-calc/sources.ts`'s `LEGEND_FORM_EFFECT_DETAILS` Assassin-form entry (`baseValue: 1028`) used
 * the WIKI's quoted number directly for this exact `'siphonDamage'` formula shape, which — if the
 * "wiki number already double-counts the reference-build Power contribution" read above is the
 * correct one — would currently render an inflated number; not touched here since verifying it needs
 * the same missing in-game reference this whole mismatch already lacks.
 *
 * **2 stayed uncurated on an explicit wiki maintenance tag** — Death Spiral
 * (`{{stub||missing siphon coefficients}}`, no `coefficient=` param on either Life Siphon Damage fact
 * at all) and Nightmare Weapon (`{{stub||pvp/wvw dmg coefficient}}` — PvE has a coefficient, but the
 * WvW/PvP-grouped value this app's convention requires has none documented). Vampiric Slash carries
 * its own stub tag too (`{{stub|skill|Need better calculation of base life siphon damage}}`) with a
 * single flat coefficient that reproduces the same unresolved `+coefficient*1000` pattern above (API
 * 1210 vs wiki 1410) — doubly unreliable, left out on both grounds.
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
  // Revenant — Soulcleave's Summit (Renegade Elite). Base value unchanged across modes but the
  // coefficient itself splits (PvE 0.1 vs WvW+PvP 0.04, both share base 325) — WvW value used, same
  // "coefficient-only split" shape already curated for this skill's own Healing facts.
  45773: [{ factText: 'Life Siphon Damage', baseValue: 325, coefficient: 0.04 }],
  // Necromancer — Hungering Maelstrom (sword 4). PvE+WvW grouped (1764/0.005) vs PvP-only
  // (1228/0.005, same coefficient) — WvW value used; API exposes only the PvE+WvW-grouped fact
  // locally (no separate PvP-only duplicate), matching the wiki's own grouped number exactly.
  71813: [{ factText: 'Life Siphon Damage', baseValue: 1764, coefficient: 0.005 }],
  // Necromancer — Soul Shards (spear-skill proc effect, e.g. Perforate). Genuine 3-way split, WvW a
  // standalone value (PvE 1504/0.1, WvW 605/0.038, PvP 456/0.038) — WvW value used; this app's own
  // API base (606) is 1 point off the wiki's quoted 605, a negligible rounding gap, not a real
  // conflict (same bar as CURATED_HEALING_COEFFICIENTS's Cleansing Wave entry).
  73108: [{ factText: 'Siphon Damage', baseValue: 606, coefficient: 0.038 }],
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
