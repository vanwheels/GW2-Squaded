import type { Fact } from '../types'

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString()
}

/** One tooltip-ready fact line: display text plus the fact's own CDN icon (straight off the API's
 *  `Fact.icon`, same one the real in-game tooltip shows next to this exact line — every fact of a
 *  given `type` shares one icon, confirmed via a full scan of data/game-data/skills.json) so callers
 *  can render an icon-glyph-then-text row instead of plain text. `icon` is `null` for the rare fact
 *  with no `icon` field on it. */
export interface FactLine {
  icon: string | null
  text: string
}

/**
 * One human-readable line per directly-usable numeric `Fact` (Recharge seconds, hit counts,
 * Number/Distance raw values, `AttributeAdjust`'s base-stat reference number) — everything derivable
 * WITHOUT per-skill wiki curation. Deliberately falls back to `Damage`'s hit count (not a real
 * damage number) and `AttributeAdjust`'s reference-build base value (not a real Healing-Power-scaled
 * number): both need a wiki-verified per-skill coefficient to mean anything (see
 * `CURATED_DAMAGE_COEFFICIENTS`/`CURATED_HEALING_COEFFICIENTS`), which most skills don't have yet.
 * Exported so `skill-fact-lines.ts`'s `skillFactLines` can reuse this as its own per-fact fallback
 * for any fact a curated table doesn't cover — skill tooltips show the real number when curated data
 * exists, this generic line otherwise; traits (`TraitsEditor.tsx`) always go through
 * `numericFactLines` unchanged, since neither curated table has a trait entry yet.
 */
export function factLine(fact: Fact): FactLine | null {
  const icon = fact.icon ?? null
  switch (fact.type) {
    case 'Recharge':
      return typeof fact.value === 'number' ? { icon, text: `Recharge: ${fact.value}s` } : null
    case 'Damage': {
      const hitCount = fact.hit_count
      return typeof hitCount === 'number' ? { icon, text: `Damage: ${hitCount} hit${hitCount === 1 ? '' : 's'}` } : null
    }
    case 'HealingAdjust': {
      const hitCount = fact.hit_count
      return typeof hitCount === 'number' ? { icon, text: `Healing: ${hitCount} hit${hitCount === 1 ? '' : 's'}` } : null
    }
    case 'AttributeAdjust':
      return typeof fact.value === 'number' && (typeof fact.text === 'string' || typeof fact.target === 'string')
        ? { icon, text: `${typeof fact.text === 'string' ? fact.text : fact.target} (base): ${formatNumber(fact.value)}` }
        : null
    case 'Number':
    case 'Range':
      return typeof fact.value === 'number'
        ? { icon, text: `${typeof fact.text === 'string' ? fact.text : fact.type}: ${formatNumber(fact.value)}` }
        : null
    case 'Distance':
      return typeof fact.distance === 'number'
        ? { icon, text: `${typeof fact.text === 'string' ? fact.text : 'Distance'}: ${formatNumber(fact.distance)}` }
        : null
    case 'Time':
      return typeof fact.duration === 'number'
        ? { icon, text: `${typeof fact.text === 'string' ? fact.text : 'Time'}: ${fact.duration}s` }
        : null
    case 'Percent':
      return typeof fact.percent === 'number'
        ? { icon, text: `${typeof fact.text === 'string' ? fact.text : 'Percent'}: ${fact.percent}%` }
        : null
    default:
      return null
  }
}

/**
 * Wiki-confirmed pve+wvw-vs-pvp (or similar) splits for non-`Buff` facts sharing one `text` label
 * with no discriminator — same problem `WvwFactOverride`/`fetch-wvw-splits.ts` solves for `Buff`
 * facts, but that script's own candidate discovery only ever considers `Buff`-type facts (see its
 * top doc comment), so a split on a `Number`/`Time`/etc. fact can't just become a `Buff`-status
 * entry in its generated `wvw-fact-overrides.json`. Hand-curated here instead, keyed by trait/skill
 * id then by the fact's own `text` — `numericFactLines` keeps only the `Number`/`Percent` fact whose
 * `value`/`percent` matches, dropping any other raw fact sharing that same `text`.
 */
