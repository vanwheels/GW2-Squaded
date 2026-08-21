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
  2426: { 'Healing per Motivation Spent': 148 }
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
