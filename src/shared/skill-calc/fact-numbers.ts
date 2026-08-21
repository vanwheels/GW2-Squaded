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
 * id then by the fact's own `text` — `numericFactLines` keeps only the `Number`/`Percent`/
 * `AttributeAdjust` fact whose `value`/`percent` matches, dropping any other raw fact sharing that
 * same `text` (`AttributeAdjust` support added 2026-08-20, see the trait/skill data-correctness pass
 * scoped in TODO.md — base-stat-adjust facts like life-siphon damage/healing were falling straight
 * through undeduped before this). `Time`-typed facts (e.g. a pulse/recharge "Interval") joined the
 * same day, found while curating the Guardian leg of the main WvW-duplicate sweep (Righteous
 * Instincts' "Boon Application Interval", Loremaster's "Interval", Illuminating Inspiration's
 * "Recharge Time Reduced" all render via `factLine`'s existing `Time` case but were never in the
 * override matcher's type allowlist). Matching also now falls back to `fact.target` when
 * `AttributeAdjust` has no `text` at all (Firebrand's Imbued Haste, id 2148 — 3 attribute facts
 * with zero `text` field, keyed here by their `target` string instead) — mirrors `factLine`'s own
 * display fallback, see `numericFactLines` below.
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
  // one unambiguous value.

  // Battle Scarred (id 1755, Master major): "Siphon health after using your healing skill."
  // Re-checked 2026-08-20 against the trait's raw wikitext (`split = pve, wvw pvp`):
  // `{{skill fact|life siphon damage|117|coefficient=0.006|game mode = pve|scaling=power-only}}` +
  // `{{skill fact|life siphon healing|117|coefficient=0.006|game mode = pve}}` +
  // `{{skill fact|life siphon damage|58|coefficient=0.003|game mode = pvp|scaling=power-only}}` +
  // `{{skill fact|life siphon healing|58|coefficient=0.003|game mode = pvp wvw}}` — the page-level
  // `split` field (authoritative over the individual templates' looser `game mode=pvp`-only
  // wording on the Damage line) confirms both Damage and Healing share the same pve-vs-wvw+pvp
  // split: pve 117, wvw+pvp 58. "Life Siphon Damage" (`AttributeAdjust`, `target: 'Power'`) is
  // unambiguous with this table now extended to that fact type — curated below. "Life Siphon
  // Healing" (`target: 'Healing'`) stays a genuinely different, NOT-yet-resolved shape: it appears
  // a 3rd time in the live API (68, alongside 117/58) with no mention anywhere on the wiki page of
  // what that 3rd value represents. Left uncurated rather than guessed — this table can only drop
  // facts that don't match a known-correct value, and picking between 58/68 blind risks silently
  // hiding the *correct* one instead of the wrong one.
  1755: { 'Life Siphon Damage': 58 },

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
  1767: { 'Damage Increase': 10 },

  // Revenant Renegade majors/minors — 6th leg of the sweep (2026-08-20). Ambush Commander, Blood
  // Fury, Wrought-Iron Will, Lasting Legacy, and Righteous Rebel's Number/Percent facts each carry
  // only one unambiguous value; Lasting Legacy's Might Buff-type dupe (12/9 duration) is already
  // handled by the separate `wvw-fact-overrides.json` script (`trait["2100"]`, keeps 9). Endless
  // Enmity/Ashen Demeanor have no Number/Percent facts at all (their Buff dupes are also already
  // covered by that same script). No new Battle-Scarred-shaped unresolved case this leg.

  // Brutal Momentum (id 2142, Minor 3): "Gain increased critical-hit chance based on your current
  // endurance." Wiki: `{{skill fact|Critical Chance Increase|10|game mode=pve wvw}}` + `{{skill
  // fact|Critical Chance Increase|15|game mode=pvp}}` — pve+wvw share 10, pvp alone rises to 15.
  // Its separate "Critical Chance Increase at Full Endurance" fact (33, unambiguous, no game-mode
  // split) is a different label, already correctly rendered on its own; the aggregate-calc side of
  // this trait (`BRUTAL_MOMENTUM`-style full-endurance crit bonus) was fixed independently in
  // Tier 3 testing (`v1_0_release_push_2026-08-12` memory) — same tooltip-vs-aggregate split as
  // every prior leg's Numinous-Gift asides.
  2142: { 'Critical Chance Increase': 10 },

  // Heartpiercer (id 2092, Major 2): "Increase strike damage against bleeding foes." Wiki: `{{skill
  // fact|damage increase|15|game mode=pve}}` + `{{skill fact|damage increase|10|game mode=wvw
  // pvp}}` (API's own fact `text` is "Strike Damage Bonus") — pve 15, wvw+pvp share 10. Its
  // separate "Bleeding Damage Bonus" fact (25%, unambiguous, no split) is a different label.
  2092: { 'Strike Damage Bonus': 10 },

  // All for One (id 2108, Major 2): "Gain energy and reduce the recharge of your utility skills
  // when you block, evade, or blind an attack." Wiki: `{{skill fact|Energy Gain|+10|game
  // mode=pve}}` + `{{skill fact|Energy Gain|+5|game mode=wvw pvp}}` + `{{skill fact|Recharge
  // Reduced|50|game mode=pve}}` + `{{skill fact|Recharge Reduced|33|game mode=pvp wvw}}` — pve is
  // 10 energy/50% recharge, wvw+pvp share 5 energy/33% recharge. Two independently-ambiguous
  // `text` labels on the same trait, both entered here.
  2108: { 'Energy Gain': 5, 'Recharge Reduced': 33 },

  // Vindication (id 2094, Major 3): "Convert a portion of your outgoing strike damage to healing
  // for you and nearby allies based on your Kalla's Fervor." Wiki: `{{skill fact|Damage|alt=Damage
  // to Healing per Kalla's Fervor|1%|game mode=pve pvp}}` + `{{skill fact|Damage|alt=Damage to
  // Healing per Kalla's Fervor|2%|game mode=wvw}}` — pve+pvp share 1, wvw alone rises to 2 (the
  // rare case where WvW is the outlier on the high side, not the low side).
  2094: { 'Damage to Healing per Kalla\'s Fervor': 2 },

  // Revenant Vindicator majors/minors — 7th leg of the sweep (2026-08-20). Vindicator has no
  // `traitedFacts` at all (confirmed via a full scan), so none of this line's traits carry the
  // Numinous-Gift-style cross-spec 2nd-pair shape seen on every prior line. Tenacious Ruin, Empire
  // Divided, Leviathan Strength, Amnesty of Shing Jea, and Redemptor's Sermon's Number/Percent
  // facts each carry only one unambiguous value. Balance in Discord (2254) has a Regeneration
  // Buff-type dupe already handled by the separate `wvw-fact-overrides.json` script. Forerunner of
  // Death, Vassals of the Empire, and Saint of zu Heltzer have no Number/Percent facts at all.

  // Reaver's Curse (id 2259, Master major): "Energy Meld's cooldown is reduced and it increases the
  // effectiveness of your next dodge." Wiki: `{{skill fact|recharge reduced|50|game mode=pve}}` +
  // `{{skill fact|recharge reduced|20|game mode=wvw pvp}}` — pve 50, wvw+pvp share 20. This trait's
  // other facts (100%/25% Damage Increase pairs for the 3 different dodge-replacement skills it
  // improves, a 9/4 Might-stacks pair, a 100% Healing/Barrier fact) are all `PrefixedBuff`-typed
  // per-linked-skill breakdowns, out of scope for this table — same shape as Salvation's Generous
  // Abundance, left for a future per-skill-mapping leg if ever revisited.
  2259: { 'Recharge Reduced': 20 },

  // Angsiyan's Trust (id 2243, Master major): "Energy Meld no longer has an energy cost and grants
  // energy when used in combat." Wiki: `{{skill fact|Energy Gain|25|game mode=pve wvw}}` + `{{skill
  // fact|Energy Gain|10|game mode=pvp}}` (pvp-only nerf from 25 to 10, 2024-08-20) — pve+wvw share
  // 25, pvp alone drops to 10.
  2243: { 'Energy Gain': 25 },

  // Song of Arboreum (id 2255, Master major; wiki page titled "Songs of Arboreum"): "Energy Meld
  // grants more endurance and grants its endurance and vigor to nearby allies." Wiki: `{{skill
  // fact|endurance gained|40|game mode=pve}}` + `{{skill fact|endurance gained|10|game mode=wvw
  // pvp}}` — pve 40, wvw+pvp share 10. **Not fixed by this entry, a known loose end**: the trait's
  // separate Vigor duration is a genuine 3-way split per the wiki (`{{skill fact|vigor|9|game
  // mode=pve}}` + `|7|game mode=wvw}}` + `|6|game mode=pvp}}`), but the live API's own `Buff`-type
  // facts for it only carry 2 values (9, 6) — the WvW-correct 7 isn't present in the API data at
  // all to pick, the inverse of Devastation's Battle-Scarred loose end (there the API had an extra
  // undocumented value; here it's missing a documented one). Also Buff-typed, not Number/Percent,
  // so out of this table's scope regardless — would need its own fix in `wvw-fact-overrides.json`
  // territory if the API ever picks up the 3rd value.
  2255: { 'Endurance Gained': 10 },

  // Revenant Conduit majors/minors — 8th and final leg of the sweep (2026-08-20). Conductive
  // Armaments (2390), Lingering Determination (2407), and Kinetic Insight (2411) each carry only
  // one unambiguous value (confirmed via raw wikitext, no `game mode=` split at all). Ethereal
  // Purification (2416) similarly has no split. Mistfire (2429)'s only Number/Percent-typed fact
  // ("Number of Targets", 5) is unambiguous — its actual pve/wvw+pvp split (Burning stacks, 6/4)
  // is `Buff`-typed and already present in `wvw-fact-overrides.json` (trait 2429). Found Purpose
  // (2352) and Shared Wisdom (2355) also carry real pve/wvw/pvp splits, but on `Buff`-typed facts
  // (per-legend stance-boon grants) — out of this table's scope regardless, same shape as
  // Vindicator's Reaver's Curse/Salvation's Generous Abundance for the linked-skill ones. Closed
  // 2026-08-20 (see `fetch-wvw-splits.ts`'s own trait-2352/2355 comment for the full per-boon
  // breakdown): a full `npm run fetch-wvw-splits` re-run does NOT pick these up (their facts are
  // `PrefixedBuff`-typed, outside this script's own automated candidate scan, same as most of its
  // `MANUAL_OVERRIDES` table already) and isn't safe to commit wholesale right now besides (~250
  // unrelated facts drifted since the last regen, reverted rather than trusted blind) — hand-added
  // to `MANUAL_OVERRIDES`/`wvw-fact-overrides.json` instead. Numinous Gift (2440) turned out to need
  // no override at all — its pve and wvw values already agree everywhere. Bolstered Bonds (2331)
  // isn't actually this mechanism's concern: its "Buff" facts carry legend NAMES as `status`, not
  // real boon/condition names, so this app's boon/condition pipeline never renders them at all —
  // its real per-legend attribute-bonus pve/wvw split would need its own fix elsewhere (an
  // attribute-bonus table, not this file or `wvw-fact-overrides.json`), not attempted here.

  // Enigmatic Connection (id 2364, Adept minor): "Gain affinity when using a legend skill; gain
  // extra affinity when using a skill above the energy threshold." Wiki: `{{skill fact|Energy
  // Threshold|25|game mode = pve}}` + `{{skill fact|Energy Threshold|35|game mode = pvp wvw}}`
  // (2026-06-02 patch note: "adjusted the energy threshold for bonus affinity from 25 to 35 in PvP
  // and WvW only, addressing incorrect affinity calculations") — pve 25, pvp+wvw share 35, the
  // rare case (like Renegade's Vindication) where WvW is the high outlier, not the low one. Its
  // separate "Additional Affinity" fact (1, unambiguous) is a different label.
  2364: { 'Energy Threshold': 35 },

  // Expanded Consciousness (id 2358, Master major): "Heal and gain endurance whenever you gain
  // affinity. Additionally, gain energy when you reach maximum affinity." Wiki: `{{skill
  // fact|healing|983|coefficient=0.05|game mode = pve}}` + `{{...|389|...|game mode = wvw}}` +
  // `{{...|165|...|game mode = pvp}}`, `{{skill fact|endurance gained|5|game mode = pve}}` +
  // `{{...|3|game mode = wvw}}` + `{{...|2|game mode = pvp}}`, `{{skill fact|energy|alt=Energy
  // Gain|15|game mode = pve wvw}}` + `{{...|10|game mode = pvp}}` — a genuine 3-way split across
  // all three facts. "Endurance Gained"/"Energy Gain" are `Number`-typed; "Healing" is
  // `AttributeAdjust`-typed (API values 965/165/389 vs. the wiki's 983/165/389 — the pve leg is off
  // by 18, a reference-build-rounding gap seen elsewhere, but the wvw/pvp legs match the wiki
  // exactly) — now curatable too since this table's matching was extended to `AttributeAdjust`
  // facts (2026-08-20).
  2358: { 'Endurance Gained': 3, 'Energy Gain': 15, 'Healing': 389 },

  // Enhanced Embodiment (id 2379, Grandmaster major): "Reduce the recharge of invoking legends in
  // combat." Wiki: `{{skill fact|Recharge Reduced|40|game mode=pve}}` + `{{skill fact|Recharge
  // Reduced|30|game mode=wvw}}` + `{{skill fact|Recharge Reduced|20|game mode=pvp}}` — a genuine
  // 3-way split, all distinct. Its separate "Duration Increase" fact (Cosmic Wisdom duration on
  // legend invoke, unambiguous per the wiki) doesn't appear in the local API data at all.
  2379: { 'Recharge Reduced': 30 },

  // Guardian — 1st leg of the "remaining 8 professions" main sweep (TODO.md, 2026-08-20). Same
  // process as every Revenant leg above: scanned every Guardian trait's base `facts` for a
  // Number/Percent/AttributeAdjust/Time label (or AttributeAdjust `target`) appearing more than
  // once, then wiki-verified each one's raw `{{trait fact}}` split before curating. 2 real gaps
  // found this leg, deliberately left uncurated (documented, not modeled wrong):
  //  - Heavy Light (1963, Dragonhunter): wiki splits its Stability grant 6s pve / 3s wvw+pvp, but
  //    the live API carries only ONE Stability fact (6, the pve value) — the wvw variant is simply
  //    missing from the API, same "documented but absent from the raw data" shape as Vindicator's
  //    Song of Arboreum Vigor loose end (`fetch-wvw-splits.ts`). Buff-typed regardless, out of this
  //    table's scope even if it were present.
  //  - Phoenix Protocol (2195, Willbender): "Alacrity on Trigger"/"Alacrity on Activation" are 2
  //    independent concepts sharing one status with no discriminator, AND in WvW the trait swaps to
  //    granting Resolution instead of Alacrity entirely (wiki-confirmed, 2025-02-11 patch) — same
  //    "2+ genuinely different simultaneous applications collide with a single-status override"
  //    hazard as Darkrazor's Daring/Fox's Fury's 77282 Might above, compounded by a real boon-type
  //    swap `WvwFactOverride` has no way to express (only overrides a status's own `duration`).
  //    Buff-typed, out of this table's scope regardless; left fully uncurated rather than partially
  //    fixed and partially wrong.

  // Monk's Focus (id 586, Valor Grandmaster): "Meditation skills heal you and grant fury to nearby
  // allies." Wiki: `{{skill fact|healing|1960|coefficient=0.4|game mode = pve}}` + `{{...|1720|...|
  // game mode = pvp wvw}}` — pve 1960, wvw+pvp 1720.
  586: { Healing: 1720 },

  // Radiant Fire (id 567, Radiance Master): "Zealot's Flame is improved..." Wiki: `{{skill
  // fact|duration increase|20%|game mode = pve}}` + `{{...|7%|game mode = pvp wvw}}` — pve 20,
  // wvw+pvp 7. Its OTHER "Duration Increase" fact (50%, alt="Zealot's Flame base burning duration
  // increase:", no split) is a separate unambiguous concept, unaffected.
  567: { 'Duration Increase': 7 },

  // Amplified Wrath (id 1686, Radiance Grandmaster): "Burning you inflict deals increased damage."
  // Wiki: `{{skill fact|condition damage increase|10|game mode=pve}}` + `{{...|15|game
  // mode=wvw pvp}}` (API's own fact `text` is "Damage Increase", not the wiki param name) — pve 10,
  // wvw+pvp 15, the rare case where WvW is the higher value (2022-06-28 patch nerfed PvE only).
  1686: { 'Damage Increase': 15 },

  // Righteous Instincts (id 1683, Radiance Grandmaster): "Resolution increases your chances to
  // critically strike and grants might each interval." Wiki: `{{skill fact|critical chance
  // increase|25|game mode = pve wvw}}` + `{{...|40|game mode = pvp}}` (pve+wvw already share 25;
  // this entry exists purely to collapse the pvp-only 40 fact) + `{{skill fact|interval|alt=Boon
  // Application Interval|1|game mode = pve}}` + `{{...|3|game mode = wvw pvp}}` (2025-11-05 patch,
  // `Time`-typed) — 2 independently-ambiguous labels on one trait.
  1683: { 'Critical Chance Increase': 25, 'Boon Application Interval': 3 },

  // Pure of Sight (id 1926, Dragonhunter Grandmaster minor): "Deal bonus strike damage based on
  // your distance to the enemy." Wiki: `{{skill fact|Damage Increase|alt=Minimum Bonus Damage|7|
  // game mode = pve}}` + `{{...|5|game mode = wvw}}` + `{{...|10|game mode = pvp}}` — a genuine
  // 3-way split, all distinct; wvw (5) is the low outlier. Its "Maximum Bonus Damage" fact (15,
  // unsplit) is a different label. Zealot's Aggression (1835, same line) also scanned as a
  // "Damage Increase"x2 candidate but turned out to be a genuinely-identical duplicate (10/10, no
  // wiki split at all) — already collapses to one displayed line via this function's own `seen`
  // dedup, no override needed.
  1926: { 'Minimum Bonus Damage': 5 },

  // Bulwark (id 1943, Dragonhunter Master): "Shield of Courage gains increased radius and
  // duration." Wiki: `{{skill fact|Duration Increase|2|game mode=pve pvp}}` + `{{...|1|
  // game mode=wvw}}` (`Time`-typed, 2024-11-19 WvW-only nerf) — pve+pvp 2, wvw 1.
  1943: { 'Duration Increase': 1 },

  // Heavy Light (id 1963, Dragonhunter Grandmaster): "Gain stability when disabling an enemy. Deal
  // increased strike damage to disabled, exposed, or defiant foes." Wiki: 2 independent pve/wvw+pvp
  // Damage Increase splits (`{{skill fact|Damage Increase|alt=Damage Increase to Disabled or
  // Exposed Foes|20|game mode=pve}}` + `{{...|15|game mode=pvp wvw}}`, `{{skill fact|Damage
  // Increase|alt=Damage Increase to Defiant Foes|15|game mode=pve}}` + `{{...|10|game
  // mode=pvp wvw}}`). Its Stability grant ALSO splits per the wiki (6 pve / 3 wvw+pvp) but is left
  // uncurated — see this table's own Guardian-leg intro comment above.
  1963: { 'Damage Increase to Disabled or Exposed Foes': 15, 'Damage Increase to Defiant Foes': 10 },

  // Big Game Hunter (id 1955, Dragonhunter Grandmaster): "Striking an enemy tethered by your Spear
  // of Justice inflicts vulnerability and increases strike damage dealt. Tether duration is
  // increased." Wiki: `{{skill fact|damage increase|25|game mode = pve}}` + `{{...|15|
  // game mode = wvw pvp}}`, `{{skill fact|duration increase|100%|game mode = pve}}` + `{{...|66%|
  // game mode = wvw pvp}}` — 2 independently-ambiguous labels, both pve-high/wvw-low.
  1955: { 'Damage Increase': 15, 'Duration Increase': 66 },

  // Furious Focus (id 2017, Zeal Grandmaster): "Your strike damage and movement speed are increased
  // while you have fury..." Wiki: `{{skill fact|Damage Increase|10|game mode=pve}}` + `{{...|7|
  // game mode=pvp wvw}}` (2026-02-24 patch, PvP/WvW-only nerf) — pve 10, wvw+pvp 7.
  2017: { 'Damage Increase': 7 },

  // Inspired Virtue (id 621, Virtues Adept minor): "Virtues apply boons to allies when activated.
  // Deal increased strike damage for each boon on you." Wiki: `{{skill fact|damage increase|alt=
  // Bonus Damage per Boon|0.5|game mode=pve}}` + `{{...|1|game mode=pvp wvw}}` (2026-04-14 PvE-only
  // nerf) — pve 0.5, wvw+pvp 1, the rare WvW-higher case.
  621: { 'Bonus Damage per Boon': 1 },

  // Unscathed Contender (id 624, Virtues Adept): "Strike damage dealt is increased while you have
  // aegis. Strike damage dealt is increased while you are above the health threshold." Wiki:
  // `{{skill fact|damage increase|alt=Damage Increase with Aegis|5|game mode=pve}}` + `{{...|7|
  // game mode=pvp wvw}}`, `{{skill fact|damage increase|alt=Damage Increase above Health
  // Threshold|5|game mode=pve}}` + `{{...|7|game mode=pvp wvw}}` (2026-04-14 PvE-only nerf on both)
  // — 2 independently-ambiguous labels, both wvw-higher.
  624: { 'Damage Increase with Aegis': 7, 'Damage Increase above Health Threshold': 7 },

  // Permeating Wrath (id 622, Virtues Grandmaster): "The passive effect of Virtue skill 1 triggers
  // more quickly and now burns in an area." Wiki: `{{skill fact|targets|5|game mode=pve pvp}}` +
  // `{{...|3|game mode=wvw}}` (2024-08-20 WvW-only nerf) — pve+pvp 5, wvw 3. Its Burning duration
  // (2 pve+pvp / 1.5 wvw) is Buff-typed and already covered by `wvw-fact-overrides.json`.
  622: { 'Number of Targets': 3 },

  // Protective Reviver (id 559, Honor Adept): "Cast Lesser Shield of Absorption when you begin
  // reviving an ally..." Wiki: `{{skill fact|Revive Percentage|15|game mode=pve}}` + `{{...|3|
  // game mode = wvw pvp}}` — pve 15, wvw+pvp 3.
  559: { 'Revive Percentage': 3 },

  // Honorable Staff (id 557, Honor Master): "Gain concentration. Empower now grants endurance to
  // allies..." Wiki: `{{skill fact|attribute|Concentration|120|game mode= = pve}}` + `{{...|60|
  // game mode = pvp wvw}}` (`AttributeAdjust`-typed) — pve 120, wvw+pvp 60.
  557: { Concentration: 60 },

  // Pure of Heart (id 549, Honor Master): "Aegis heals when it blocks an attack." Wiki: 3-way
  // `{{skill fact|healing|645|coefficient=0.5|game mode = pve}}` + `{{...|516|coefficient=0.15|
  // game mode = pvp}}` + `{{...|516|coefficient=0.2|game mode = wvw}}` — the base healing NUMBER
  // (what this table matches on, not the separate `coefficient` healing-calc.ts reads) is pve 645,
  // pvp+wvw share 516.
  549: { Healing: 516 },

  // Writ of Persistence (id 558, Honor Grandmaster): "Symbols are improved and heal allies." Wiki's
  // own literal template numbers show `107` for all 3 modes (a stale/unedited base-heal figure —
  // its 2024-10-08 version-history row says PvP/WvW healing was raised "to 107," but never updated
  // the wvw/pvp `{{skill fact}}` numbers to match), which does NOT reconcile with the live API's own
  // 3 raw facts (107 pve / 102 wvw / 102 pvp) — a small reference-build rounding gap, same shape
  // documented elsewhere in this table (Expanded Consciousness). Curated from the API's own values,
  // per this table's design of only ever picking among values that actually appear in the raw data:
  // pve 107, wvw+pvp 102.
  558: { Healing: 102 },

  // Force of Will (id 1682, Honor Grandmaster): "Gain increased vitality. Healing others is
  // improved based on a percentage of your vitality." Wiki: `{{skill fact|Healing Increase to
  // Others per 100 Vitality|1%|game mode = pve}}` + `{{...|0.5%|game mode = pvp wvw}}` — pve 1,
  // wvw+pvp 0.5.
  1682: { 'Healing Increase to Others per 100 Vitality': 0.5 },

  // Imbued Haste (id 2148, Firebrand Grandmaster minor): "Gain increased attributes while affected
  // by quickness." Wiki: `{{skill fact|attribute|Condition Damage|250|game mode=pve}}` + `{{...|
  // 150|game mode=wvw pvp}}` (and identically for Healing Power, Vitality) — pve 250, wvw+pvp 150
  // for all 3 attributes. All 3 raw `AttributeAdjust` facts carry no `text` field at all (only
  // `target`), the case this table's matching was extended to handle this same leg (see this
  // table's own top comment) — keyed by `target` here since there's no `text` to key by.
  2148: { ConditionDamage: 150, Healing: 150, Vitality: 150 },

  // Loremaster (id 2159, Firebrand Grandmaster): "Retain Resolve passive while it is on cooldown.
  // You generate pages more quickly." Wiki: `{{skill fact|interval|5|game mode = pve pvp}}` +
  // `{{...|6|game mode = wvw}}` (`Time`-typed) — pve+pvp 5, wvw 6, the rare WvW-slower-not-faster
  // case (a longer interval is worse here).
  2159: { Interval: 6 },

  // Power for Power (id 2190, Willbender Adept): "Gain increased power. Willbender Flames deal
  // increased damage to foes they strike." Wiki: `{{skill fact|Damage Increase|200|game
  // mode=pve}}` + `{{...|100|game mode=wvw pvp}}` (2026-07-15 PvE-only buff) — pve 200, wvw+pvp 100.
  2190: { 'Damage Increase': 100 },

  // Deathless Courage (id 2198, Willbender Grandmaster): "While Courage is active, incoming strike
  // damage and condition damage is reduced." Wiki: `{{skill fact|damage reduced|50|game
  // mode=pve}}` + `{{...|20|game mode=wvw pvp}}`, `{{skill fact|condition damage reduced|50|game
  // mode=pve}}` + `{{...|20|game mode=wvw pvp}}` — 2 independently-ambiguous labels, both pve 50 /
  // wvw+pvp 20.
  2198: { 'Damage Reduced': 20, 'Condition Damage Reduced': 20 },

  // Resolute Blessing (id 2417, Luminary Adept): "Luminary's Blessing now also reduces incoming
  // condition damage." Wiki: `{{skill fact|condition damage reduced|10|game mode = pve wvw}}` +
  // `{{...|5|game mode = pvp}}` — pve+wvw already share 10; this entry exists purely to collapse
  // the pvp-only 5 fact.
  2417: { 'Condition Damage Reduced': 10 },

  // Illuminating Inspiration (id 2368, Luminary Grandmaster): "Reduce the recharge of your virtue
  // skills when you equip a radiant weapon." Wiki: `{{skill fact|recharge time reduced|4|game
  // mode=pve}}` + `{{...|3|game mode=pvp}}` + `{{...|2|game mode=wvw}}` (`Time`-typed) — a genuine
  // 3-way split, all distinct.
  2368: { 'Recharge Time Reduced': 2 },

  // Warrior — 2nd leg of the "remaining 8 professions" main sweep (TODO.md, 2026-08-20). Same
  // process as the Guardian leg above: scanned all 9 Warrior spec lines' base facts for a
  // Number/Percent/AttributeAdjust/Time label repeated more than once, wiki-verified each split
  // (`Pure Strike` disambiguates to "Pure Strike (trait)" on the wiki, a same-named skill page
  // otherwise shadows it). Stalwart Strength (1708) and Bloody Roar (1928) each showed a "Damage
  // Increase" Percent fact twice but both copies carry the identical 10% value (no wiki split at
  // all) — already collapse for free via this function's own `seen` dedup, no entry needed, same
  // shape as Guardian's Zealot's Aggression. Sundering Burst's Vulnerability dupe (1316, `Buff`-typed)
  // belongs to `wvw-fact-overrides.json` instead — see that file's own Warrior-leg comment.

  // Bloodlust (id 1337, Arms Grandmaster minor): "Chance to inflict bleeding on critical hits;
  // bleeds you apply last longer." Wiki: `{{skill fact|duration increase|33%|game mode = pve}}` +
  // `{{...|15%|game mode = pvp wvw}}` — pve 33, wvw+pvp 15.
  1337: { 'Duration Increase': 15 },

  // Deep Strikes (id 1343, Arms Minor 2): "Gain condition damage. Increased critical-hit chance
  // while you have fury." Wiki: `{{skill fact|critical chance increase|5|game mode=pve}}` +
  // `{{...|10|game mode=pvp wvw}}` — pve 5, wvw+pvp 10, the rare WvW-higher case.
  1343: { 'Critical Chance Increase': 10 },

  // Merciless Hammer (id 1367, Defense Major 2): "Increase damage while wielding a hammer." Wiki:
  // `{{skill fact|Damage increase|25|game mode=pve}}` + `{{...|20|game mode=pvp wvw}}` — pve 25,
  // wvw+pvp 20.
  1367: { 'Damage Increase': 20 },

  // Cull the Weak (id 1372, Defense Adept): "Deal increased damage to foes with health below the
  // threshold." Wiki: `{{skill fact|damage increase|10|game mode = pve}}` + `{{...|7|game
  // mode = pvp wvw}}` — pve 10, wvw+pvp 7.
  1372: { 'Damage Increase': 7 },

  // Stalwart Focus (id 1381, Discipline Adept): "Increase healing to others. Increase incoming
  // healing." Wiki: `{{skill fact|Healing Increase|alt=Healing Increase to Others|15|game
  // mode=pve}}` + `{{...|10|game mode=pvp wvw}}`, `{{skill fact|Healing Increase|alt=Incoming
  // Healing Increase|10|game mode=pve}}` + `{{...|3|game mode=pvp wvw}}` — 2 independently-ambiguous
  // labels on one trait, both pve-high/wvw-low.
  1381: { 'Healing Increase to Others': 10, 'Incoming Healing Increase': 3 },

  // Warrior's Sprint (id 1413, Discipline Adept): "Gain increased movement speed and immunity to
  // cripple, chill, and immobilize while wielding a sword. Deal increased damage while under the
  // effects of swiftness." Wiki: `{{skill fact|damage increase|10|game mode=pve}}` + `{{...|3|game
  // mode=wvw pvp}}` — pve 10, wvw+pvp 3.
  1413: { 'Damage Increase': 3 },

  // Peak Performance (id 1444, Strength Adept): "Deal increased strike damage. Physical skills
  // further increase all outgoing strike damage for a period of time." Wiki: `{{skill fact|damage
  // increase|5|game mode= pve}}` + `{{...|3|game mode= wvw pvp}}` — pve 5, wvw+pvp 3. Its
  // "Peak Performance" effect Buff (6s, unsplit duration in both modes) also carries an embedded
  // pve-10%/wvw+pvp-7% bonus via the wiki's `effect bonus number=` param, not expressible through
  // this table (or `WvwFactOverride`, duration-only) — same "can't express an embedded sub-value"
  // shape as other effect-Buff facts, left undocumented-gap rather than modeled wrong.
  1444: { 'Damage Increase': 3 },

  // Leg Specialist (id 1469, Tactics Adept): "Immobilize foes when you disable them. Deal increased
  // damage to disabled foes." Wiki: `{{skill fact|Damage Increase|5|game mode = pve}}` + `{{...|7|
  // game mode = pvp wvw}}` — pve 5, wvw+pvp 7, the rare WvW-higher case.
  1469: { 'Damage Increase': 7 },

  // Vigorous Shouts (id 1470, Tactics Grandmaster): "Shouts heal nearby allies." Wiki: `{{skill
  // fact|healing|1000|coefficient=1.2|game mode = pve}}` + `{{...|1000|coefficient=1.32|game
  // mode = wvw}}` + `{{...|800|coefficient=0.9|game mode = pvp}}` — pve and wvw land on the exact
  // same displayed number (1000) despite different coefficients, so this entry exists purely to
  // drop the raw API's 3rd (pvp-only) `AttributeAdjust` fact (808, a small reference-build rounding
  // gap off the wiki's 800, same shape as Writ of Persistence/Expanded Consciousness) — without it,
  // 808 would show as a spurious 2nd "Healing" line alongside the correct 1,000 one.
  1470: { Healing: 1000 },

  // Roaring Reveille (id 1471, Tactics Adept minor): "Charge grants fury. Call of Valor grants
  // resistance and boon duration." Wiki: `{{skill fact|attribute|Concentration|120|game mode =
  // pve}}` + `{{...|60|game mode = pvp wvw}}` — pve 120, wvw+pvp 60. The raw API fact's own `target`
  // is literally `"BoonDuration"` (not `"Concentration"`, unlike Guardian's Honorable Staff — the
  // API uses different literal strings for the same Concentration-attribute concept depending on
  // the trait), keyed here to match. Its Fury/Resistance `PrefixedBuff` facts carry no split.
  1471: { BoonDuration: 60 },

  // Warrior's Cunning (id 1486, Tactics Major 2): "Deal increased damage to foes above the health
  // threshold. Deal increased damage to barrier." Wiki: `{{skill fact|damage increase|25|alt=Damage
  // Increase vs. High Health|game mode = pve}}` + `{{...|7|game mode = wvw pvp}}`, `{{skill
  // fact|damage increase|50|alt=Damage Increase vs. Barrier|game mode = pve}}` + `{{...|10|game
  // mode = wvw pvp}}` — 2 independently-ambiguous labels, both pve-high/wvw-low.
  1486: { 'Damage Increase vs. High Health': 7, 'Damage Increase vs. Barrier': 10 },

  // Burst Mastery (id 1657, Discipline Grandmaster): "Increase damage of burst skills. Gain
  // adrenaline reduction and swiftness on burst skill use." Wiki: `{{skill fact|Damage Increase|15|
  // game mode=pve}}` + `{{...|7|game mode=wvw pvp}}` — pve 15, wvw+pvp 7.
  1657: { 'Damage Increase': 7 },

  // Martial Cadence (id 1667, Tactics Grandmaster): "Remove a condition and gain stability when you
  // use a shout skill." Wiki: `{{skill fact|conditions removed|2|game mode=pve pvp}}` + `{{...|1|
  // game mode=wvw}}` — pve+pvp 2, wvw 1. (Its separate Stability/Quickness `Buff` facts are the
  // already-documented WvW boon-type-swap case in `fetch-wvw-splits.ts`'s own top comment — not a
  // Number/Percent ambiguity, out of this table's scope.)
  1667: { 'Conditions Removed': 1 },

  // King of Fires (id 2038, Berserker Grandmaster): "Throw Bonfire, granting fire aura and
  // increasing burning duration." Wiki: `{{skill fact|duration increase|33%|game mode = pve}}` +
  // `{{...|10%|game mode = pvp wvw}}` — pve 33, wvw+pvp 10.
  2038: { 'Duration Increase': 10 },

  // Fatal Frenzy (id 2046, Berserker Minor 3): "Gain power. Gain increased condition damage while
  // berserk." Wiki: `{{skill fact|attribute|Condition Damage|150|game mode=pve}}` + `{{...|300|
  // game mode=wvw pvp}}` — pve 150, wvw+pvp 300, the rare WvW-higher case. No `text` field on this
  // fact, keyed by `target` ("ConditionDamage") like Imbued Haste.
  2046: { ConditionDamage: 300 },

  // Smash Brawler (id 2049, Berserker Adept): "Increase burst skill duration and critical chance."
  // Wiki: `{{skill fact|Duration Increase|2|game mode=pve}}` + `{{...|1|game mode=wvw pvp}}`
  // (`Time`-typed), `{{skill fact|Critical Chance Increase|15|game mode = pve pvp}}` + `{{...|5|
  // game mode = wvw}}` — 2 independently-ambiguous labels, both pve-high/wvw-low.
  2049: { 'Duration Increase': 1, 'Critical Chance Increase': 5 },

  // Sun and Moon Style (id 2095, Spellbreaker Major 2): "Convert a portion of outgoing strike damage
  // to healing." Wiki: `{{skill fact|Damage to Healing|4%|game mode=pve}}` + `{{...|7%|game
  // mode=wvw pvp}}` — pve 4, wvw+pvp 7, the rare WvW-higher case.
  2095: { 'Damage to Healing': 7 },

  // Pure Strike (id 2107, Spellbreaker Adept): "Deal increased critical-hit damage, doubled against
  // boonless foes." The bare wiki title "Pure Strike" is a disambiguation page shadowing an
  // unrelated skill — the trait's actual page is "Pure Strike (trait)". Wiki: `{{skill fact|critical
  // damage increase|5|game mode = pve}}` + `{{...|7|game mode = wvw pvp}}`, `{{skill fact|critical
  // damage increase|alt=Boonless Critical Damage Increase|10|game mode = pve}}` + `{{...|14|game
  // mode = wvw pvp}}` — 2 independently-ambiguous labels, both wvw-higher.
  2107: { 'Critical Damage Increase': 7, 'Boonless Critical Damage Increase': 14 },

  // Resolute Counter (id 2168, Spellbreaker Grandmaster): "Remove conditions and heal when you
  // interrupt a foe." Wiki: `{{skill fact|Healing|1620|coefficient=0.1|game mode=pve}}` + `{{...|
  // 820|coefficient=0.1|game mode=pvp wvw}}` — pve 1620, wvw+pvp 820.
  2168: { Healing: 820 },

  // Unyielding Resolve (id 2340, Paragon Minor 3): "Reduce incoming strike damage while under the
  // effects of a chant." Wiki: `{{skill fact|damage reduced|1.5|game mode = pve}}` + `{{...|1|game
  // mode = wvw pvp}}` — pve 1.5, wvw+pvp 1.
  2340: { 'Damage Reduced': 1 },

  // Rally the Valiant (id 2373, Paragon Minor 1): "Gain motivation when you rally." Wiki: `{{skill
  // fact|Motivation Stacks|4|game mode = pve}}` + `{{...|3|game mode = wvw pvp}}` — pve 4, wvw+pvp 3.
  2373: { 'Motivation Stacks': 3 },

  // Inspiring Implements (id 2418, Paragon Minor 2): "Gain concentration. Gain motivation when
  // wielding a spear." Wiki: `{{skill fact|attribute|Concentration|180|game mode=pve}}` + `{{...|
  // 60|game mode=pvp wvw}}`, `{{skill fact|Motivation Stacks|2|game mode=pve}}` + `{{...|1|game
  // mode=wvw pvp}}` — 2 independently-ambiguous labels, both pve-high/wvw-low. Same `"BoonDuration"`
  // target-keying note as Roaring Reveille above.
  2418: { BoonDuration: 60, 'Motivation Stacks': 1 },

  // Invigorating Tempo (id 2426, Paragon Major 2): "Heal allies based on motivation spent." Wiki:
  // `{{skill fact|healing|alt=Healing per Motivation Spent|660|coefficient=0.1|game mode=pve}}` +
  // `{{...|148|coefficient=0.05|game mode=wvw pvp}}` — pve 660, wvw+pvp 148.
  2426: { 'Healing per Motivation Spent': 148 },

  // Mesmer — 3rd leg of the "remaining 8 professions" main sweep (TODO.md, 2026-08-20). Same process
  // as the Guardian/Warrior legs above: scanned all 9 Mesmer spec lines' base facts for a
  // Number/Percent/AttributeAdjust/Time label repeated more than once, wiki-verified each split.
  // Compounding Power (723) and Zealot's-Aggression-shaped "Maximum Stacks" (5/5, no wiki split) and
  // Restorative Illusions' (1866) 4 clone-tier Healing facts (219/552/744/936, each identical across
  // all 3 modes despite different `coefficient=` values — same "same displayed number, different
  // coefficient" shape as Warrior's Vigorous Shouts) already collapse for free via this function's
  // own `seen` dedup, no entries needed. Illusionary Inspiration's (1915) "Healing Increase to
  // Others" fact (5/5, no split) is the same shape, alongside its genuinely-split Healing fact
  // (curated below). Life of the Party (Troubadour, id 2367) has a real pve/wvw/pvp Might/Quickness
  // split, but on `PrefixedBuff`-typed per-linked-skill (Lively Lute/Crescendo) facts — same
  // out-of-scope shape as Vindicator's Reaver's Curse/Salvation's Generous Abundance above, left for
  // a future per-skill-mapping leg rather than attempted here.

  // Mental Anguish (id 680, Domination Grandmaster): "Shatter skills deal more damage. This bonus
  // damage is doubled against foes that are not activating skills." Wiki: `{{skill fact|damage
  // increase|25|game mode=pve}}` + `{{...|10|game mode=wvw pvp}}`, `{{skill fact|damage
  // increase|alt=Damage Increase vs. Inactivity|50|game mode=pve}}` + `{{...|20|game mode=wvw
  // pvp}}` — 2 independently-ambiguous labels, both pve-high/wvw-low. The raw API lists each
  // wvw+pvp value twice (once per mode) rather than once for a shared "wvw pvp" mode — harmless,
  // already collapses via this function's own `seen` dedup.
  680: { 'Damage Increase': 10, 'Damage Increase vs. Inactivity': 20 },

  // Vicious Expression (id 681, Domination Grandmaster): "You and your illusions deal increased
  // strike damage. Strike damage is further increased against foes without boons. Disabling a foe
  // removes boons from them." Wiki: `{{skill fact|damage increase|10|game mode=pve}}` + `{{...|7|
  // game mode=wvw pvp}}`, `{{skill fact|boons removed|2|game mode=pve}}` + `{{...|1|game mode=wvw
  // pvp}}` — 2 independently-ambiguous labels, both pve-high/wvw-low. Its unsplit "Damage Increase
  // against Boonless Foes" fact (15, no game-mode param at all) is a separate, unambiguous concept.
  681: { 'Damage Increase': 7, 'Boons Removed': 1 },

  // Medic's Feedback (id 756, Inspiration Adept): "Cast Feedback while reviving an ally. Feedback
  // revives allies inside its dome." Wiki: `{{skill fact|Revive Percentage|5|game mode=pve}}` +
  // `{{...|1|game mode=wvw pvp}}` — pve 5, wvw+pvp 1.
  756: { 'Revive Percentage': 1 },

  // Time Marches On (id 1859, Chronomancer Grandmaster minor): "You move 25% faster. Alacrity
  // applied to you is stronger." Wiki: `{{skill fact|Recharge Speed|50%|game mode = pve}}` +
  // `{{...|33%|game mode = wvw pvp}}` — pve 50, wvw+pvp 33. Its separate "Movement Speed Increase"
  // fact (25, unsplit) is a different, unambiguous concept.
  1859: { 'Recharge Speed': 33 },

  // Chaotic Persistence (id 1865, Chaos Grandmaster minor): "Gain concentration and expertise while
  // affected by regeneration." Wiki: `{{skill fact|attribute|Concentration|250|game mode = pve
  // wvw}}` + `{{...|150|game mode = pvp}}` (pve+wvw share 250, pvp alone drops to 150) + `{{skill
  // fact|attribute|Expertise|100|game mode = pve}}` + `{{...|250|game mode = wvw}}` + `{{...|150|
  // game mode = pvp}}` (a genuine 3-way split, wvw the high outlier at 250) — both `AttributeAdjust`,
  // keyed by `target` (`BoonDuration`/`ConditionDuration`, the API's literal strings for the
  // Concentration/Expertise concepts respectively, same non-obvious naming as Warrior's Roaring
  // Reveille/Guardian's Honorable Staff).
  1865: { BoonDuration: 250, ConditionDuration: 250 },

  // Chronophantasma (id 1890, Chronomancer Grandmaster): "The first time a phantasm would become a
  // clone, it instead resummons itself and attacks again. Resummoned phantasms inflict a percentage
  // of the original's damage." Wiki: `{{skill fact|percent|105|game mode=pve}}` + `{{...|50|game
  // mode=wvw pvp}}`, `{{skill fact|daze|0.25|game mode = pve}}` + `{{...|1.5|game mode = wvw pvp}}`
  // — the raw API's `Time`-typed Daze facts round to whole seconds (0.25 -> 0, 1.5 -> 2, same
  // reference-build rounding gap as Warrior's Vigorous Shouts/Guardian's Writ of Persistence), so
  // this table picks the API's own rounded 2 rather than the wiki's unrounded 1.5.
  1890: { Percent: 50, Daze: 2 },

  // Illusionary Inspiration (id 1915, Inspiration Grandmaster minor): "Increase healing to other
  // allies. Summoning an illusion heals all allies around you." Wiki: `{{skill fact|healing|212|
  // coefficient = 0.3|game mode = pve}}` + `{{...|106|coefficient = 0.15|game mode = wvw}}` +
  // `{{...|106|coefficient = 0.10|game mode = pvp}}` — pve 212, wvw+pvp share 106 (though reached via
  // different coefficients).
  1915: { Healing: 106 },

  // Flow of Time (id 1927, Chronomancer Master minor): "Gain alacrity for each clone you shatter.
  // Gain increased critical-strike chance for you and your clones when you have alacrity." Wiki:
  // `{{skill fact|critical chance increase|15|game mode=pve}}` + `{{...|10|game mode=wvw pvp}}` —
  // pve 15, wvw+pvp 10.
  1927: { 'Critical Chance Increase': 10 },

  // Time Catches Up (id 1995, Chronomancer Adept): "Activating a Shatter gives your illusions
  // superspeed. Shatters deal increased damage to movement-impaired foes." Wiki: `{{skill
  // fact|damage increase|10|game mode=pve}}` + `{{...|5|game mode=wvw pvp}}` — pve 10, wvw+pvp 5.
  1995: { 'Damage Increase': 5 },

  // Danger Time (id 2009, Chronomancer Master): "When you inflict slow, you and your clones'
  // outgoing critical-strike damage is increased for a duration." Wiki: `{{skill fact|critical
  // damage increase|5|game mode = pve}}` + `{{...|10|game mode = wvw pvp}}` — pve 5, wvw+pvp 10,
  // the rare WvW-higher case.
  2009: { 'Critical Damage Increase': 10 },

  // Nomad's Endurance (id 2069, Mirage Master minor): "Shatter skills give vigor. Strike and
  // condition damage dealt is increased when you have vigor." Wiki: `{{skill fact|Damage
  // Increase|alt=Strike Damage Increase|10|game mode=pve wvw}}` + `{{...|5|game mode=pvp}}` (pve+wvw
  // share 10, pvp alone drops to 5) + `{{skill fact|Damage Increase|alt=Condition Damage
  // Increase|5|game mode = pve}}` + `{{...|10|game mode = wvw pvp}}` (pve 5, wvw+pvp 10, WvW-higher)
  // — 2 independently-ambiguous labels. Its separate Vigor duration (3 pve / 1.5 pvp+wvw) is
  // `Buff`-typed, out of this table's scope.
  2069: { 'Strike Damage Increase': 10, 'Condition Damage Increase': 10 },

  // Elusive Mind (id 2113, Mirage Grandmaster): "Lose conditions when you gain Mirage Cloak." Wiki:
  // `{{skill fact|conditions removed|3|game mode = pve}}` + `{{...|1|game mode = pvp wvw}}` — pve 3,
  // wvw+pvp 1.
  2113: { 'Conditions Removed': 1 },

  // Dune Cloak (id 2169, Mirage Grandmaster): "Shatter skills grant Mirage Cloak if you have enough
  // clones present. Gaining Mirage Cloak recharges Mind Wrack and Cry of Frustration." Wiki: `{{skill
  // fact|Recharge Time Reduced|1|game mode=pve}}` + `{{...|1.5|game mode=wvw}}` + `{{...|0.5|game
  // mode=pvp}}` (a genuine 3-way split; the API rounds 1.5 -> 2 and 0.5 -> 1, so the wvw-correct
  // value shows as 2 in the raw data, same rounding-gap shape as Chronophantasma above) + `{{skill
  // fact|Required Clones|3|game mode=pve pvp}}` + `{{...|2|game mode=wvw}}` (pve+pvp share 3, wvw
  // alone drops to 2) — 2 independently-ambiguous labels.
  2169: { 'Recharge Time Reduced': 2, 'Required Clones': 2 },

  // Quiet Intensity (id 2193, Virtuoso Grandmaster minor): "Fury gives an increased critical chance.
  // Gain ferocity based on your vitality." Wiki: `{{skill fact|Critical Chance Increase|15|game
  // mode=pve}}` + `{{...|10|game mode=pvp wvw}}` — pve 15, wvw+pvp 10. Its separate Fury duration (40
  // pve / 30 wvw+pvp) is `Buff`-typed, out of this table's scope.
  2193: { 'Critical Chance Increase': 10 },

  // Infinite Forge (id 2206, Virtuoso Major 2): "Automatically stock blades while in combat. When
  // you use bladesong above the blade threshold, refund blades. Blade attacks deal more damage."
  // Wiki: `{{skill fact|damage increase|7|game mode = pve}}` + `{{...|10|game mode = wvw pvp}}` —
  // pve 7, wvw+pvp 10, the rare WvW-higher case.
  2206: { 'Damage Increase': 10 },

  // Mental Focus (id 2208, Virtuoso Adept): "Strike damage is increased against foes within the
  // range threshold." Wiki: `{{skill fact|Damage Increase|5|game mode = pve}}` + `{{...|7|game mode
  // = pvp wvw}}` — pve 5, wvw+pvp 7, the rare WvW-higher case.
  2208: { 'Damage Increase': 7 },

  // Raconteur (id 2326, Troubadour Adept): "Tales heal and grant protection to nearby allies." Wiki:
  // `{{skill fact|healing|980|coefficient=0.6|game mode = pve}}` + `{{...|660|coefficient=0.4|game
  // mode = wvw pvp}}` — pve 980, wvw+pvp 660.
  2326: { Healing: 660 },

  // Shredding (id 2343, Troubadour Master): "Lively Lute fires an additional wave at your enemy. The
  // lute's damage bonus is increased." Wiki: `{{skill fact|damage increase|alt=Lute-Playing Damage
  // Increase|15|game mode=pve}}` + `{{...|10|game mode=wvw pvp}}` — pve 15, wvw+pvp 10. (Closes the
  // confirmed-live instance TODO.md flagged before this leg started.)
  2343: { 'Lute-Playing Damage Increase': 10 },

  // Fortissimo (id 2353, Troubadour Grandmaster): "After using Crescendo, gain a note every interval
  // for a duration. Gain increased attributes for each instrument you have playing." Wiki: `{{skill
  // fact|Attribute Increase per Instrument|4%|game mode=pve wvw}}` + `{{...|2.5%|game mode=pvp}}` —
  // pve+wvw share 4, pvp alone drops to 2.5. Its `missing facts` per-instrument all-stats bonuses
  // (Lute/Flute/Drum/Harp Playing effects) mirror the same split but are embedded `effect bonus
  // number=` sub-values on effect facts not present in the local API data at all, same "documented on
  // the wiki, absent from the API" shape as other loose ends in this table — nothing to curate.
  2353: { 'Attribute Increase per Instrument': 4 },

  // Love Song (id 2422, Troubadour Master): "Harmonious Harp's distortion lasts longer. Strike
  // damage from nearby enemies is reduced while the harp is playing in the background." Wiki:
  // `{{skill fact|Damage Reduced|10|game mode=pve}}` + `{{...|7|game mode=wvw pvp}}` — pve 10,
  // wvw+pvp 7.
  2422: { 'Damage Reduced': 7 },

  // Engineer — 4th leg of the "remaining 8 professions" main sweep (TODO.md, 2026-08-20). Same
  // process as the Guardian/Warrior/Mesmer legs above: scanned all 9 Engineer spec lines (5 core +
  // Scrapper/Holosmith/Mechanist/Amalgam) for a Number/Percent/AttributeAdjust/Time label repeated
  // more than once, wiki-verified each split, plus a separate Buff-type same-status scan (the
  // Mesmer leg's own follow-up requirement). Sharpshooter (526, "Power Converted to Bleeding
  // Damage" 4/4), Soothing Detonation (1834, "Healing" 340/340), and Mech Core: Barrier Engine
  // (2281, "Barrier" 217/217) are genuinely-identical dupes needing no override (already collapse
  // via this function's own `seen` dedup).
  //
  // Buff-type findings from this leg (see `wvw-fact-overrides.json`/`BUFF_INSTANCE_LABELS`/
  // `BUFF_INSTANCE_VALUE_OVERRIDES` in `boon-calc/sources.ts` for the actual fixes, out of this
  // table's scope): Incendiary Powder (433, Burning) and Serrated Steel (515, Bleeding) each carry
  // only ONE raw Buff fact (the pve duration), wiki-confirmed already correctly overridden to the
  // wvw+pvp duration by an earlier, broader sweep (commit feab9d4) — re-verified, not new this leg.
  // Carbolic Composition (2383, Poisoned) turned out to be the same single-raw-fact shape but was
  // NOT yet covered — confirms `WvwFactOverride` doesn't need a matching raw duplicate to fix this
  // at all, it unconditionally REPLACES the single occurrence's duration; added a real
  // `wvw-fact-overrides.json` entry for it despite there being no live wvw-valued duplicate to
  // filter against. Also found and fixed 3 latent bugs in ALREADY-curated Engineer Buff
  // overrides from an earlier sweep (HGH id 473, Kinetic Accelerators id 2052, Photonic Blasting
  // Module id 2064): each has a plain per-status `WvwFactOverride` that only replaces `duration`,
  // but the raw facts it's matching against ALSO have differing `apply_count` (stack count) across
  // modes — the plain override kept the FIRST-encountered occurrence's own (wrong) apply_count,
  // silently showing e.g. HGH's Might as "8s, 2 stacks" instead of the real wvw "8s, 3 stacks".
  // Converted all 3 to `BUFF_INSTANCE_VALUE_OVERRIDES` entries instead (omit the wrong occurrences,
  // let the wvw-correct tuple — which already exists as its OWN distinct raw fact with the right
  // duration+apply_count pair together — pass through untouched). This same omit-the-others trick
  // also resolved New Genes' (2387) Might pair, previously assumed unfixable ("`WvwFactOverride`
  // can't express apply_count changes", the same limitation documented on Warrior/Necromancer-leg
  // Eviscerate/Falling Spider/Brutal Shot): it turns out that limitation only blocks the *plain*
  // per-status override, not the occurrence-indexed one, whenever the correct tuple already exists
  // as its own raw fact rather than needing to be synthesized — worth rechecking those older
  // "left open" cases with this same trick on a future pass, not attempted here (out of this leg's
  // scope). 2 further real gaps found and deliberately left uncurated: Mech Frame: Channeling
  // Conduits (2276) grants Alacrity in pve/pvp but swaps to Might entirely in wvw (both facts
  // currently show unconditionally) — the same boon-type-swap shape `WvwFactOverride` can't express
  // as Guardian's Phoenix Protocol; Crystal Configuration: Zephyr's (2091) apparent Crippled
  // "duplicate" is a scan false positive (one fact is a condition-cleanse marker with no `duration`,
  // already filtered out by `extractFromFacts` before reaching any override table — same shape as
  // the Warrior leg's Knot Shot/Brutal Shot false positives).

  // Compounding Chemicals (id 413, Alchemy Grandmaster minor): "Heal yourself when you grant
  // yourself a boon. Remove a condition from yourself when you use an elixir skill. Gain increased
  // concentration." Wiki: `{{skill fact|attribute|Concentration|240|game mode = pve}}` + `{{...|75|
  // game mode = pvp wvw}}` (`AttributeAdjust`, no `text`, keyed by `target` "BoonDuration") — pve
  // 240, wvw+pvp 75.
  413: { BoonDuration: 75 },

  // Incendiary Powder (id 433, Firearms Grandmaster major): "Burning you inflict on a target gains
  // increased duration." Wiki: `{{skill fact|duration increase|33%|game mode = pve}}` + `{{...|10%|
  // game mode = pvp wvw}}` — pve 33, wvw+pvp 10. (Its Burning duration itself is a separate,
  // single-raw-fact Buff gap — see this table's own intro comment above.)
  433: { 'Duration Increase': 10 },

  // Serrated Steel (id 515, Firearms Adept minor): "Critical hits have a chance to cause bleeding.
  // Bleeding you inflict gains increased duration." Wiki: `{{skill fact|duration increase|33%|game
  // mode = pve}}` + `{{...|15%|game mode = pvp wvw}}` — pve 33, wvw+pvp 15. (Its Bleeding duration
  // itself is a separate, single-raw-fact Buff gap — see this table's own intro comment above.)
  515: { 'Duration Increase': 15 },

  // Modified Ammunition (id 516, Firearms Grandmaster minor): "Deal increased strike damage for
  // each condition on a foe." Wiki: `{{skill fact|damage increase|1|game mode=pve wvw}}` + `{{...|
  // 2|game mode=pvp}}` — pve+wvw share 1, pvp alone rises to 2.
  516: { 'Damage Increase': 1 },

  // Hematic Focus (id 536, Firearms Master minor): "Gain fury when you inflict bleeding on an
  // enemy. Fury gives an increased critical-strike chance." Wiki: `{{skill fact|critical chance
  // increase|15|game mode=pve}}` + `{{...|10|game mode=pvp}}` + `{{...|5|game mode=wvw}}` — a
  // genuine 3-way split, all distinct.
  536: { 'Critical Chance Increase': 5 },

  // Applied Force (id 1849, Scrapper Grandmaster major): "Gain stability when you gain might at or
  // above the threshold. Might grants bonus power." Wiki: `{{skill fact|attribute|Power|30|game
  // mode = pve}}` + `{{...|15|game mode = pvp}}` + `{{...|10|game mode = wvw}}` — a genuine 3-way
  // split, all distinct.
  1849: { Power: 10 },

  // Chain Reactivity (id 1854, Alchemy Grandmaster major): "Gain barrier when you successfully
  // finish a combo field with a leap or a blast. Every third successful finish grants you might and
  // a larger barrier that is shared with allies." Wiki: `{{skill fact|barrier|alt=Ally Barrier|
  // 1000|coefficient=0.2|game mode=pve pvp}}` + `{{...|500|coefficient=0.1|game mode=wvw}}` — pve+
  // pvp share 1000, wvw alone drops to 500. Its other 2 Barrier facts (base 500, "Third-Trigger
  // Barrier" 1500) and Might fact carry no split.
  1854: { 'Ally Barrier': 500 },

  // Object in Motion (id 1860, Scrapper Grandmaster minor): "Gain stability, swiftness, and
  // superspeed when you dodge. Deal increased strike damage based on your boons." Wiki: `{{skill
  // fact|damage increase|alt=Damage per Boon|5|game mode=pve pvp}}` + `{{...|3|game mode=wvw}}` —
  // pve+pvp share 5 (the raw API lists this shared value twice, once per mode, same harmless
  // over-listing as Righteous Instincts), wvw alone drops to 3.
  1860: { 'Damage per Boon': 3 },

  // Impact Savant (id 1877, Scrapper Master major): "Function Gyro converts a percentage of its
  // remaining barrier into healing when it's destroyed or expires." Wiki: `{{skill fact|Barrier|
  // alt=Conversion Percent|5%|game mode = pve}}` + `{{...|15%|game mode = wvw}}` + `{{...|10%|game
  // mode = pvp}}` — a genuine 3-way split, wvw the high outlier.
  1877: { 'Conversion Percent': 15 },

  // Glass Cannon (id 1882, Explosives Grandmaster major): "Deal increased strike damage while above
  // the health threshold." Wiki: `{{skill fact|damage increase|7|game mode=pve}}` + `{{...|10|game
  // mode=pvp}}` + `{{...|5|game mode=wvw}}` — a genuine 3-way split, wvw the low outlier.
  1882: { 'Damage Increase': 5 },

  // High Caliber (id 1914, Firearms Master minor): "Deal increased critical-hit chance against foes
  // above the range threshold." Wiki: `{{skill fact|Critical Chance Increase|15|game mode=pve
  // pvp}}` + `{{...|10|game mode=wvw}}` — pve+pvp share 15, wvw alone drops to 10.
  1914: { 'Critical Chance Increase': 10 },

  // Medical Dispersion Field (id 1916, Inventions Grandmaster major): "Periodically heal nearby
  // allies." Wiki: `{{skill fact|Healing|33%|game mode = pve}}` + `{{...|7%|game mode = wvw}}` +
  // `{{...|17%|game mode = pvp}}` — a genuine 3-way split, wvw the low outlier.
  1916: { Healing: 7 },

  // Blast Shield (id 1944, Explosives Grandmaster major): "Grant barrier to nearby allies when you
  // gain stability." Wiki: `{{skill fact|Barrier|1508|coefficient=0.25|game mode = pve}}` + `{{...|
  // 340|coefficient=0.25|game mode = pvp wvw}}` (`AttributeAdjust`, `target: 'Healing'`) — pve
  // 1508, wvw+pvp 340.
  1944: { Barrier: 340 },

  // Big Boomer (id 1947, Explosives Grandmaster major): "Elite skills deal increased strike damage
  // and heal you." Wiki: `{{skill fact|damage increase|15|game mode = pve}}` + `{{...|10|game
  // mode = wvw pvp}}` — pve 15, wvw+pvp 10. Its "Big Boomer" effect fact carries an embedded pve-
  // 606/wvw+pvp-303 heal sub-value via the wiki's `desc=` param, not expressible through this table
  // (or `WvwFactOverride`) — same "can't express an embedded sub-value" shape as Warrior's Peak
  // Performance, left as a documented gap.
  1947: { 'Damage Increase': 10 },

  // System Shocker (id 1971, Scrapper Adept major): "Disabling a foe grants barrier to nearby
  // allies. Your function gyro dazes foes when cast." Wiki: `{{skill fact|barrier|724|
  // coefficient=0.11|game mode = pve wvw}}` + `{{...|362|coefficient=0.11|game mode = pvp}}`
  // (`AttributeAdjust`, `target: 'Healing'`) — pve+wvw share 724, pvp alone drops to 362.
  1971: { Barrier: 362 },

  // Juggernaut (id 1984, Firearms Master major): "Gain might while wielding a flamethrower. Might
  // applied to you gains increased duration. Napalm grants you stability and a fire aura." Wiki:
  // `{{skill fact|Duration Increase|20%|game mode = pve}}` + `{{...|10%|game mode = pvp wvw}}` —
  // pve 20, wvw+pvp 10. Its Might Buff dupe (12/6) is already covered by the separate
  // `wvw-fact-overrides.json` script (`trait[1984]`).
  1984: { 'Duration Increase': 10 },

  // Thermal Vision (id 2006, Firearms Master major): "Gain expertise. Increase your outgoing
  // condition damage when you inflict burning." Wiki: `{{skill fact|attribute|Expertise|150|game
  // mode = pve}}` + `{{...|60|game mode = pvp wvw}}` (`AttributeAdjust`, no `text`, keyed by
  // `target` "ConditionDuration" — the API's literal string for the Expertise-attribute concept,
  // same non-obvious naming as Mesmer's Chaotic Persistence) — pve 150, wvw+pvp 60.
  2006: { ConditionDuration: 60 },

  // Laser's Edge (id 2122, Holosmith Grandmaster minor): "While Photon Forge is active, your
  // outgoing strike damage is increased based on your current heat." Wiki: `{{skill fact|damage
  // increase|alt=Maximum Damage Increase|15|game mode=pve pvp}}` + `{{...|10|game mode=wvw}}` —
  // pve+pvp share 15, wvw alone drops to 10.
  2122: { 'Maximum Damage Increase': 10 },

  // Heat Therapy (id 2135, Holosmith Master minor): "Gain health per unit of heat lost." Wiki:
  // `{{skill fact|healing|65|alt=Heal per unit of heat|coefficient=0.006|game mode=pve}}` + `{{...|
  // 39|...|game mode=wvw pvp}}` — pve 65, wvw+pvp 39.
  2135: { 'Heal per unit of heat': 39 },

  // Crystal Configuration: Eclipse (id 2152, Holosmith Master major): "Corona Burst grants a
  // barrier for each target struck." Wiki: `{{skill fact|barrier|alt=Barrier on First Hit|2256|
  // coefficient=0.115|game mode = pve}}` + `{{...|1804|...|game mode = pvp wvw}}` — pve 2256,
  // wvw+pvp 1804.
  2152: { 'Barrier on First Hit': 1804 },

  // Mech Fighter (id 2266, Mechanist Master minor): "Your mech gains a greater percentage of your
  // own toughness and vitality stats." Wiki: `{{skill fact|Toughness and Vitality Inherited by
  // Mech|100%|game mode = pve wvw}}` + `{{...|50%|game mode = pvp}}` — pve+wvw share 100, pvp alone
  // drops to 50.
  2266: { 'Toughness and Vitality Inherited by Mech': 100 },

  // Mech Frame: Conductive Alloys (id 2270, Mechanist Master major): "Your mech gains a greater
  // percentage of your own condition damage and expertise stats." Wiki: `{{skill fact|Condition
  // Damage Inherited by Mech|100%|game mode=pve wvw}}` + `{{...|80%|game mode=pvp}}`, `{{skill
  // fact|Expertise Inherited by Mech|100%|game mode=pve wvw}}` + `{{...|80%|game mode=pvp}}` — 2
  // independently-ambiguous labels, both pve+wvw 100 / pvp 80.
  2270: { 'Condition Damage Inherited by Mech': 100, 'Expertise Inherited by Mech': 100 },

  // Mech Frame: Channeling Conduits (id 2276, Mechanist Master major): "Your mech gains a greater
  // percentage of your concentration and healing power stats." Wiki: `{{skill fact|Concentration
  // Inherited by Mech|150%|game mode=pve}}` + `{{...|80%|game mode=pvp wvw}}`, `{{skill
  // fact|Healing Power Inherited by Mech|100%|game mode=pve}}` + `{{...|80%|game mode=pvp wvw}}` —
  // 2 independently-ambiguous labels, both pve-high/wvw+pvp-low. This trait's Alacrity/Might
  // boon-type swap (see this table's own intro comment above) is a separate, deliberately
  // uncurated gap.
  2276: { 'Concentration Inherited by Mech': 80, 'Healing Power Inherited by Mech': 80 },

  // Mech Arms: Jade Cannons (id 2279, Mechanist Adept major): "Melee attacks become ranged, have an
  // increased chance to critically hit, and apply vulnerability." Wiki: `{{skill fact|critical
  // chance increase|20|game mode=pve}}` + `{{...|5|game mode=wvw pvp}}` — pve 20, wvw+pvp 5.
  2279: { 'Critical Chance Increase': 5 },

  // Mechanical Genius (id 2291, Mechanist Adept minor): "Your mech inherits a percentage of all of
  // your combat attributes except precision, which is added to its own." Wiki: `{{skill fact|All
  // Stats Inherited by Mech|50%|game mode = pve wvw}}` + `{{...|30%|game mode = pvp}}` — pve+wvw
  // share 50, pvp alone drops to 30.
  2291: { 'All Stats Inherited by Mech': 50 },

  // Mech Frame: Variable Mass Distributor (id 2294, Mechanist Master major): "Your mech gains a
  // greater percentage of your own precision stats." Wiki: `{{skill fact|Precision Inherited by
  // Mech|100%|game mode=pve wvw}}` + `{{...|80%|game mode=pvp}}` — pve+wvw share 100, pvp alone
  // drops to 80.
  2294: { 'Precision Inherited by Mech': 100 },

  // Double Helix (id 2334, Amalgam Grandmaster major): "Evolve has two charges and grants an
  // increased attribute bonus." Wiki: `{{skill fact|Effectiveness Increased|100%|game mode=pve}}` +
  // `{{...|20%|game mode=wvw pvp}}` — pve 100, wvw+pvp 20. Its embedded per-attribute "Evolved"
  // effect bonus (20%/12%) is a `missing facts` entry absent from the local API data entirely,
  // same "documented on the wiki, absent from the API" shape as other loose ends in this table.
  2334: { 'Effectiveness Increased': 20 },

  // Stainless Steel (id 2366, Amalgam Adept major): "Convert conditions to boons when you use a
  // stance skill or evolve." Wiki: `{{skill fact|Conditions Converted to Boons|alt=Conditions
  // Converted on Stance|2|game mode=pve}}` + `{{...|1|game mode=wvw pvp}}` — pve 2, wvw+pvp 1. Its
  // "Conditions Converted on Evolve" fact (2, unsplit) is a different label.
  2366: { 'Conditions Converted on Stance': 1 },

  // Carbolic Composition (id 2383, Amalgam Master major): "Amalgam skills inflict poison on hit.
  // Poison you inflict lasts longer." Wiki: `{{skill fact|duration increase|33%|game mode=pve}}` +
  // `{{...|10%|game mode=wvw pvp}}` — pve 33, wvw+pvp 10. (Its Poisoned duration itself is a
  // separate, single-raw-fact Buff gap — see this table's own intro comment above.)
  2383: { 'Duration Increase': 10 },

  // Hybrid Vigor (id 2389, Amalgam Master minor): "Gain vitality. Gain barrier when you use a morph
  // skill." Wiki: `{{skill fact|barrier|1295|coefficient=0.1|game mode=pve}}` + `{{...|783|
  // coefficient=0.1|game mode=wvw}}` + `{{...|623|coefficient=0.1|game mode=pvp}}`
  // (`AttributeAdjust`, `target: 'Healing'`) — a genuine 3-way split, all distinct.
  2389: { Barrier: 783 },

  // Symbiotic Synergy (id 2406, Amalgam Grandmaster major): "Evolve recharges morph skills. Morph
  // skills deal increased strike damage." Wiki: `{{skill fact|damage increase|33|game mode=pve}}` +
  // `{{...|10|game mode=wvw pvp}}` — pve 33, wvw+pvp 10.
  2406: { 'Damage Increase': 10 },

  // Ranger — 5th leg of the "remaining 8 professions" main sweep (TODO.md, 2026-08-20). Same
  // process as the Guardian/Warrior/Mesmer/Engineer legs above: scanned all 9 Ranger spec lines (5
  // core + Druid/Soulbeast/Untamed/Galeshot) for both numeric AND Buff-type same-status dupes.
  // Hunter's Tactics (1068, "Damage Increase" 10/10), Lingering Light (2058, "Recharge Time
  // Reduced" 1/1), and Twice as Vicious (2127, Buff-typed, 10s/10s with matching apply_count) are
  // genuinely-identical dupes needing no override (already collapse via this function's own `seen`
  // dedup / `extractFromFacts`'s tuple dedup). Hunter's Gaze (1014) is a scan false positive: its
  // 3 "Might" facts (5s each, stacks 3/2/1) are 3 independently health-threshold-gated concepts
  // ("Below 25/50/75 Percent") sharing one status, not a game-mode split — no wiki split exists.
  //
  // Buff-type findings (see `wvw-fact-overrides.json`/`BUFF_INSTANCE_VALUE_OVERRIDES` in
  // `boon-calc/sources.ts` for the actual fixes, out of this table's scope): found and fixed 2
  // latent bugs in ALREADY-curated Ranger overrides predating this leg (Blood Moon id 1935, Let
  // Loose id 2271), same "plain per-status override only replaces duration, not apply_count" shape
  // as the Engineer leg's HGH/Kinetic Accelerators/Photonic Blasting Module — converted both to
  // `BUFF_INSTANCE_VALUE_OVERRIDES`. Eclipse (2055, its Poisoned pair) needed the same treatment,
  // newly discovered this leg. Cloudburst (2425) has a genuine same-status Quickness dupe under its
  // Hawkeye linked-skill prefix (fixed via `BUFF_INSTANCE_VALUE_OVERRIDES`), but ALSO 2 real
  // boon-type-swap gaps under its Bluster/Hawkeye prefixes (Quickness+Might swap entirely to
  // Swiftness+Fury/Fury in wvw+pvp) — same shape `WvwFactOverride` can't express as Guardian's
  // Phoenix Protocol/Engineer's Mech Frame: Channeling Conduits, left undocumented-fix, gap noted.
  // Moment of Clarity's (1070) "Attack of Opportunity" effect-Buff carries an embedded pve-50%/
  // wvw+pvp-10% damage-bonus sub-value via the wiki's `effect bonus number=` param, not expressible
  // through this table or `WvwFactOverride` (its own outer Buff duration is identical, 10s, both
  // modes, so no Buff-side fix is even needed) — same "can't express an embedded sub-value" shape
  // as Warrior's Peak Performance/Engineer's Big Boomer. Natural Balance (2056) has the same
  // embedded-desc shape, but turns out to be a DIFFERENT kind of gap: its outer Buff's own `status`
  // ("Natural Balance") isn't a recognized boon/condition name at all (not in `BOON_NAMES`/
  // `CONDITION_NAMES`, `constants.ts`) — `classifyBoonCondition` gates it out before `extractFromFacts`
  // ever reaches a `wvw-fact-overrides.json` lookup, and `factLine` has no `'Buff'` case either, so
  // this fact renders NOWHERE in the app currently, mode-split or not. Same "custom effect-status
  // Buff the boon/condition pipeline structurally can't see" shape as the Conduit leg's Bolstered
  // Bonds loose end above — not attempted here, no override added (would be dead code).

  // Loud Whistle (id 974, Beastmastery Adept): "Your pet deals more damage while you are above the
  // health threshold." Wiki: `{{skill fact|damage increase|alt=Pet Damage Increase|15|game
  // mode=pve}}` + `{{...|10|game mode=wvw pvp}}` (2026 patch raised the pve value from 10 to 15,
  // explicitly excluding merged soulbeasts) — pve 15, wvw+pvp 10.
  974: { 'Pet Damage Increase': 10 },

  // Predator's Onslaught (id 996, Marksmanship Adept minor): "You and your pet deal increased
  // strike damage to disabled, defiant, or movement-impaired foes." Wiki: `{{skill fact|damage
  // increase|10|game mode = pve}}` + `{{...|15|game mode = wvw pvp}}` — pve 10, wvw+pvp 15, the
  // rare WvW-higher case (2026 patch reduced the pve value from 15 to 10).
  996: { 'Damage Increase': 15 },

  // Farsighted (id 1000, Marksmanship Master): "Ranger weapon skills deal increased strike damage.
  // Damage is further increased for foes above the range threshold." Wiki (`split = pve wvw, pvp`):
  // `{{skill fact|damage increase|10|game mode=pve wvw}}` + `{{...|5|game mode=pvp}}`, `{{skill
  // fact|damage increase|alt=Damage Increase above Threshold|15|game mode=pve wvw}}` + `{{...|10|
  // game mode=pvp}}` — pve+wvw share 10/15, pvp alone drops to 5/10. 2 independently-ambiguous
  // labels on one trait.
  1000: { 'Damage Increase': 10, 'Damage Increase above Threshold': 15 },

  // Wolfsong (id 1001, Marksmanship Master): "Canine Beast abilities apply vulnerability and reveal
  // nearby enemies. You deal additional increased strike damage against vulnerable enemies." Wiki:
  // `{{skill fact|damage increase|10|game mode=pve}}` + `{{...|5|game mode=wvw pvp}}` — pve 10,
  // wvw+pvp 5. (Its Vulnerability duration split, 6 pve+pvp / 9 wvw, is Buff-typed and already
  // correctly fixed by an earlier sweep's `wvw-fact-overrides.json` entry — re-verified, not new
  // this leg.)
  1001: { 'Damage Increase': 5 },

  // Fang and Claw (id 1016, Skirmishing Master): "Feline, avian, and drake pets gain additional
  // precision and ferocity. Beast skills grant fury around the ranger." Wiki: `{{skill
  // fact|attribute|precision|420|game mode=pve}}` + `{{...|315|game mode=wvw pvp}}`, `{{skill
  // fact|attribute|ferocity|450|game mode=pve}}` + `{{...|225|game mode=wvw pvp}}` — both
  // `AttributeAdjust`, no `text` field, keyed by `target` (`Precision`/`CritDamage`, the API's
  // literal string for the Ferocity-attribute concept). (Its Fury duration split, 8 pve / 6 wvw+pvp,
  // is Buff-typed and already correctly fixed by an earlier sweep.)
  1016: { Precision: 315, CritDamage: 225 },

  // Lingering Magic (id 1059, Nature Magic Grandmaster minor): "You and your pet gain increased
  // concentration. Regeneration you apply is more effective." Wiki: `{{skill fact|attribute|
  // Concentration|240|game mode = pve}}` + `{{...|120|game mode = pvp wvw}}` (`AttributeAdjust`, no
  // `text`, keyed by `target` "BoonDuration", same non-obvious naming as Guardian's Honorable
  // Staff/Warrior's Roaring Reveille) — pve 240, wvw+pvp 120.
  1059: { BoonDuration: 120 },

  // Moment of Clarity (id 1070, Marksmanship Master): "Gain an attack of opportunity for you and
  // your pet on interrupting a foe. Daze and stun durations that you inflict last longer." Wiki:
  // `{{skill fact|duration increase|50%|game mode=pve}}` + `{{...|10%|game mode=pvp wvw}}` — pve
  // 50, wvw+pvp 10. Its "Attack of Opportunity" effect-Buff embedded sub-value gap is documented in
  // this table's own Ranger-leg intro comment above.
  1070: { 'Duration Increase': 10 },

  // Rugged Growth (id 1089, Wilderness Survival Grandmaster minor): "You and your pet recover
  // health while affected by protection." Wiki: `{{skill fact|healing|259|coefficient=0.245|game
  // mode=pve}}` + `{{...|196|coefficient=0.122|game mode=pvp wvw}}` — pve 259, wvw+pvp 196.
  1089: { Healing: 196 },

  // Resounding Timbre (id 1606, Beastmastery Adept): "Commands copy boons from yourself to your
  // pet." Wiki: `{{skill fact|Maximum Boon Stacks Copied|25|game mode=pve}}` + `{{...|3|game
  // mode=wvw pvp}}` — pve 25, wvw+pvp 3.
  1606: { 'Maximum Boon Stacks Copied': 3 },

  // Invigorating Bond (id 1697, Nature Magic Grandmaster): "Beast skills heal allies around the
  // ranger." Wiki: `{{skill fact|healing|2580|coefficient=0.8|game mode=pve}}` + `{{...|1020|
  // coefficient=1.0|game mode=wvw}}` + `{{...|820|coefficient=0.5|game mode=pvp}}` — a genuine
  // 3-way split, all distinct; wvw (1020) is actually the HIGH outlier here despite pve's larger
  // coefficient reference number. (Its Protection/Vigor duration splits are Buff-typed and already
  // correctly fixed by an earlier sweep — re-verified, not new this leg.)
  1697: { Healing: 1020 },

  // Hidden Barbs (id 1846, Skirmishing Master): "Bleeding you inflict is more dangerous." Wiki:
  // `{{skill fact|Condition Damage Increase|20|game mode = pve}}` + `{{...|33|game mode = wvw pvp}}`
  // (API's own fact `text` is "Damage Increase", not the wiki template's param name, same pattern as
  // Guardian's Amplified Wrath) — pve 20, wvw+pvp 33, the rare WvW-higher case.
  1846: { 'Damage Increase': 33 },

  // Vicious Quarry (id 1888, Skirmishing Grandmaster): "Fury grants ferocity and additional
  // increased critical-strike chance. When struck while below the health threshold, gain fury."
  // Wiki: `{{skill fact|critical chance increase|15|game mode=pve}}` + `{{...|10|game mode=pvp
  // wvw}}` — pve 15, wvw+pvp 10. (Its Fury fact carries the same 4s value both modes, genuinely
  // identical, matching the pre-existing `wvw-fact-overrides.json` entry.)
  1888: { 'Critical Chance Increase': 10 },

  // Pack Alpha (id 1900, Beastmastery Adept minor): "Your pet's attributes are improved and pet
  // skills gain recharge reduction." Wiki: `{{skill fact|attribute|Attribute Increase|300|effect
  // bonus=Power; Condition Damage; Precision; Toughness; Vitality|game mode=pve}}` + `{{...|150|
  // ...|game mode=wvw pvp}}` (`AttributeAdjust`, all 5 stats at once) — pve 300, wvw+pvp 150.
  1900: { 'Attribute Increase': 150 },

  // Natural Mender (id 1992, Druid Grandmaster minor): "Increase healing to other allies. Gain
  // astral force each interval while not in celestial avatar form." Wiki: `{{skill fact|Healing|
  // alt=Healing Increase to Others|20%|game mode = pve}}` + `{{...|15%|game mode = pvp wvw}}` — pve
  // 20, wvw+pvp 15. Its "Energy Gain" fact (8, pve+wvw shared per the wiki) already carries only the
  // correct value in the live API — no fix needed.
  1992: { 'Healing Increase to Others': 15 },

  // Eclipse (id 2055, Druid Grandmaster): "Your Celestial Avatar skills are offensively augmented.
  // Striking enemies grants additional astral force." Wiki: `{{skill fact|percent|0.75|alt=
  // Additional Astral Force per Damage|game mode=pve}}` + `{{...|0.5|...|game mode=pvp wvw}}` — pve
  // 0.75, wvw+pvp 0.5. Its Poisoned/Immobile/Burning per-linked-skill duration splits are Buff-typed
  // (see `wvw-fact-overrides.json`/`BUFF_INSTANCE_VALUE_OVERRIDES`, out of this table's scope).
  2055: { 'Additional Astral Force per Damage': 0.5 },

  // Second Skin (id 2119, Soulbeast Master): "Conditions inflict less damage to you while you have
  // protection." Wiki (`split = pve wvw, pvp`): `{{skill fact|Condition Damage Reduced|alt=Damage
  // Reduced|33|game mode=pve}}` + `{{...|25|game mode=pvp}}` — pve+wvw share 33, pvp alone drops to
  // 25.
  2119: { 'Damage Reduced': 33 },

  // Leader of the Pack (id 2128, Soulbeast Grandmaster): "Stance skills gain increased duration on
  // you and grant their effects to nearby allies for a reduced duration." Wiki (`split = pve pvp,
  // wvw`): `{{skill fact|duration increase|alt=Personal Duration|120%|game mode = pve pvp}}` +
  // `{{...|150%|game mode = wvw}}` — pve+pvp share 120, wvw alone rises to 150, the rare
  // WvW-is-the-sole-outlier-and-higher case.
  2128: { 'Personal Duration': 150 },

  // Furious Strength (id 2156, Soulbeast Master minor): "You deal increased strike damage while you
  // have fury." Wiki: `{{skill fact|damage increase|15|game mode = pve}}` + `{{...|7|game mode =
  // pvp wvw}}` — pve 15, wvw+pvp 7.
  2156: { 'Damage Increase': 7 },

  // Vow of the Untamed (id 2269, Untamed Grandmaster minor): "Your outgoing strike damage is
  // increased while you are unleashed. You take reduced damage from strikes while your pet is
  // unleashed." Wiki: `{{skill fact|damage increase|alt=Outgoing Damage Adjustment|25|game
  // mode=pve}}` + `{{...|10|game mode=wvw pvp}}`, `{{skill fact|Damage reduced|alt=Incoming Damage
  // Adjustment|25|game mode=pve}}` + `{{...|10|game mode=wvw pvp}}` — 2 independently-ambiguous
  // labels, both pve 25 / wvw+pvp 10. The raw API lists each wvw+pvp value twice (once per mode)
  // rather than once for a shared "wvw pvp" mode — harmless, already collapses via this function's
  // own `seen` dedup.
  2269: { 'Outgoing Damage Adjustment': 10, 'Incoming Damage Adjustment': 10 },

  // Corrupting Vines (id 2278, Untamed Master): "Rending Vines corrupts boons into conditions
  // instead of removing them. Unleashed Ambush skills remove boons from enemies." Wiki: `{{skill
  // fact|Boons Converted to Conditions|3|game mode = pve}}` + `{{...|2|game mode = wvw pvp}}` — pve
  // 3, wvw+pvp 2.
  2278: { 'Boons Converted to Conditions': 2 },

  // Natural Fortitude (id 2286, Untamed Master minor): "Gain vitality. Unleashed Ambush skills
  // siphon health if they hit. Siphon healing is reduced for each target struck beyond the first."
  // Wiki: `{{skill fact|Life Siphon Damage|3517|coefficient=0.005|game mode=pve}}` + `{{...|1764|
  // ...|game mode=wvw pvp}}`, `{{skill fact|Life Siphon Healing|alt=First-Hit Life Siphon
  // Healing|3517|coefficient=0.2|game mode=pve}}` + `{{...|1764|...|game mode=wvw pvp}}`, `{{skill
  // fact|Life Siphon Healing|alt=Additional-Hit Healing|586|coefficient=0.03|game mode=pve}}` +
  // `{{...|294|...|game mode=wvw pvp}}` — 3 independently-ambiguous labels, all pve-high/wvw+pvp-low
  // by exactly half.
  2286: { 'Life Siphon Damage': 1764, 'First-Hit Life Siphon Healing': 1764, 'Additional-Hit Healing': 294 },

  // Blinding Outburst (id 2301, Untamed Adept): "Venomous Outburst deals more damage and applies
  // blindness in addition to its other effects. Unleashed Ambush skills deal more damage." Wiki:
  // `{{skill fact|Damage Increase|25|game mode = pve}}` + `{{...|10|game mode = wvw pvp}}` — pve 25,
  // wvw+pvp 10. The raw API lists the wvw+pvp value twice (once per mode), same harmless
  // over-listing as Vow of the Untamed above.
  2301: { 'Damage Increase': 10 },

  // Bird of Prey (id 2363, Galeshot Master minor): "Strike damage is increased when you have
  // swiftness or superspeed. Swiftness is more effective." Wiki: `{{skill fact|damage increase|5|
  // game mode=pve}}` + `{{...|10|game mode=wvw}}` — pve 5, wvw(+pvp per the trait's own `split`
  // field) 10, the rare WvW-higher case.
  2363: { 'Damage Increase': 10 },

  // Shrike (id 2372, Galeshot Grandmaster): "After a number of missile hits, release a volley of
  // arrows at your target and gain an arrow." Wiki: `{{skill fact|Missile Hits Required|12|game
  // mode=pve}}` + `{{...|8|game mode=wvw pvp}}` — pve 12, wvw+pvp 8.
  2372: { 'Missile Hits Required': 8 },

  // Flock Together (id 2408, Galeshot Master): "Feathered pets have increased strike damage and
  // health. Beast skills grant quickness around the ranger." Wiki: `{{skill fact|damage increase|
  // 25|game mode=pve}}` + `{{...|15|game mode=wvw pvp}}`, `{{skill fact|Health Increase|50%|game
  // mode=pve}}` + `{{...|25%|game mode=pvp wvw}}` — 2 independently-ambiguous labels, both
  // pve-high/wvw+pvp-low. (Its Quickness duration split, 5 pve / 3 wvw+pvp, is Buff-typed and
  // already correctly fixed by an earlier sweep.)
  2408: { 'Damage Increase': 15, 'Health Increase': 25 },

  // Thief — 6th leg of the "remaining 8 professions" main sweep (TODO.md, 2026-08-20). Same
  // process as every prior leg: scanned all 9 Thief spec lines (5 core + Daredevil/Deadeye/
  // Specter/Antiquary) / 111 traits for both numeric AND Buff-type same-status dupes. This leg
  // surfaced 2 NEW split-direction shapes not seen on any prior leg's own traits — always read the
  // page's `split =` field explicitly rather than assuming "2nd raw value = wvw", since it isn't
  // always true:
  //  - Quick Pockets (1187, Trickery): `split = pve wvw, pvp` — pve+wvw actually SHARE the value
  //    tagged `game mode=pve` (3 Initiative), pvp alone drops to 2, even though the raw facts only
  //    carry bare `pve`/`pvp` tags (no explicit `wvw` anywhere) — the page-level split declaration
  //    is what actually decides this, not the per-fact tag text.
  //  - Staff Master (1884, Daredevil), Specter (2184, Specter's own namesake trait), and Hungering
  //    Darkness (2300, Specter) are the same "pve wvw, pvp"-or-"pve wvw"-tagged shape, all 3
  //    confirmed the same way.
  // 3 genuinely-identical dupes needed no override (already collapse via this function's own `seen`
  // dedup): Improvisation (1167, "Recharge Reduced" 25/25), Iron Sight's own "Damage Increase" 10/10
  // (a DIFFERENT label than its ambiguous "Damage Reduced" pair below), Premeditation's "Bonus
  // Damage per Boon" 1/1. 2 real gaps left deliberately uncurated (documented, not modeled wrong):
  // Twin Fangs (1268, Critical Strikes) has a genuine 3rd ambiguous pair per the wiki (`{{skill
  // fact|health threshold|50|game mode = pve}}{{skill fact|health threshold|90|game mode = wvw
  // pvp}}`), but the live API carries only the pve value (50) — the wvw+pvp value (90) is simply
  // absent from the raw data, same "documented but missing from the API" shape as Guardian's Heavy
  // Light/Ranger's Song-of-Arboreum-Vigor loose ends (its other 2 ambiguous pairs, both Critical
  // Damage Increase concepts, ARE curated below); Enterprising Aristocrat (2362, Antiquary) has the
  // same shape for its Barrier fact (wiki 3-way split 975 pve/783 wvw/207 pvp, but the API carries
  // only the pve value, 975 — its other 3 ambiguous pairs are curated below). Shadow Siphoning
  // (1705, Shadow Arts) is a genuine data-mismatch gap: the wiki's CURRENT infobox shows Life
  // Siphon Damage as 412 pve/288 wvw+pvp, but the live local API carries 312/218 instead — matching
  // neither the wiki's current numbers nor cleanly explained by the wiki's own 2020-07-07
  // version-history note (itself flagged with a `{{sic|288}}` tag, i.e. even the wiki's own editors
  // marked this number as suspect) — not confidently resolvable from the wiki alone, same "can only
  // pick among values that actually appear in the raw data, and this one's ambiguous which side is
  // even right" shape as Battle Scarred's Life Siphon Healing loose end (Revenant/Devastation leg).
  // Buff-type findings (see `wvw-fact-overrides.json`/`BUFF_INSTANCE_VALUE_OVERRIDES` in
  // `boon-calc/sources.ts` for the actual fixes, out of this table's scope): found and fixed 2
  // latent bugs in ALREADY-curated Thief overrides predating this leg (Thrill of the Crime id 1163,
  // Bountiful Theft id 1277, same "plain override only replaces duration, not apply_count" shape as
  // the Engineer/Ranger legs), 1 brand-new same-shape gap (Serpent's Touch id 1279, previously only
  // partially fixed by the 2026-08-14 buff-instance-label sweep), and fully resolved Possessive
  // Hoarder (2393) — that same 2026-08-14 sweep had explicitly deferred it as "too entangled to
  // safely map," now untangled with the full raw wikitext in hand. Leeching Venoms' Spider Venom
  // effect (1130) re-confirmed as the SAME documented non-boon-status gap that sweep already found
  // (its own apply_count-only split, duration unchanged both modes, is moot regardless since
  // `classifyBoonCondition` doesn't recognize "Spider Venom" as a real boon/condition status at
  // all — same shape as Ranger's Natural Balance/Conduit's Bolstered Bonds). Unhindered Combatant's
  // "Exhaustion" (1964) is also a non-boon status per that same prior sweep, additionally a false
  // positive in this leg's own scan (its 2 "different-duration" facts are actually 2 unrelated
  // concepts — Exhaustion-on-Chilled vs Exhaustion-on-Immobile — not a mode split at all).

  // Leeching Venoms (id 1130, Shadow Arts Grandmaster minor): "Interrupting a foe grants venom
  // stacks. Increase life siphon damage while under the effects of any venom." Wiki (`split = pve,
  // wvw pvp`): `{{skill fact|Life Siphon Damage|320|coefficient=0.033|game mode = pve}}` + `{{...|
  // 160|coefficient=0.0165|game mode = pvp wvw}}`, `{{skill fact|Venom Stacks|3|game mode = pve}}`
  // + `{{...|1|game mode = pvp wvw}}` — 2 independently-ambiguous labels, both pve-high/wvw-low.
  // Its Spider Venom effect-Buff gap is documented in this table's own Thief-leg intro comment
  // above.
  1130: { 'Life Siphon Damage': 160, 'Venom Stacks': 1 },

  // Shadow's Rejuvenation (id 1135, Shadow Arts Adept): "Gain initiative when you enter stealth."
  // Wiki: `{{skill fact|Initiative|2|alt=Initiative on Enter|game mode = pve}}` + `{{...|1|alt=
  // Initiative on Enter|game mode = wvw pvp}}` — pve 2, wvw+pvp 1. Its separate "Initiative on
  // Exit" fact (1, unsplit) is a different label.
  1135: { 'Initiative on Enter': 1 },

  // Deadly Ambition (id 1164, Deadly Arts Adept): "Gain condition damage. Cast Death Blossom when
  // you interrupt a foe." Wiki: `{{skill fact|attribute|Condition Damage|180|game mode = pve}}` +
  // `{{...|120|game mode = wvw pvp}}` — pve 180, wvw+pvp 120. Its unrelated "Poisoned|3" fact
  // (unsplit) is a different concept (Death Blossom's own cast).
  1164: { ConditionDamage: 120 },

  // Quick Pockets (id 1187, Trickery Grandmaster): "Gain initiative on weapon swap while in
  // combat." Wiki (`split = pve wvw, pvp`): `{{skill fact|Initiative|3|game mode=pve}}` + `{{...|
  // 2|game mode = pvp}}` — pve+wvw share 3 (per the page's own split declaration, even though no
  // raw fact is explicitly tagged "wvw"), pvp alone drops to 2.
  1187: { Initiative: 3 },

  // Exposed Weakness (id 1257, Deadly Arts Master): "Deal increased strike damage per unique
  // condition on the target." Wiki: `{{skill fact|damage increase|alt=Damage Increase per Unique
  // Condition|2|game mode = pve}}` + `{{...|3|game mode = pvp wvw}}` — pve 2, wvw+pvp 3, the rare
  // WvW-higher case.
  1257: { 'Damage Increase per Unique Condition': 3 },

  // Twin Fangs (id 1268, Critical Strikes Grandmaster): "Deal increased critical damage, further
  // increased above the health threshold. Gain critical chance from behind/side or vs. defiant
  // foes." Wiki: `{{skill fact|critical damage increase|5|game mode = pve}}` + `{{...|2|game mode
  // = pvp wvw}}` (base), `{{skill fact|critical damage increase|alt=High Health Critical Damage
  // Increase|2|game mode = pve}}` + `{{...|5|game mode = pvp wvw}}` (WvW-higher for this half) — 2
  // independently-ambiguous labels, both curated. Its Health Threshold gap (missing from the API
  // entirely) is documented in this table's own Thief-leg intro comment above.
  1268: { 'Critical Damage Increase': 2, 'High-Health Critical Damage Increase': 5 },

  // Bountiful Theft (id 1277, Trickery Grandmaster): "Steal grants boons and removes boons from
  // the target." Wiki: `{{skill fact|boons removed|alt=Boons Stolen|3|game mode = pve}}` + `{{...|
  // 2|game mode = pvp wvw}}` — pve 3, wvw+pvp 2. Its Might Buff-type dupe is already handled by
  // the separate `wvw-fact-overrides.json`/`BUFF_INSTANCE_VALUE_OVERRIDES` script (see that file's
  // own Thief-leg comment — a latent bug fix, not new this table).
  1277: { 'Boons Stolen': 2 },

  // Keen Observer (id 1281, Critical Strikes Master): "Increased critical-hit chance, further
  // increased above the health threshold." Wiki: `{{skill fact|critical chance increase|10|game
  // mode=pve}}` + `{{...|5|game mode=wvw pvp}}` (base), `{{skill fact|health threshold|50|game
  // mode = pve}}` + `{{...|90|game mode = wvw pvp}}` — 2 independently-ambiguous labels. Its
  // "High-Health Critical Chance Increase" fact (5, unsplit both modes per the wiki) is unambiguous.
  1281: { 'Critical Chance Increase': 5, 'Health Threshold': 90 },

  // Hard to Catch (id 1290, Acrobatics Master): "Gain endurance when you shadowstep." Wiki:
  // `{{skill fact|Endurance gained|8|game mode = pve}}` + `{{...|5|game mode = pvp}}` (`split =
  // pve, wvw pvp`, standard direction despite the bare "pvp" tag) — pve 8, wvw+pvp 5.
  1290: { 'Endurance Gained': 5 },

  // Potent Poison (id 1291, Deadly Arts Master): "Poison you inflict deals increased damage and
  // lasts longer. Serpent's Touch/Panic Strike gain an additional stack of poison when traited."
  // Wiki: `{{skill fact|condition damage increase|33|game mode=pve}}` + `{{...|20|game
  // mode=wvw pvp}}` (API's own fact `text` is "Damage Increase"), `{{skill fact|duration
  // increase|33%|game mode=pve}}` + `{{...|5%|game mode= pvp wvw}}` — 2 independently-ambiguous
  // labels, both pve-high/wvw-low.
  1291: { 'Damage Increase': 20, 'Duration Increase': 5 },

  // Merciful Ambush (id 1294, Shadow Arts Master): "Heal when you stealth attack." Wiki (`split =
  // pve, wvw pvp`): `{{skill fact|healing|493|coefficient=0.5|game mode=pve}}` + `{{...|273|
  // coefficient=0.3|game mode=wvw pvp}}` — the pve leg (493) is a small reference-build-rounding
  // gap off the live API's own 439 (same shape documented elsewhere in this table, e.g. Writ of
  // Persistence), but the wvw+pvp leg (273) matches the API exactly, curated from that real value.
  1294: { Healing: 273 },

  // Invigorating Precision (id 1702, Critical Strikes Grandmaster): "Critical hits heal you and
  // nearby allies. Increased healing while you have fury." Wiki: `{{skill fact|healing|4%|alt=
  // Percent|game mode = pve}}` + `{{...|10%|alt=Percent|game mode = pvp wvw}}`, `{{skill
  // fact|healing|6%|alt=Healing with Fury|game mode = pve}}` + `{{...|20%|alt=Healing with
  // Fury|game mode = pvp wvw}}` — 2 independently-ambiguous labels, both wvw-higher.
  1702: { Percent: 10, 'Healing with Fury': 20 },

  // Revealed Training (id 1704, Deadly Arts Master): "Gain power. Gain additional power while
  // revealed." Wiki: `{{skill fact|attribute|Power|alt=Base Power|80|game mode = pve}}` + `{{...|
  // 100|game mode = pvp wvw}}`, `{{skill fact|attribute|Power|alt=Power while Revealed|120|game
  // mode = pve}}` + `{{...|150|game mode = pvp wvw}}` — 2 independently-ambiguous labels, both
  // wvw-higher, both `AttributeAdjust` keyed by their own `alt=`-sourced `text`.
  1704: { 'Base Power': 100, 'Power while Revealed': 150 },

  // Endurance Thief (id 1837, Daredevil Adept): "Gain endurance when you dodge." Wiki: `{{skill
  // fact|Endurance Gained|50|game mode=pve}}` + `{{...|25|game mode=wvw pvp}}` — pve 50, wvw+pvp 25.
  1837: { 'Endurance Gained': 25 },

  // Staff Master (id 1884, Daredevil Grandmaster minor): "Gain power while wielding a staff. Gain
  // endurance based on initiative spent while wielding a staff." Wiki (`split = pve wvw, pvp`):
  // `{{skill fact|endurance gained|alt=Endurance per Initiative|2|game mode = pve}}` + `{{...|1|
  // game mode = pvp}}` — pve+wvw share 2, pvp alone drops to 1. Its 2 "Power" `AttributeAdjust`
  // facts (both 120, unsplit) are genuinely identical, no fix needed.
  1884: { 'Endurance per Initiative': 2 },

  // Weakening Strikes (id 1887, Daredevil Adept): "Evading an attack causes your next attack to
  // inflict weakness. Deal increased damage to weakened foes." Wiki: `{{skill fact|Damage
  // Increase|10|game mode = pve}}` + `{{...|7|game mode = pvp wvw}}`, `{{skill fact|weakness|3|
  // game mode = pve}}` + `{{...|2|game mode = pvp wvw}}` — 2 independently-ambiguous labels, the
  // 2nd (Weakness) already correctly curated in `wvw-fact-overrides.json` by an earlier sweep.
  1887: { 'Damage Increase': 7 },

  // Havoc Specialist (id 1893, Daredevil Master): "Increase damage while wielding a dagger, pistol,
  // or staff." Wiki: `{{skill fact|damage increase|15|game mode=pve}}` + `{{...|10|game
  // mode=pvp wvw}}` — pve 15, wvw+pvp 10.
  1893: { 'Damage Increase': 10 },

  // No Quarter (id 1904, Critical Strikes Grandmaster; wiki page disambiguates to "No Quarter
  // (trait)", the bare title is a Living World episode page): "Gain fury and ferocity when you
  // interrupt a foe." Wiki: `{{skill fact|attribute|Ferocity|250|game mode = pve}}` + `{{...|300|
  // game mode = pvp wvw}}` — pve 250, wvw+pvp 300, the rare WvW-higher case. Its Fury fact
  // (unsplit duration 2 both modes) is unambiguous.
  1904: { CritDamage: 300 },

  // Iron Sight (id 2084, Deadeye Adept): "Reduce incoming strike damage while wielding a rifle."
  // Wiki: `{{skill fact|damage reduced|15|game mode=pve}}` + `{{...|10|game mode=wvw pvp}}` — pve
  // 15, wvw+pvp 10. Its unrelated "Damage Increase" fact (10, unsplit) is a different label.
  2084: { 'Damage Reduced': 10 },

  // One in the Chamber (id 2136, Deadeye Master): "Increase strike damage against marked targets."
  // Wiki: `{{skill fact|damage increase|25|game mode=pve}}` + `{{...|10|game mode=pvp wvw}}` — pve
  // 25, wvw+pvp 10.
  2136: { 'Damage Increase': 10 },

  // Malicious Intent (id 2145, Deadeye Master): "Gain increased malice while stealthed or marking a
  // target." Wiki: `{{skill fact|Malice|alt=Malice Gained|2|game mode = pve}}` + `{{...|1|game
  // mode = wvw pvp}}` — pve 2, wvw+pvp 1.
  2145: { 'Malice Gained': 1 },

  // Premeditation (id 2160, Deadeye Grandmaster): "Gain concentration. Cantrips and signets grant a
  // stack of malice." Wiki: `{{skill fact|attribute|Concentration|180|game mode = pve}}` + `{{...|
  // 60|game mode = pvp wvw}}` (API's own fact `target` is "BoonDuration", same non-obvious naming
  // as Guardian's Honorable Staff) — pve 180, wvw+pvp 60.
  2160: { BoonDuration: 60 },

  // Specter (id 2184, Specter's own namesake Adept minor): "Gain Shadow Shroud based on initiative
  // spent." Wiki (`split = pve wvw, pvp`): `{{skill fact|Shadow Shroud per Initiative Spent|1%|
  // game mode=pve wvw}}` + `{{...|0.75%|game mode=pvp}}` — pve+wvw share 1 (explicitly tagged
  // "pve wvw" on the same template), pvp alone drops to 0.75.
  2184: { 'Shadow Shroud per Initiative Spent': 1 },

  // Strength of Shadows (id 2264, Specter Adept): "Torment you inflict deals increased condition
  // damage." Wiki: `{{skill fact|condition damage increase|condition=torment|20|game mode = pve}}`
  // + `{{...|25|game mode = wvw pvp}}` (API's own fact `text` is "Damage Increase") — pve 20,
  // wvw+pvp 25, the rare WvW-higher case.
  2264: { 'Damage Increase': 25 },

  // Dark Sentry (id 2272, Specter Master): "Increase healing to other allies while in Shadow
  // Shroud." Wiki: `{{skill fact|healing|alt=Healing Increase to Others|20%|game mode=pve}}` +
  // `{{...|10%|game mode=wvw pvp}}` — pve 20, wvw+pvp 10.
  2272: { 'Healing Increase to Others': 10 },

  // Consume Shadows (id 2275, Specter Grandmaster): "Exiting Shadow Shroud heals based on
  // remaining Shroud stacks." Wiki: `{{skill fact|Healing per Stack|10%|game mode=pve}}` + `{{...|
  // 6.5%|game mode=wvw pvp}}` — the wvw+pvp leg's wiki fraction (6.5) rounds slightly differently
  // from the live API's own raw value (6.6, a small reference-build gap same shape as elsewhere in
  // this table), curated from the real API value since this table can only match against values
  // that actually appear in the raw data.
  2275: { 'Healing per Stack': 6.6 },

  // Shallow Grave (id 2299, Specter Master): "Transfer conditions to your target and remove
  // conditions from yourself when you enter Shadow Shroud." Wiki: `{{skill fact|Conditions
  // Transferred|3|game mode=pve}}` + `{{...|2|game mode=wvw pvp}}`, `{{skill fact|Conditions
  // Removed|3|game mode=pve}}` + `{{...|2|game mode=wvw pvp}}` — 2 independently-ambiguous labels,
  // both pve-high/wvw-low, both by the same 3-to-2 amount.
  2299: { 'Conditions Transferred': 2, 'Conditions Removed': 2 },

  // Hungering Darkness (id 2300, Specter Grandmaster): "Pulse healing and condition
  // transfer/removal periodically while in Shadow Shroud." Wiki (`split = pve wvw, pvp`): `{{skill
  // fact|Healing|517|coefficient=0.2|game mode=pve wvw}}` + `{{...|773|coefficient=0.3|game
  // mode=pvp}}`, `{{skill fact|Interval|1|game mode=pve wvw}}` + `{{...|3|game mode=pvp}}` — pve+
  // wvw share 517/1s (explicitly tagged "pve wvw" on both templates), pvp alone rises to 773/3s
  // (the rare case where PVP, not PVE, is the high outlier). 2 independently-ambiguous labels.
  2300: { Healing: 517, Interval: 1 },

  // Combat High (id 2348, Antiquary Adept): "Using Skritt Swipe grants a stacking damage buff."
  // Wiki: `{{skill fact|damage increase|alt=Damage Increase per Stack|3|game mode = pve}}` +
  // `{{...|2|game mode = wvw pvp}}` — pve 3, wvw+pvp 2. Its embedded "Combat High (effect)"
  // effect-Buff carries its own `effect bonus number=` sub-values (20/20, identical both modes
  // despite the wiki's own description text inconsistently saying "+30%"/"+20%" Damage) — no split
  // to fix there regardless.
  2348: { 'Damage Increase per Stack': 2 },

  // Enterprising Aristocrat (id 2362, Antiquary Master): "Reduce incoming damage. Artifacts grant
  // barrier when used." Wiki (`split = pve, wvw, pvp`): `{{skill fact|damage reduced|10|game
  // mode=pve}}` + `{{...|3|game mode=wvw pvp}}`, `{{skill fact|condition damage reduced|10|game
  // mode=pve}}` + `{{...|3|game mode=wvw pvp}}`, `{{skill fact|initiative|2|game mode=pve}}` +
  // `{{...|1|game mode=wvw pvp}}` — 3 independently-ambiguous labels, all pve-high/wvw-low by the
  // same ratio. Its Barrier gap (missing wvw/pvp values from the API entirely) is documented in
  // this table's own Thief-leg intro comment above.
  2362: { 'Damage Reduced': 3, 'Condition Damage Reduced': 3, Initiative: 1 },

  // Elementalist — 7th leg of the "remaining 8 professions" main WvW-duplicate sweep (TODO.md,
  // 2026-08-20). Same process as every prior leg: scanned all 9 Elementalist spec lines (5 core +
  // Tempest/Weaver/Catalyst/Evoker) / 111 traits for both numeric AND Buff-type same-label dupes.
  // 1 trait hit the "pve wvw, pvp" split direction first surfaced on the Thief leg — Aquamancer's
  // Training (1676, pve+wvw share 20%, pvp alone drops to 15%) — worth re-checking every "2nd raw
  // value = wvw" assumption against the page's own `split=` field, same lesson as that leg. Galvanic
  // Enchantment (2335) LOOKED like the same shape on a raw-fact-only read (its "Electric Enchantment"
  // status pve+wvw/pvp pair genuinely splits 2 stacks/1 stack), but "Electric Enchantment" isn't a
  // recognized boon/condition name at all — `classifyBoonCondition` gates it out before any override
  // table is ever consulted, same "custom effect-status the boon/condition pipeline structurally
  // can't see" shape as Ranger's Natural Balance/Conduit's Bolstered Bonds — no override added
  // (would be dead code); its separate, genuinely-unsplit Burning fact needs no fix either. 3 traits
  // (Pyromancer's Training id 319, Stormsoul id 1502, Piercing Shards id 363) hit the rare
  // "WvW/PvP higher than PvE" shape (a 2026-04-14 patch reduced the PvE-only value, same shape as
  // Guardian's Amplified Wrath) — Pyromancer's Training/Stormsoul went UP to 10% in wvw+pvp (pve cut
  // to 7%), Piercing Shards went DOWN to 5% (pve cut to 7% too, but wvw+pvp's own 5% predates that
  // patch and stayed put). Elemental Bastion's (1986) 3-way Healing split (522 pve / 391 wvw / 391
  // pvp, a live API AttributeAdjust triple) collapses cleanly since `numericFactLines` dedupes by
  // displayed text — no per-occurrence handling needed, unlike the Buff mechanism's apply_count
  // pitfall. Earthen Blast's (279) Barrier fact is genuinely `pve wvw, pvp` (1302 shared by pve+wvw,
  // 800 pvp-only) — picked 1302, not the naively-assumed "2nd value" 800. 1 fact type (`Damage`,
  // Electric Discharge's weapon-coefficient pair) stayed out of scope entirely — this table only
  // covers Number/Percent/AttributeAdjust/Time, `Damage`-type dmg_multiplier dupes belong to a
  // separate, never-built curation mechanism. Buff-side findings (2 latent apply_count bugs, Electric
  // Discharge id 222 + Burning Rage id 325) are in `BUFF_INSTANCE_VALUE_OVERRIDES.trait` instead —
  // see its own Elementalist-leg comment. 1 real gap left deliberately uncurated: Energized
  // Elements (2224) grants Fury in pve but swaps entirely to Might in wvw+pvp, the same
  // boon-type-swap shape `WvwFactOverride`/`BUFF_INSTANCE_VALUE_OVERRIDES` can't express as
  // Guardian's Phoenix Protocol/Ranger's Cloudburst (pre-existing `Fury: 'omit'` entry, unchanged
  // this leg). Lucid Singularity's (2033) apparent Alacrity/Might dupes are a scan false positive —
  // already fully resolved and labeled by the 2026-08-14 buff-instance-label sweep as 4 genuinely
  // distinct concepts (2 real pve-only Alacrity applications, 2 real wvw+pvp-only Might
  // applications), not a mode split at all. One with Air's (224) Superspeed pair and Bountiful
  // Power's (1511) "Bountiful Power" marker/timed-effect pair are genuinely-identical/genuinely-
  // different-concept scan false positives needing no override, same shape as prior legs' own
  // findings. Elemental Shielding (289), Hardy Conduit (1948), Invigorating Torrents (2015), and
  // Superior Elements' (2177) own Weakness pair were already correctly curated by an earlier sweep —
  // re-verified against fresh wiki wikitext this leg, no bugs found.
  277: { 'Endurance Gained': 5 },
  279: { Barrier: 1302 },
  296: { 'Duration Increase': 15 },
  319: { 'Damage Increase': 10 },
  334: { 'Stack Threshold': 8 },
  351: { Healing: 1042 },
  363: { 'Damage Increase': 5 },
  1487: { Healing: 220 },
  1502: { 'Damage Increase': 10 },
  1675: { 'Power Converted to Burning Damage': 6 },
  1676: { 'Effectiveness Increased': 20 },
  1938: { BoonDuration: 120 },
  1986: { Healing: 391 },
  2004: { BoonDuration: 120 },
  2077: { Barrier: 260 },
  2177: { 'Critical Chance Increase': 15 },
  2224: { 'Energy Gain': 3 },
  2437: { 'Empowered Skill Recharge': 20 },

  // Necromancer — 8th and final leg of the "remaining 8 professions" main sweep (TODO.md,
  // 2026-08-20). Same process as every prior leg: scanned all 9 Necromancer spec lines (5 core +
  // Reaper/Scourge/Harbinger/Ritualist) for a Number/Percent/AttributeAdjust/Time label repeated
  // more than once, plus a separate Buff/PrefixedBuff same-status scan, wiki-verified each split
  // before curating.

  // Death Magic:

  // Flesh of the Master (id 820, Adept major): "Minions have increased health." Wiki: `{{skill
  // fact|percent|alt=Health Increase|50|game mode = pve wvw}}` + `{{...|15|game mode = pvp}}` —
  // pve+wvw share 50, pvp alone drops to 15.
  820: { 'Health Increase': 50 },

  // Death Nova (id 842, Grandmaster major): "Your minions explode and cause poison when they are
  // destroyed. Minions killed while you're in combat leave behind Jagged Horrors." Wiki (`split =
  // pve pvp, wvw`): `{{skill fact|recharge time|alt=Jagged Horror Summon Recharge|3|game mode=pve
  // pvp}}` + `{{...|15|game mode=wvw}}` (`Time`-typed) — pve+pvp share 3, wvw alone rises to 15 (a
  // WvW-only nerf, longer recharge is worse).
  842: { 'Jagged Horror Summon Recharge': 15 },

  // Corrupter's Fervor (id 1940, Grandmaster major): "Convert incoming condition damage into Death's
  // Carapace. Reduce incoming strike damage while you have Death's Carapace." Wiki: `{{skill
  // fact|damage reduced|33|game mode=pve}}` + `{{...|15|game mode=wvw pvp}}` — pve 33, wvw+pvp 15.
  1940: { 'Damage Reduced': 15 },

  // Unholy Sanctuary (id 1694, Grandmaster major): "Heal periodically based on your missing life
  // force." Wiki: `{{skill fact|percent|alt=Healing per Interval|2|game mode=pve}}` + `{{...|1|game
  // mode=pvp wvw}}` — pve 2, wvw+pvp 1.
  1694: { 'Healing per Interval': 1 },

  // Blood Magic:

  // Vampiric (id 783, Master minor): "Your attacks siphon health from enemies. Minions also siphon
  // life from their attacks." Wiki (`split = pve wvw, pvp`): the base (non-minion) Life Siphon
  // Damage/Healing pair each carry only ONE raw API fact (the pve+wvw value; the wiki's separate
  // pvp-only number is simply absent from the API, same "documented but absent" shape as Guardian's
  // Heavy Light, nothing to filter). The minion-siphon pair DOES carry 2 raw facts each: `{{skill
  // fact|Life Siphon Damage|alt=Minion Life Steal|50|coefficient=0.0213|game mode=pve wvw}}` +
  // `{{...|29|game mode=pvp}}`, `{{skill fact|Life Siphon Healing|alt=Minion Heal|50|
  // coefficient=0.02|game mode=pve wvw}}` + `{{...|26|game mode=pvp}}` — pve+wvw share 50 for both
  // (wiki-confirmed unambiguously via its own `game mode=pve wvw` tag on the kept value), pvp alone
  // drops to a lower number in the live API (26 for both) than the wiki's own literal 29/26 pair —
  // a small reference-build mismatch on the DROPPED value only, doesn't affect which value is kept.
  783: { 'Minion Life Steal': 50, 'Minion Heal': 50 },

  // Last Rites (id 1931, Grandmaster minor): "Your healing power is increased based on your missing
  // health." Wiki (`split = pve wvw, pvp`): 3 independently pve+wvw/pvp-split Healing Power
  // thresholds — `{{skill fact|attribute|Healing Power|alt=Healing Power above 75%
  // Health|150|game mode=pve wvw}}` + `{{...|50|game mode=pvp}}`, `{{...|below 75% Health|300|
  // game mode=pve wvw}}` + `{{...|100|game mode=pvp}}`, `{{...|below 50% Health|450|game mode=pve
  // wvw}}` + `{{...|150|game mode=pvp}}` — all 3 pve+wvw-high/pvp-low, matched exactly by the live
  // API's 3 `AttributeAdjust` pairs.
  1931: { 'Healing Power above 75% Health': 150, 'Healing Power below 75% Health': 300, 'Healing Power below 50% Health': 450 },

  // Ritual of Life (id 780, Adept major): "Necromancer skills that heal you also revive nearby
  // downed allies." Wiki: `{{skill fact|revive percentage|3.5|game mode = pve}}` + `{{...|1|game
  // mode = pvp wvw}}` — pve 3.5, wvw+pvp 1.
  780: { 'Revive Percentage': 1 },

  // Vampiric Presence (id 1844, Master major): "You and your nearby allies siphon health with
  // attacks. This effect increases while in Shroud." Wiki (`split = pve wvw, pvp`) infobox literally
  // lists the base Damage pair as 65 pve+wvw/49 pvp and the Shroud-Damage pair as 129/73, but the
  // page's OWN Notes section independently derives the additive base-damage constants as `32 +
  // (Power * 0.0333)` (base) and `62 + (Power * 0.0666)` (Shroud) — matching the live API's actual
  // raw values exactly (base Damage: 32/32, genuinely identical, no override needed; Shroud Damage:
  // 62/48) rather than the stale infobox numbers, a bigger version of the reference-build-rounding
  // gap seen elsewhere (Writ of Persistence, Expanded Consciousness). The Healing pair (32 pve+wvw/
  // 28 pvp) and Shroud-Healing pair (62 pve+wvw/42 pvp) match the wiki's infobox exactly with no
  // discrepancy at all. Curated from the API's own actual values throughout, per this table's design
  // principle of only ever picking among values that actually appear in the raw data.
  1844: { 'Damage while in Shroud': 62, 'Life Siphon Healing': 32, 'Healing while in Shroud': 62 },

  // Blood Bank (id 782, Grandmaster major): "Gain barrier when you take healing. Gain a large amount
  // of barrier when you're above the health threshold." Wiki (`split = pve, wvw pvp`): `{{skill
  // fact|Barrier|alt=Healing Conversion Rate|10%|game mode = pve}}` + `{{...|5%|game mode = pvp
  // wvw}}` — pve 10, wvw+pvp 5. Its "Full Health Healing Conversion Rate" fact (100%, unsplit) is a
  // separate, unambiguous concept.
  782: { 'Healing Conversion Rate': 5 },

  // Unholy Martyr (id 1692, Grandmaster major): "Remove conditions from yourself and transfer them
  // to nearby enemies. Gain life force for each condition removed this way." Wiki (`split = pve wvw,
  // pvp`): `{{skill fact|Conditions Removed|alt=Conditions Consumed|3|game mode=pve wvw}}` +
  // `{{...|2|game mode=pvp}}` — pve+wvw share 3, pvp alone drops to 2. Its "Life Force per Condition"
  // fact (7, genuinely identical both raw occurrences, no wiki split at all) needs no override.
  1692: { 'Conditions Consumed': 3 },

  // Transfusion (id 778, Grandmaster major): "Necromancer marks heal allies when triggered." Wiki
  // (`split = pve, wvw, pvp`): `{{skill fact|healing|404|coefficient=0.45|game mode=pve}}` +
  // `{{...|404|coefficient=0.3|game mode=wvw}}` + `{{...|200|coefficient=0.1|game mode=pvp}}` — pve
  // and wvw land on the exact same displayed number (404) despite different coefficients (same
  // "declared 3-way split, actual 2-way display" shape as Warrior's Vigorous Shouts), pvp alone
  // drops to 200; the live API carries all 3 as separate raw facts (404, 404, 200). This trait's own
  // Vigor/Stability Buff dupes (per-linked-skill, Mark of Blood/Reaper's Mark) are handled separately
  // in `wvw-fact-overrides.json`. Overflowing Thirst's (788) Life Siphon Damage is a genuine 3-way
  // `split = pve, pvp, wvw` where the live API carries only 2 of the 3 raw values (325, 197) with no
  // wiki-tagged combination to attribute either to — same "genuine 3-way value, only 2 of 3 modes
  // resolvable" shape as Revenant Devastation's Battle Scarred loose end, left deliberately
  // uncurated rather than guessed (its Life Siphon Healing pair, 229/229, is genuinely identical and
  // needs no override).
  778: { Healing: 404 },

  // Reaper:

  // Shroud Knight (id 1905, Adept minor): "Gain life force loss reduction while in Reaper's Shroud."
  // Wiki (`split = pve, pvp wvw`): `{{skill fact|Life Force Drain per Second|4%|game mode = pve}}` +
  // `{{...|5%|game mode = pvp wvw}}` — pve 4, wvw+pvp 5, the rare WvW-worse case (drains more).
  1905: { 'Life Force Drain per Second': 5 },

  // Cold Shoulder (id 2018, Grandmaster minor): "Deal increased strike damage to chilled foes."
  // Wiki (`split = pve, wvw pvp`): `{{skill fact|damage increase|15|game mode = pve}}` + `{{...|10|
  // game mode = pvp wvw}}` — pve 15, wvw+pvp 10. Its "Damage Reduced" fact (10, unsplit) is a
  // different, unambiguous concept.
  2018: { 'Damage Increase': 10 },

  // Soul Eater (id 1969, Master major): "Deal increased strike damage. Heal when you strike a foe
  // within range." Wiki (`split = pve, wvw, pvp`): `{{skill fact|damage increase|15|game
  // mode=pve}}` + `{{...|10|game mode=wvw pvp}}` (pve 15, wvw+pvp 10) plus a genuine 3-way `{{skill
  // fact|healing|4%|game mode=pve}}` + `{{...|5%|game mode=wvw}}` + `{{...|10%|game mode=pvp}}`, all
  // 3 present as separate raw API facts (4, 10, 5). Its "Healing While in Shroud" fact (1%, unsplit)
  // is a different, unambiguous label.
  1969: { 'Damage Increase': 10, Healing: 5 },

  // Curses:

  // Parasitic Contagion (id 812, Master major): "Gain increased healing from healing skills while
  // affected by a condition." Wiki (`split = pve, wvw pvp`): `{{skill fact|healing|5%|alt=Percent|
  // game mode=pve}}` + `{{...|10%|game mode=wvw pvp}}` (API's own fact carries no `text`, falling
  // back to the fact-type name "Percent") — pve 5, wvw+pvp 10, the rare WvW-higher case.
  812: { Percent: 10 },

  // Soul Reaping:

  // Soul Barbs (id 894, Master major): "Increase all damage. Life Transfer duration is increased."
  // Wiki (`split = pve, wvw pvp`): `{{skill fact|Duration|15|game mode = pve}}` + `{{Skill
  // fact|Duration|10|game mode = pvp wvw}}` (`Time`-typed) — pve 15, wvw+pvp 10. Its "All Damage
  // Increase" fact (10, unsplit) is a different, unambiguous concept.
  894: { Duration: 10 },

  // Vital Persistence (id 861, Master major): "Gain vitality. Increase incoming healing." Wiki
  // (`split = pve, wvw pvp`): `{{skill fact|Incoming Healing Increase|20%|game mode=pve}}` +
  // `{{...|10%|game mode=pvp wvw}}` — pve 20, wvw+pvp 10.
  861: { 'Incoming Healing Increase': 10 },

  // Fear of Death (id 892, Master major): "Fear duration is increased. Gain life force when you
  // interrupt a foe." Wiki (`split = pve, wvw, pvp`): `{{skill fact|Duration Increase|100%|game
  // mode = pve}}` + `{{...|50%|game mode = pvp wvw}}` — pve 100, wvw+pvp 50. Its "Life Force" fact
  // carries only ONE raw API occurrence (15, matching the wiki's pve+wvw value; the pvp-only 7 is
  // simply absent from the API, nothing to filter).
  892: { 'Duration Increase': 50 },

  // Death Perception (id 893, Grandmaster major): "Gain increased critical-hit chance. Critical hits
  // deal increased damage." Wiki (`split = pve, wvw, pvp`): 2 independently-ambiguous labels —
  // `{{skill fact|critical damage increase|10|game mode=pve}}` + `{{...|15|game mode=wvw pvp}}`
  // (pve 10, wvw+pvp 15, WvW-higher) and `{{skill fact|critical chance increase|15|game mode = pve
  // wvw}}` + `{{...|10|game mode = pvp}}` (pve+wvw share 15, pvp alone drops to 10).
  893: { 'Critical Damage Increase': 15, 'Critical Chance Increase': 15 },

  // Spite:

  // Spiteful Talisman (id 914, Adept major): "Gain increased strike damage. Gain further increased
  // strike damage against foes without boons." Wiki (`split = pve, wvw pvp`): 2 independently-
  // ambiguous labels, both WvW-higher — `{{skill fact|damage increase|5|alt=Damage Increase against
  // Boonless Targets|game mode=pve}}` + `{{...|12|game mode=wvw pvp}}`, `{{skill fact|damage
  // increase|3|game mode=pve}}` + `{{...|7|game mode=wvw pvp}}`.
  914: { 'Damage Increase against Boonless Targets': 12, 'Damage Increase': 7 },

  // Signets of Suffering (id 909, Master major): "Signets are improved. Passively siphon health.
  // Remove boons from foes when activating a signet." Wiki (`split = pve, pvp, wvw` on the page, but
  // every individual template explicitly tags its non-pve value `game mode = pvp wvw` together, so
  // the actual split is pve-vs-(pvp+wvw) despite the generic split field): `{{skill fact|Life Siphon
  // Damage|1419|coefficient=?|game mode = pve}}` + `{{...|1002|game mode = pvp wvw}}` (live API:
  // 1413/997, a small reference-build gap on both raw numbers), `{{skill fact|life siphon
  // healing|alt=First-Hit Life Siphon Healing|1413|game mode = pve}}` + `{{...|997|game mode = pvp
  // wvw}}`, `{{...|alt=Additional-Hit Healing|237|game mode = pve}}` + `{{...|108|game mode = pvp
  // wvw}}` (matches the API exactly), and `{{skill fact|boons removed|2|game mode = pve pvp}}` +
  // `{{...|1|game mode = wvw}}` (pve+pvp share 2, wvw alone drops to 1 — the rare "pve pvp, wvw"
  // split direction, same shape as Death Nova above).
  909: { 'Boons Removed': 1, 'Life Siphon Damage': 997, 'First-Hit Life Siphon Healing': 997, 'Additional-Hit Healing': 108 },

  // Scourge:

  // Sand Sage (id 2121, Master minor): "Gain concentration and expertise." Wiki (`split = pve, wvw
  // pvp`): `{{skill fact|attribute|Concentration|225|game mode = pve}}` + `{{...|150|game mode =
  // pvp wvw}}` and identically for Expertise — pve 225, wvw+pvp 150 for both attributes (API's own
  // `AttributeAdjust` facts carry no `text`, keyed here by `target` "BoonDuration"/
  // "ConditionDuration").
  2121: { BoonDuration: 150, ConditionDuration: 150 },

  // Blood as Sand (id 2096, Grandmaster minor): "Reduce incoming strike, condition, and barrier
  // damage." Wiki (`split = pve, wvw pvp`): `{{skill fact|all damage reduced|15|game mode = pve}}`
  // + `{{...|7|game mode = pvp wvw}}` — pve 15, wvw+pvp 7.
  2096: { 'Damage Reduced': 7 },

  // Sand Savant (id 2112, Grandmaster major): "Manifest Sand Shade's recharge is increased, but it
  // pulses barrier to allies and damage to foes in the area, and its radius is increased." Wiki
  // (`split = pve, wvw, pvp`): `{{skill fact|icon=Count Recharge.png|Recharge Increase|25%|game
  // mode=pve}}` + `{{...|100%|game mode=pvp wvw}}` — pve 25, wvw+pvp 100 (WvW-worse, longer
  // recharge). Its "Increased Targets" fact (5, pve+pvp only per the wiki, unambiguous single raw
  // occurrence in the API) needs no override.
  2112: { 'Recharge Increase': 100 },

  // Demonic Lore (id 2164, Grandmaster major): "Gain increased condition damage. Manifest Sand
  // Shade pulses burning." Wiki (`split = pve wvw, pvp`): `{{skill fact|condition damage
  // increase|33|game mode=pve wvw}}` + `{{...|20|game mode=pvp}}` (API's own fact `text` is "Damage
  // Increase", not the wiki's "condition damage increase" wording) — pve+wvw share 33, pvp alone
  // drops to 20.
  2164: { 'Damage Increase': 20 },

  // Desert Empowerment (id 2080, Grandmaster major): "Manifest Sand Shade grants a barrier to allies
  // near it. When you apply barrier, grant boons to the affected target." Wiki (`split = pve, wvw,
  // pvp`): `{{skill fact|barrier|572|coefficient=1.0|game mode = pve}}` + `{{...|385|
  // coefficient=0.65|game mode = wvw}}` + `{{...|385|coefficient=0.8|game mode = pvp}}` — wvw and
  // pvp land on the exact same displayed number (385) despite different coefficients (same
  // "declared 3-way split, actual 2-way display" shape as Transfusion above), pve alone at 572; the
  // live API carries all 3 as separate raw facts (572, 385, 385). This trait's Alacrity/Vigor pair
  // is a genuine boon-TYPE swap (wiki: "This trait now grants vigor instead of alacrity in PvP and
  // WvW" (2024-03-19)) — handled separately in `wvw-fact-overrides.json` (`Alacrity: 'omit'`, `Vigor:
  // 2`), see that file's own comment for why this particular swap (unlike Guardian's Phoenix
  // Protocol/Ranger's Cloudburst) is cleanly resolvable.
  2080: { Barrier: 385 },

  // Harbinger:

  // Alchemic Vigor (id 2186, Master minor): "Gain increased vitality. Heal when you gain blight."
  // Wiki (`split = pve wvw, pvp`): `{{skill fact|Healing|13|coefficient=0.0125|game mode=pve wvw}}`
  // + `{{...|10|coefficient=0.0125|game mode=pvp}}` — pve+wvw share 13, pvp alone drops to 10. Its
  // "Vitality Increased" fact (240, genuinely identical both raw occurrences, no wiki split at all)
  // needs no override.
  2186: { Healing: 13 },

  // Wicked Corruption (id 2188, Adept major): "Deal increased strike damage per stack of blight.
  // Deal increased critical damage." Wiki (`split = pve, wvw pvp`): `{{skill fact|Damage
  // Increase|1|game mode = pve}}` + `{{...|0.5|game mode = pvp wvw}}` — pve 1, wvw+pvp 0.5. Its
  // "Critical Damage Increase" fact (10, genuinely identical both raw occurrences, no wiki split at
  // all) needs no override.
  2188: { 'Damage Increase': 0.5 },

  // Septic Corruption (id 2185, Adept major): "Deal increased condition damage per stack of blight.
  // Manifest Sand Shade inflicts poison." Wiki (`split = pve, wvw pvp`): `{{skill fact|Condition
  // Damage Increase|0.25|game mode=pve}}` + `{{...|0.5|game mode=wvw pvp}}` — pve 0.25, wvw+pvp 0.5,
  // the rare WvW-higher case. Its Poisoned Buff dupe (3s pve/2s wvw+pvp, no apply_count change) is
  // handled separately in `wvw-fact-overrides.json`.
  2185: { 'Condition Damage Increase': 0.5 },

  // Ritualist:

  // Boon of Creation (id 2371, Master minor): "Manifest a Spirit periodically. Gain concentration."
  // Wiki (`split = pve, wvw pvp`): `{{skill fact|attribute|concentration|180|game mode=pve}}` +
  // `{{...|60|game mode=wvw pvp}}` (`AttributeAdjust`, keyed by `target` "BoonDuration") and
  // `{{skill fact|life force|10|game mode=pve}}` + `{{...|3|game mode=wvw pvp}}` — 2
  // independently-ambiguous labels, both pve-high/wvw-low.
  2371: { 'Life Force': 3, BoonDuration: 60 },

  // Charged Souls (id 2398, Grandmaster minor): "Gain life force when a nearby Spirit is
  // destroyed." Wiki (`split = pve, wvw pvp`): `{{skill fact|life force|10|game mode=pve}}` +
  // `{{...|3|game mode=wvw pvp}}` — pve 10, wvw+pvp 3, the same shape as Boon of Creation above.
  2398: { 'Life Force': 3 },

  // Spirit's Gift (id 2378, Adept major): "Manifest Spirit of Preservation, which periodically heals
  // nearby allies." Wiki (`split = pve, wvw, pvp`): `{{skill fact|healing|850|coefficient=0.75|
  // game mode=pve}}` + `{{...|325|coefficient=0.3|game mode=wvw}}` + `{{...|181|coefficient=0.3|
  // game mode=pvp}}` — a genuine 3-way split, all distinct and all 3 present as their own raw API
  // facts (850, 325, 181, matching the wiki exactly).
  2378: { Healing: 325 },

  // Spirits' Remedy (id 2384, Master major): "Manifest Spirit of Preservation, which periodically
  // removes conditions from nearby allies." Wiki (`split = pve, wvw pvp`): `{{skill fact|conditions
  // removed|2|game mode=pve}}` + `{{...|1|game mode=wvw pvp}}` — pve 2, wvw+pvp 1.
  2384: { 'Conditions Removed': 1 },

  // Spirit's Strength (id 2421, Master major): "Increase the effectiveness of Spirits' passive
  // effects." Wiki (`split = pve, wvw pvp`): `{{skill fact|Effectiveness Increased|50%|game
  // mode=pve}}` + `{{...|20%|game mode=pvp wvw}}` — pve 50, wvw+pvp 20.
  2421: { 'Effectiveness Increased': 20 },

  // Lingering Spirits (id 2333, Grandmaster major): "When a Spirit is destroyed, its effect lingers
  // for a duration, but you lose life force over time." Wiki (`split = pve, wvw, pvp`): `{{skill
  // fact|Life Force Drain per Second|3%|game mode=pve wvw}}` + `{{...|5%|game mode=pvp}}` — pve+wvw
  // share 3, pvp alone rises to 5. Its own "Lingering Spirits" status appears 3 times in the raw API
  // (once each for Anguish's damage bonus, Wanderlust's movement-speed bonus, Preservation's healing
  // bonus) all sharing duration 0/apply_count 1 with no distinguishing raw value at all — a scan
  // false positive (3 different concepts colliding on one status, not a mode split), and each one's
  // real pve/wvw+pvp percentage lives only in the wiki's prose `desc=` param with no exposed `Fact`
  // field to pick from — an embedded-sub-value gap like Warrior's Peak Performance, same shape as
  // this trait's own sibling Empowering Spirits (2405, `BUFF_INSTANCE_VALUE_OVERRIDES`) Fury grant.
  2333: { 'Life Force Drain per Second': 3 }
}