export const NUMERIC_FACT_WVW_OVERRIDES: Record<number, Record<string, number>> = {
  // Calming Tongue (Paragon/Warrior Adept trait, id 2433): "Chant of Recuperation removes
  // conditions from affected allies when activated." Wiki (raw wikitext, 2026-08-15):
  // `{{skill fact|conditions removed|2|game mode=pve wvw}}{{skill fact|conditions removed|1|
  // game mode=pvp}}` — pve+wvw share 2, pvp alone drops to 1 (2026-06-02 Paragon balance patch).
  // The 2 raw `Number` facts (`text: "Conditions Removed"`, `value: 2` / `value: 1`) carry no
  // game-mode discriminator, so without this, both would render as separate, contradictory lines.
  2433: { 'Conditions Removed': 2 },

  // Revenant Salvation majors/minors — first leg of the sweep the 2026-08-19 Salvation triage
  // scoped in TODO.md (`NUMERIC_FACT_WVW_OVERRIDES` had exactly 1 entry before this leg). Each
  // entry below keeps the WvW-correct value, same convention as Calming Tongue above, confirmed
  // via each trait's own raw wikitext (2026-08-20).

  // Serene Rejuvenation (id 1814, Adept minor): "Increase healing to other allies." Wiki:
  // `{{skill fact|percent|alt=Effectiveness Increased|20|game mode=pve pvp}}` +
  // `{{skill fact|percent|alt=Effectiveness Increased|15|game mode=wvw}}` — pve+pvp share 20, wvw
  // alone drops to 15. Note: the raw `traitedFacts` also carry a 2nd, unrelated pair of
  // `Effectiveness Increased` values (25/18, `requires_trait: 2440` — Vindicator's Numinous Gift,
  // "third minor traits of other specializations you equip have improved effectiveness") that this
  // entry deliberately does NOT touch — see `numericFactLines`'s `requires_trait == null` guard.
  // That 2nd pair is a genuinely different value from a cross-spec trait interaction, not another
  // instance of this same pve/wvw/pvp ambiguity, and would need its own curated entry (plus a way
  // to key an override by which trait unlocked it) if it's ever worth resolving.
  1814: { 'Effectiveness Increased': 15 },

  // Invigorating Dismissal (id 1820, Grandmaster major): "Grant endurance when you remove a
  // condition from an ally." Wiki: `{{skill fact|Endurance Gained|4|game mode=pve}}` +
  // `{{skill fact|Endurance Gained|2|game mode=wvw}}` + `{{skill fact|Endurance Gained|3|
  // game mode=pvp}}` (wvw dropped from 3 to 2 in a 2022 balance patch) — pve 4, wvw 2, pvp 3, all
  // 3 distinct with no 2-way overlap.
  1820: { 'Endurance Gained': 2 },

  // Invoking Harmony (id 1823, Adept major): "Healing done to other allies is increased for a
  // short duration after invoking a legend." Wiki: `{{skill fact|percent|alt=Effectiveness
  // Increased|20|game mode=pve}}` + `{{...|15|game mode=pvp}}` + `{{...|10|game mode=wvw}}` (API's
  // own fact `text` is "Healing Increase to Others", not the wiki template's `alt=`) — pve 20,
  // pvp 15, wvw 10, all 3 distinct.
  1823: { 'Healing Increase to Others': 10 },

  // Unyielding Devotion (id 1825, Grandmaster major): "Take reduced strike damage for a duration
  // after healing." Wiki: `{{skill fact|damage reduced|15|game mode=pve wvw}}` + `{{skill
  // fact|damage reduced|10|game mode=pvp}}` — pve+wvw share 15, pvp alone drops to 10.
  1825: { 'Damage Reduced': 15 },

  // Revenant Invocation majors/minors — 2nd leg of the sweep, same process as the Salvation leg
  // above (2026-08-20). Buff-type dupes in this line (Invoker's Rage/Incensed Response) are
  // already handled by the separate `wvw-fact-overrides.json` script; these 4 are the line's only
  // ambiguous `Number`/`Percent` facts.

  // Ferocious Aggression (id 1758, Master minor): "All damage dealt is increased while you have
  // fury." Wiki: `{{skill fact|all damage increase|10|game mode=pve}}` + `{{skill fact|all damage
  // increase|7|game mode=wvw pvp}}` — pve 10, wvw+pvp share 7.
  1758: { 'Damage Increase': 7 },

  // Rising Tide (id 1761, Adept major): "While your health is above the threshold, strike damage
  // dealt is increased." Wiki: `{{skill fact|damage increase|10|game mode=pve}}` + `{{skill
  // fact|damage increase|7|game mode=wvw pvp}}` + `{{skill fact|health threshold|75|game
  // mode=pve}}` + `{{skill fact|health threshold|90|game mode=pvp wvw}}` — pve is 10%/75%
  // threshold, wvw+pvp share 7%/90% threshold. Two independently-ambiguous `text` labels on the
  // same trait, both entered here.
  1761: { 'Damage Increase': 7, 'Health Threshold': 90 },

  // Charged Mists (id 1791, Grandmaster major): "Invoking a legend while at or below the energy
  // threshold grants extra energy to your new legend." Wiki: `{{skill fact|Energy Gain|25|game
  // mode=pve wvw}}` + `{{skill fact|Energy Gain|20|game mode=pvp}}` — pve+wvw share 25, pvp alone
  // drops to 20.
  1791: { 'Energy Gain': 25 },

  // Roiling Mists (id 1719, Grandmaster major): "Critical-hit chance is further increased while
  // you are under the effect of fury. Convert a percentage of your outgoing critical strike damage
  // into healing." Wiki: `{{skill fact|percent|2|game mode=pve}}` + `{{skill fact|percent|5|game
  // mode=wvw pvp}}` (healing-conversion %) + `{{skill fact|Critical Chance increase|25|game
  // mode=pve}}` + `{{skill fact|Critical Chance Increase|20|game mode=wvw pvp}}` — pve is 2%/25%,
  // wvw+pvp share 5%/20%. The crit-chance half was already curated for aggregate calc in
  // `FURY_CRIT_CHANCE_TRAIT_BONUSES` (`combat-state.ts`, same 20 WvW value) — this entry is the
  // separate tooltip-fact-list fix, a different code path (see
  // `profession_mechanic_bar_branch_facts_bug_2026-08-15` memory: tooltip-correctness and
  // aggregate-contribution never share a fix). The API's own raw facts list 5 twice (once for wvw,
  // once for pvp, both the same value) rather than once for a shared "wvw pvp" mode — harmless,
  // `numericFactLines`'s `seen` dedup already collapses the exact duplicate.
  1719: { 'Percent': 5, 'Critical Chance Increase': 20 },

  // Revenant Retribution majors/minors — 3rd leg of the sweep (2026-08-20). Every other Retribution
  // trait with a Number/Percent fact carries only one unambiguous value (Close Quarters, Dwarven
  // Battle Training, Versed in Stone's Health-Threshold/Damage-Reduced facts, Vicious Reprisal), is
  // a genuinely-identical duplicate already deduped for free (Enduring Recovery's "Endurance
  // Regeneration Increase" 25/25, same shape as Salvation's Resilient Spirit), or is a
  // `BuffConversion`-typed fact `factLine`'s switch has no case for (Versed in Stone's "Attribute
  // Conversion" 13%/4% pair, same out-of-scope shape as Salvation's Life Attunement) — nothing else
  // to add this leg. No Buff-type dupes on this line either.

  // Determined Resolution (id 1713, Grandmaster minor): "Strike damage taken is reduced by a
  // percentage while you have resolution." Wiki: `{{skill fact|Damage Reduced|10|game mode=pve
  // wvw}}` + `{{skill fact|Damage Reduced|7|game mode=pvp}}` (pvp-only nerf from 10 to 7, 2025-05-06)
  // — pve+wvw share 10, pvp alone drops to 7. Its `traitedFacts` also carry an unrelated 2nd pair
  // (15/10, `requires_trait: 2440` — Vindicator's Numinous Gift), same cross-spec shape as Serene
  // Rejuvenation's in the Salvation leg above — deliberately left alone.
  1713: { 'Damage Reduced': 10 },

  // Revenant Corruption majors/minors — 4th leg of the sweep (2026-08-20). Acolyte of Torment's
  // single "Damage Increase" 10% fact carries no split (unambiguous, nothing to add). Yearning
  // Empowerment's base "Duration Increase" 10% fact also has no `game mode=` split at all — its
  // `traitedFacts` 2nd pair (15%, `requires_trait: 2440` — Vindicator's Numinous Gift) is the same
  // cross-spec-interaction shape as Serene Rejuvenation/Determined Resolution above, deliberately
  // left alone. No Buff-type dupes on this line either.

  // Demonic Resistance (id 1726, Master major): "Incoming strike damage is reduced while you have
  // resistance on you." Wiki: `{{skill fact|damage reduced|20|game mode=pve}}` + `{{skill
  // fact|damage reduced|10|game mode=pvp wvw}}` — pve 20, pvp+wvw share 10.
  1726: { 'Damage Reduced': 10 },

  // Pact of Pain (id 1714, Master major): "Conditions you apply to foes last longer, but
  // conditions applied to you also last longer." Wiki: `{{skill fact|duration increase|alt=
  // Conditions Applied to Foes|15%|game mode=pve}}` + `{{...|Conditions Applied to Self|10%|game
  // mode=pve}}` + `{{...|Conditions Applied to Foes|7%|game mode=pvp wvw}}` + `{{...|Conditions
  // Applied to Self|5%|game mode=pvp wvw}}` — pve is 15%/10%, pvp+wvw share 7%/5%. Two
  // independently-ambiguous `text` labels on the same trait, both entered here.
  1714: { 'Conditions Applied to Foes': 7, 'Conditions Applied to Self': 5 },

  // Permeating Pestilence (id 1721, Grandmaster major, wiki icon still filed under its pre-2020
  // name "Pulsating Pestilence"): "Invoke Torment transfers conditions from you onto foes." Wiki:
  // `{{skill fact|Conditions Transferred|alt=Conditions Copied|3|game mode=pve}}` + `{{skill
  // fact|Conditions Transferred|alt=Conditions Copied|2|game mode=pvp wvw}}` — pve 3, pvp+wvw
  // share 2.
  1721: { 'Conditions Copied': 2 },

  // Revenant Devastation majors/minors — 5th leg of the sweep (2026-08-20). Notoriety (1765) and
  // Assassin's Presence (1786) each carry a Might/Fury Buff-type dupe already resolved by the
  // separate `wvw-fact-overrides.json` script, out of scope for this table. Targeted Destruction's
  // 2nd `traitedFacts` entry (`requires_trait: 2440`, Vindicator's Numinous Gift) is the same
  // cross-spec-interaction shape seen on every prior leg, deliberately left alone. Dance of Death
  // and Swift Termination's Health-Threshold/Damage-Reduced/Healing-Increase facts each carry only
  // one unambiguous value. Battle Scarred (1755) is a genuinely different, NOT-yet-resolved shape:
  // its "Life Siphon Healing" fact appears 3 times in the live API (117/58/68, `AttributeAdjust`
  // type, not `Number`/`Percent`) but the wiki's own raw wikitext and rendered infobox (both
  // re-checked 2026-08-20) only ever document 2 values — 117 pve, 58 shared pvp+wvw — with no
  // mention anywhere of what 68 represents. Left uncurated rather than guessed; would also need
  // `numericFactLines`'s filter extended to `AttributeAdjust`, which it doesn't handle today.

  // Brutality (id 1715, Master major): "Increase damage while under the effects of quickness."
  // Wiki: `{{skill fact|Damage Increase|15|game mode = pve wvw}}` + `{{skill fact|Damage
  // Increase|10|game mode = pvp}}` (split changed 2025-06-24 when the trait's primary effect moved
  // from removing stability to bonus damage) — pve+wvw share 15, pvp alone drops to 10.
  1715: { 'Damage Increase': 15 },

  // Destructive Impulses (id 1724, Adept minor): "All damage is increased. Off-hand weapon skills
  // deal increased damage." Wiki: `{{skill fact|all damage increase|5}}` (unambiguous base 5%) +
  // `{{skill fact|all damage increase|alt=Bonus Damage from Off Hand|2.5|game mode=pve}}` +
  // `{{...|5|game mode=wvw pvp}}` — pve 2.5, wvw+pvp share 5 (PvE-only nerf, 2021-06-08).
  1724: { 'Bonus Damage from Off Hand': 5 },

  // Unsuspecting Strikes (id 1767, Adept major; wiki page now titled "Vicious Lacerations" after a
  // rename, values unchanged): "Strike damage against foes above the health threshold is
  // increased." Wiki: `{{skill fact|Damage Increase|20|game mode = pve}}` + `{{skill fact|Damage
  // Increase|10|game mode = pvp wvw}}` (PvE-only nerf from 25 to 20, 2021-05-25) — pve 20, pvp+wvw
  // share 10.
  1767: { 'Damage Increase': 10 }
}

