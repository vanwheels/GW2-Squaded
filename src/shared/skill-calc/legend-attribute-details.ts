import type { Legend, Trait } from '../types'
import type { LegendFormFact } from '../boon-calc/sources'

/**
 * Hand-curated per-legend attribute-bonus text for traits whose own `Buff`-typed facts carry a
 * LEGEND NAME as `status` (not a real boon/condition name) — e.g. Revenant/Conduit's Bolstered
 * Bonds. This is a *different* shape from Invocation's Spirit Boon (which grants real per-legend
 * BOONS via `PrefixedBuff` facts, each `prefix.status` naming the legend, rendered through the
 * normal boon/condition pipeline via `resolveLegendFromPrefix`/`BoonConditionSource.legendIcon`):
 * here the legend name IS the fact's own `status`, which `classifyBoonCondition` never recognizes
 * as a boon/condition, so these facts were previously silently dropped from every trait tooltip —
 * flagged by the user 2026-08-20 ("we should be displaying each legend detail, same as we do with
 * the trait Spirit Boon").
 *
 * Unlike most of this app's fact-driven display, the raw API data here doesn't reliably carry real
 * numbers either — Bolstered Bonds' own facts have an empty or entirely absent `description` for 4
 * of its 6 raw facts (only the Legendary Entity Stance pair carries real text, "75 to All
 * Attributes"/"50 to All Attributes" — the pve/wvw split for that one). So this is a hand-curated,
 * wiki-verified whitelist, same "fact type alone doesn't mean the data's usable" convention as
 * `CURATED_FLAT_BONUSES` in `gear-calc/trait-attributes.ts` — display-only for now, not wired into
 * that file's real attribute-totals computation (Bolstered Bonds' actual character-stat
 * contribution stays unmodeled, same "documented gap, not modeled wrong" shape as everywhere else
 * a display fix and a stats fix are kept separate).
 *
 * A third, related shape lives in `boon-calc/sources.ts`'s `legendFormFactsForSkill` instead of
 * here: skills like Cosmic Wisdom carry `PrefixedBuff` facts (not plain `Buff`) with real, usable
 * `description` text and a `prefix.status` naming the legend — no hand-curation needed there, just
 * an opt-in id allow-list. This file's own curated-text approach exists because Bolstered Bonds'
 * raw data specifically lacks that ready-to-use text; a future trait sharing Bolstered Bonds' exact
 * `Buff`-with-legend-name-status shape AND usable description text could skip this table entirely
 * and reuse a `legendFormFactsForSkill`-style extractor instead — check the raw facts first.
 */
export const LEGEND_ATTRIBUTE_BONUS_DETAILS: Record<number, Record<string, string>> = {
  // Bolstered Bonds (Revenant/Conduit, Master minor, id 2331) — "Gain attributes based on your
  // equipped legends. Those attributes are increased further when Cosmic Wisdom is active." Wiki-
  // verified 2026-08-20 (raw wikitext): only 5 of the 8 legends are named on this trait's own page
  // at all — Dragon/Renegade/Alliance genuinely absent, not an omission on this app's part. Assassin
  // and Demon are unconditional (no game-mode split); Centaur/Dwarf/Entity each split pve-vs-wvw+pvp
  // (150/150 -> 75/75 per specific stance, 75 -> 50 all-attribute for Entity), WvW value used
  // throughout per this app's convention. The separate "Effectiveness Increased 100%" Percent fact
  // (the "increased further when Cosmic Wisdom is active" clause) already renders fine via the
  // generic `numericFactLines`/`factLine` path — not duplicated here.
  2331: {
    'Legendary Assassin Stance': '75 Power, 75 Ferocity',
    'Legendary Centaur Stance': '75 Healing Power, 75 Concentration',
    'Legendary Demon Stance': '75 Condition Damage, 75 Expertise',
    'Legendary Dwarf Stance': '75 Toughness, 75 Vitality',
    'Legendary Entity Stance': '50 to All Attributes'
  }
}

/** Resolves a trait's curated `LEGEND_ATTRIBUTE_BONUS_DETAILS` entries (if any) against the real
 *  `Legend` list, in `legends`' own array order (Legend1..Legend8) — empty for any trait with no
 *  curated entry (the overwhelming majority), same "opt-in curated table, fails open" convention as
 *  `BUFF_INSTANCE_LABELS`/`DODGE_TRIGGER_NOTES` elsewhere in this codebase. */
export function legendAttributeDetailFacts(trait: Trait, legends: Legend[]): LegendFormFact[] {
  const curated = LEGEND_ATTRIBUTE_BONUS_DETAILS[trait.id]
  if (!curated) return []
  const out: LegendFormFact[] = []
  for (const legend of legends) {
    const text = curated[legend.name]
    if (text) out.push({ legend, text })
  }
  return out
}