/**
 * Gated by the same `requires_trait` rule as the boon/condition extractor in `boon-calc/sources.ts`
 * (a conditional fact only counts once the trait unlocking it is actually chosen). Deduplicates
 * identical lines (e.g. a skill with 2 near-identical Damage facts for a physical + condition
 * component both reporting the same hit count) rather than repeating them. `wvwOverrides` (see
 * `NUMERIC_FACT_WVW_OVERRIDES` above) additionally drops any `Number`/`Percent`/`AttributeAdjust`
 * fact whose `value`/`percent` doesn't match the WvW-correct one for its `text` — optional/defaulted
 * so every pre-existing caller without a matching entry keeps compiling and behaving unchanged. Only
 * applies to base `facts` (`requires_trait == null`): a `traitedFacts` entry sharing the same `text` is a
 * different value unlocked by a different trait, not another instance of the same game-mode
 * ambiguity, and filtering it against the base override would wrongly drop it too (see Serene
 * Rejuvenation's Numinous-Gift-conditioned pair in `NUMERIC_FACT_WVW_OVERRIDES` above).
 */
export function numericFactLines(facts: Fact[], traitedFacts: Fact[], activeIds: ReadonlySet<number>, wvwOverrides?: Record<string, number>): FactLine[] {
  const lines: FactLine[] = []
  const seen = new Set<string>()
  for (const fact of [...facts, ...traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    // Same label a wvwOverrides entry is keyed by: the fact's own `text`, or (AttributeAdjust only,
    // mirroring factLine's own display fallback) its `target` when `text` is absent entirely — see
    // this file's Imbued Haste comment above for why that fallback is needed at all.
    const label = typeof fact.text === 'string' ? fact.text : fact.type === 'AttributeAdjust' && typeof fact.target === 'string' ? fact.target : undefined
    if (wvwOverrides && fact.requires_trait == null && typeof label === 'string' && label in wvwOverrides) {
      const target = wvwOverrides[label]
      if (fact.type === 'Number' && fact.value !== target) continue
      if (fact.type === 'Percent' && fact.percent !== target) continue
      if (fact.type === 'AttributeAdjust' && fact.value !== target) continue
      if (fact.type === 'Time' && fact.duration !== target) continue
    }
    const line = factLine(fact)
    if (line && !seen.has(line.text)) {
      seen.add(line.text)
      lines.push(line)
    }
  }
  return lines
}