/**
 * Gated by the same `requires_trait` rule as the boon/condition extractor in `boon-calc/sources.ts`
 * (a conditional fact only counts once the trait unlocking it is actually chosen). Deduplicates
 * identical lines (e.g. a skill with 2 near-identical Damage facts for a physical + condition
 * component both reporting the same hit count) rather than repeating them. `wvwOverrides` (see
 * `NUMERIC_FACT_WVW_OVERRIDES` above) additionally drops any `Number`/`Percent` fact whose
 * `value`/`percent` doesn't match the WvW-correct one for its `text` — optional/defaulted so every
 * pre-existing caller without a matching entry keeps compiling and behaving unchanged. Only applies
 * to base `facts` (`requires_trait == null`): a `traitedFacts` entry sharing the same `text` is a
 * different value unlocked by a different trait, not another instance of the same game-mode
 * ambiguity, and filtering it against the base override would wrongly drop it too (see Serene
 * Rejuvenation's Numinous-Gift-conditioned pair in `NUMERIC_FACT_WVW_OVERRIDES` above).
 */
export function numericFactLines(facts: Fact[], traitedFacts: Fact[], activeIds: ReadonlySet<number>, wvwOverrides?: Record<string, number>): FactLine[] {
  const lines: FactLine[] = []
  const seen = new Set<string>()
  for (const fact of [...facts, ...traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    if (wvwOverrides && fact.requires_trait == null && typeof fact.text === 'string' && fact.text in wvwOverrides) {
      const target = wvwOverrides[fact.text]
      if (fact.type === 'Number' && fact.value !== target) continue
      if (fact.type === 'Percent' && fact.percent !== target) continue
    }
    const line = factLine(fact)
    if (line && !seen.has(line.text)) {
      seen.add(line.text)
      lines.push(line)
    }
  }
  return lines
}
