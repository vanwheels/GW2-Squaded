import type { Fact, Skill } from '../types'

/**
 * A single wiki-verified `AttributeAdjust` healing fact: `Heal = baseValue + coefficient *
 * HealingPower`, quoted from the skill's own wiki `{{skill fact|healing|...|coefficient=...}}`
 * template (e.g. Signet of Restoration's active heal: `{{skill fact|healing|3275|coefficient=0.5}}`)
 * — not reverse-engineered, same rigor bar as `CURATED_RELIC_DAMAGE_BONUSES`/
 * `FURY_CRIT_CHANCE_TRAIT_BONUSES`. The GW2 API exposes `baseValue` itself (an `AttributeAdjust`
 * fact's `value`, computed at the API's reference build — 0 bonus Healing Power, matching this
 * app's own `BASE_ATTRIBUTES.Healing`) but never the `coefficient`, so that half has to come from
 * the wiki per skill (confirmed via raw wikitext, not paraphrase, after a summarized fetch and this
 * app's own `data/game-data/skills.json` disagreed for one skill — see git history).
 *
 * `factText` matches a fact's `text` field (e.g. "Healing per Cast") to select which of a skill's
 * possibly-several differently-labeled Healing facts (e.g. Signet of Restoration's active "Healing"
 * vs. passive "Healing per Cast") this entry is for — matched by presence only, NOT by re-checking
 * the fact's own `value` against `baseValue`. That's deliberate: several of these skills split their
 * Healing Power coefficient between "pve" and "pvp wvw" wiki-template modes (WvW groups with PvP
 * here, not PvE — confirmed per-skill via raw wikitext, the opposite of how this app's existing
 * `wvwFactOverrides` mechanism defaults Buff-duration facts to PvE-unless-overridden), and this
 * app's own `skills.json` only ever captured the API's default (PvE) value. So `baseValue` below is
 * deliberately the WvW-correct number where a split exists, not always the number `fact.value`
 * itself carries.
 */
export interface HealingCoefficient {
  factText: string
  baseValue: number
  coefficient: number
  /**
   * Set only when the wiki-documented value corresponds to a `requires_trait`-gated fact rather than
   * the skill's ungated one — needed because a skill can carry two facts sharing the exact same
   * `factText` (an ungated base value and a trait-boosted override of the same quantity), and without
   * this, `healingLinesForSkill`'s fact lookup always resolves to whichever sorts first in
   * `[...skill.facts, ...skill.traitedFacts]` (always the ungated one) regardless of which value the
   * curated entry actually means. Added 2026-08-05 alongside the same fix in `DamageCoefficient`/
   * `BarrierCoefficient`. First used 2026-08-05 for Necromancer's Chillblains (id 10605, see its own
   * entry below) — every other candidate found before that (e.g. Signet of Courage's Perfect
   * Inscriptions variant below) failed on missing/unreconcilable wiki data, not on this matching
   * problem.
   */
  requiresTrait?: number
}

/**
 * Seeded 2026-08-02 with one WvW-common heal skill per base profession; extended 2026-08-02 to a
 * full category sweep — every equippable Heal-slot skill across all 9 professions (plus the 2
 * shared racial heals) that carries a qualifying `AttributeAdjust`/`target: 'Healing'` fact, per a
 * full `skills.json` scan (85 candidates found; a handful left uncurated, see TODO.md for the list
 * and why). Deliberately a full category pass rather than build-by-build — this app is meant to
 * support cross-profession theorycrafting, not just whatever build was last tested, so Heal skills
 * were finished as one complete unit before moving to the next category (Utility, then Elite, then
 * weapon skills — see TODO.md). Utility-slot skills were swept the same way 2026-08-02 (see the
 * dedicated comment block below the racial Heal entries).
 */
export const CURATED_HEALING_COEFFICIENTS: Record<number, HealingCoefficient[]> = {
  // Elementalist — Signet of Restoration. Active heal has no PvE/WvW split; passive "Healing per
  // Cast" does (PvE 202/0.1 vs "pvp wvw" 171/0.07) — WvW value used.
  5503: [
    { factText: 'Healing', baseValue: 3275, coefficient: 0.5 },
    { factText: 'Healing per Cast', baseValue: 171, coefficient: 0.07 }
  ],
  // Elementalist — Ether Renewal. No PvE/WvW split.
  5507: [{ factText: 'Healing', baseValue: 996, coefficient: 0.15 }],
  // Elementalist — Glyph of Elemental Harmony (5 ids share one wiki page/base value). Coefficient
  // has a PvE/WvW split (PvE 1.2 vs WvW 1.0, base 6494 unchanged) — WvW value used.
  5569: [{ factText: 'Healing', baseValue: 6494, coefficient: 1.0 }],
  34609: [{ factText: 'Healing', baseValue: 6494, coefficient: 1.0 }],
  34651: [{ factText: 'Healing', baseValue: 6494, coefficient: 1.0 }],
  34724: [{ factText: 'Healing', baseValue: 6494, coefficient: 1.0 }],
  34743: [{ factText: 'Healing', baseValue: 6494, coefficient: 1.0 }],
  // Elementalist — Arcane Brilliance. No PvE/WvW split on the active heal; "Combo Healing" is a flat
  // additive fire-field-combo bonus with no coefficient= param on the wiki (not HP-scaled), so it's
  // left out rather than curated as 0-coefficient.
  21656: [{ factText: 'Healing', baseValue: 4840, coefficient: 0.3 }],
  // Elementalist — "Wash the Pain Away!" (Tempest). First/Second Heal have a PvE/WvW coefficient
  // split (base values unchanged) — WvW values used; Third Heal has no split.
  29535: [
    { factText: 'First Heal', baseValue: 2344, coefficient: 0.5 },
    { factText: 'Second Heal', baseValue: 1310, coefficient: 0.25 },
    { factText: 'Third Heal', baseValue: 660, coefficient: 0.25 }
  ],
  // Elementalist — Soothing Water (Weaver). Single "Healing" pulse fact with a PvE/WvW base-value
  // split (PvE 1340 vs WvW 1541, same 0.2 coefficient) — WvW value used.
  62827: [{ factText: 'Healing', baseValue: 1541, coefficient: 0.2 }],
  // Elementalist — Rejuvenate (Evoker's familiar-based heal, specializationId 80; 4 ids for Fox/Otter/Hare/Toad,
  // one wiki page lists all 4 in its infobox, confirming shared identical values). No PvE/WvW split.
  76634: [{ factText: 'Healing', baseValue: 6420, coefficient: 1.0 }],
  79314: [{ factText: 'Healing', baseValue: 6420, coefficient: 1.0 }],
  79315: [{ factText: 'Healing', baseValue: 6420, coefficient: 1.0 }],
  79323: [{ factText: 'Healing', baseValue: 6420, coefficient: 1.0 }],
  // Elementalist — Aquatic Stance (Catalyst). Re-investigated 2026-08-13 (was left uncurated as an
  // unconfirmed "wiki template value matches neither this app's API base nor the wiki's own version
  // history" conflict): resolved — the wiki's own dated Version History prose ("Increased the base
  // healing from 4,000 to 6,480") and the live API (6480) now agree with each other; only the
  // infobox's isolated `{{skill fact|healing|6400|...}}` template number is stale/unedited (off by
  // 80 from the same page's own prose), so 6480 is used, siding with the corroborated pair over the
  // one-off template param. Coefficient (1.0) unaffected by that patch, no PvE/WvW split documented.
  44239: [{ factText: 'Initial Heal', baseValue: 6480, coefficient: 1.0 }],
  // Engineer — Healing Turret (both ids share identical facts in data/game-data/skills.json).
  5857: [{ factText: 'Healing', baseValue: 2520, coefficient: 0.5 }],
  6140: [{ factText: 'Healing', baseValue: 2520, coefficient: 0.5 }],
  // Engineer — Elixir H. No PvE/WvW split.
  5834: [{ factText: 'Healing', baseValue: 5560, coefficient: 1.0 }],
  // Engineer — Cleansing Burst (Healing Turret's detonate). No PvE/WvW split.
  5980: [{ factText: 'Healing', baseValue: 2520, coefficient: 0.5 }],
  // Engineer — A.E.D. (both ids share identical facts). No PvE/WvW split on either fact.
  21659: [
    { factText: 'Healing when lethal damage taken', baseValue: 12280, coefficient: 1.72 },
    { factText: 'Healing', baseValue: 4344, coefficient: 0.6 }
  ],
  30881: [
    { factText: 'Healing when lethal damage taken', baseValue: 12280, coefficient: 1.72 },
    { factText: 'Healing', baseValue: 4344, coefficient: 0.6 }
  ],
  // Engineer — Medic Gyro (Scrapper). Both facts keep the same base value across modes but the
  // coefficient itself splits (PvE 0.7/0.6 vs WvW 0.2/0.25) — WvW coefficients used.
  30357: [
    { factText: 'Personal Heal', baseValue: 4510, coefficient: 0.2 },
    { factText: 'Area Pulse Heal', baseValue: 460, coefficient: 0.25 }
  ],
  // Engineer — Coolant Blast (Holosmith). PvE/WvW base-value split (PvE 4740 vs WvW 5250, same 0.8
  // coefficient) — WvW value used.
  40507: [{ factText: 'Healing', baseValue: 5250, coefficient: 0.8 }],
  // Engineer — Rectifier Signet (Mechanist). Untraited "Heal Pulse" splits 3 ways by game mode (PvE
  // 262/WvW 230/PvP 115, same 0.05 coefficient) — WvW value used; active "Healing" burst splits PvE
  // 6500 vs combined "pvp wvw" 5130 (same 1.0 coefficient) — WvW value used. **Re-investigated
  // 2026-08-22**: the Mech Core: J-Drive trait-upgraded pulse variant (requires_trait 2298) has no
  // dedicated wiki skill-fact template, but its Notes-section prose ("the base heal per pulse is
  // increased to 314 in PvE, and 276 in PvP and WvW") reconciles EXACTLY against the live API's own
  // `overrides`-indexed traited_facts (314/276/138 = the untraited 262/230/115 each times a clean
  // 1.2 — the same flat +20% signet-passive-potency bonus this trait grants, corroborated by the
  // Shape-1 audit backlog's Perfect Inscriptions sibling) — unlike Signet of Courage below, where the
  // 20% math left a small unreconciled gap. `healingLinesForSkill`'s per-label `Map` (last-entry-wins,
  // see `skill-fact-lines.ts`) makes this override-when-selected shape safe to add even though all 3
  // traited "Heal Pulse" facts share one `requires_trait`/text pair the raw-fact lookup can't
  // otherwise disambiguate — this entry's own `baseValue` is used directly, never the matched fact's
  // `value`.
  63049: [
    { factText: 'Heal Pulse', baseValue: 230, coefficient: 0.05 },
    { factText: 'Healing', baseValue: 5130, coefficient: 1.0 },
    { factText: 'Heal Pulse', baseValue: 276, coefficient: 0.05, requiresTrait: 2298 }
  ],
  // Engineer — Mitotic State (Amalgam). Re-investigated 2026-08-13 (was left uncurated as an
  // unconfirmed "API base 305 vs. wiki 7625" mismatch): resolved — 305 is the API's own per-pulse
  // AttributeAdjust value, not a competing total; the skill pulses for its full 5s Duration fact at
  // a 0.2s interval (25 pulses), and 305 * 25 = 7625 exactly, matching the wiki's documented total.
  // The wiki's own fact template is the summed-total figure (coefficient=1.0 both PvE and WvW,
  // 7625; PvP separately reduced to 5500 by a 2026-06-02 balance patch) — same convention as every
  // other "Healing" entry in this table, no per-pulse math needed at render time. No PvE/WvW split.
  76738: [{ factText: 'Healing', baseValue: 7625, coefficient: 1.0 }],
  // Guardian — Shelter.
  9102: [{ factText: 'Healing', baseValue: 4555, coefficient: 0.7 }],
  // Guardian — "Receive the Light!". Initial Self Heal and Allied Heal per Pulse keep the same base
  // value across modes but the coefficient splits (PvE 0.8/0.6 vs WvW 0.4/0.2) — WvW used. Self Heal
  // per Pulse has no split.
  9083: [
    { factText: 'Initial Self Heal', baseValue: 2600, coefficient: 0.4 },
    { factText: 'Self Heal per Pulse', baseValue: 650, coefficient: 0.16 },
    { factText: 'Allied Heal per Pulse', baseValue: 1044, coefficient: 0.2 }
  ],
  // Guardian — Signet of Resolve. PvE/WvW base-value split (PvE 8150 vs WvW 7286, same 1.25
  // coefficient) — WvW value used.
  9158: [{ factText: 'Healing', baseValue: 7286, coefficient: 1.25 }],
  // Guardian — Litany of Wrath. No PvE/WvW split.
  21664: [{ factText: 'Healing', baseValue: 1640, coefficient: 0.25 }],
  // Guardian — Purification (trap). Initial Heal has no split; Trap Heal has a PvE/WvW base-value
  // split (PvE 6480 vs WvW 4854, same 0.667 coefficient) — WvW value used.
  30025: [
    { factText: 'Initial Heal', baseValue: 1608, coefficient: 0.333 },
    { factText: 'Trap Heal', baseValue: 4854, coefficient: 0.667 }
  ],
  // Guardian — Restoring Reprieve (Firebrand's Mantra of Solace, regular charge). Single "Self-Heal"
  // fact with a PvE/WvW split (PvE 1478/0.54 vs WvW 199/0.1) — WvW value used.
  41475: [{ factText: 'Self-Heal', baseValue: 199, coefficient: 0.1 }],
  // Guardian — Rejuvenating Respite (Firebrand's Mantra of Solace, Final Charge — see
  // `mantra-final-charge.ts`). Single "Self-Heal" fact with a PvE/WvW split (PvE 3128/0.81 vs WvW
  // 3519/0.5 — WvW base is actually higher here) — WvW value used.
  42960: [{ factText: 'Self-Heal', baseValue: 3519, coefficient: 0.5 }],
  // Guardian — Reversal of Fortune (Willbender). Two genuinely distinct facts (attack-reversed heal
  // vs. fallback minimum heal), neither with a PvE/WvW split.
  62622: [
    { factText: 'Heal If Attacked', baseValue: 4264, coefficient: 1.54 },
    { factText: 'Heal if no attacks are reversed.', baseValue: 2132, coefficient: 0.77 }
  ],
  // Guardian — Resolute Stance (Luminary). No PvE/WvW split on any of the 3 facts (wiki flags the
  // Ally Healing coefficient with its own internal "unverified" maintenance tag, but it matches this
  // app's own API base value exactly).
  76621: [
    { factText: 'Healing', baseValue: 6550, coefficient: 1.0 },
    { factText: 'Ally Healing', baseValue: 3350, coefficient: 1.0 },
    { factText: 'Healing per Condition Removed', baseValue: 325, coefficient: 0.05 }
  ],
  // Mesmer — Ether Feast.
  10176: [
    { factText: 'Healing', baseValue: 5560, coefficient: 1.0 },
    { factText: 'Heal per Clone', baseValue: 640, coefficient: 0.1 }
  ],
  // Mesmer — Mirror. No PvE/WvW split.
  10177: [{ factText: 'Healing', baseValue: 5195, coefficient: 0.6 }],
  // Mesmer — Mantra of Recovery. No PvE/WvW split on either charge.
  10213: [
    { factText: 'Self-Healing', baseValue: 3275, coefficient: 0.5 },
    { factText: 'Ally-Healing', baseValue: 1965, coefficient: 0.3 }
  ],
  // Mesmer — Power Return. No PvE/WvW split.
  10214: [
    { factText: 'Healing', baseValue: 1640, coefficient: 0.25 },
    { factText: 'Healing below 50%', baseValue: 2620, coefficient: 0.4 }
  ],
  // Mesmer — Signet of the Ether. Active burst has no split. "Heal on Illusion Summon" has a PvE/WvW
  // base-value split (PvE 350 vs WvW 297, same ~0.06 coefficient) — WvW value used. The
  // Blurred Inscriptions-traited heal (requires_trait 752, base 6600) isn't in the wiki's normal
  // skill-fact block, only in Mechanics prose using a different template shape — left uncurated
  // rather than trusting a non-standard extraction.
  21750: [
    { factText: 'Healing', baseValue: 5560, coefficient: 0.85 },
    { factText: 'Heal on Illusion Summon', baseValue: 297, coefficient: 0.06 }
  ],
  // Mesmer — Well of Eternity (Chronomancer). Initial Self Heal's base value drops under the WvW
  // split (PvE 3230 vs WvW 2099, same 0.3 coefficient); Ending Heal keeps its base value (3870) but
  // the coefficient itself splits (PvE 1.2 vs WvW 0.8). WvW values used for both.
  30305: [
    { factText: 'Initial Self Heal', baseValue: 2099, coefficient: 0.3 },
    { factText: 'Ending Heal', baseValue: 3870, coefficient: 0.8 }
  ],
  // Mesmer — False Oasis (Mirage). Single per-pulse "Healing" fact with a PvE/WvW split (PvE
  // 1620/0.5 vs WvW 1215/0.2) — WvW value used.
  40200: [{ factText: 'Healing', baseValue: 1215, coefficient: 0.2 }],
  // Mesmer — Twin Blade Restoration (Virtuoso). No PvE/WvW split.
  62522: [{ factText: 'Healing', baseValue: 3100, coefficient: 1.0 }],
  // Mesmer — Tale of the Second Scion (Troubadour). The GW2 API returns zero real Healing facts for
  // this skill (confirmed via a live /v2/skills/76695 pull, not just this app's cached skills.json)
  // — resolved 2026-08-04 via data/game-data/synthetic-facts.json, which injects wiki-sourced `Fact`
  // objects with the matching text/type/target so this table has something to key off (see
  // docs/game-data.md). "Self-Healing" has no PvE/WvW split. "Ally Healing" has a coefficient-only
  // split (PvE 1.0, WvW/PvP 0.5, same 2250 base) — WvW value used.
  76695: [
    { factText: 'Self-Healing', baseValue: 3535, coefficient: 1.0 },
    { factText: 'Ally Healing', baseValue: 2250, coefficient: 0.5 }
  ],
  // Necromancer — Summon Blood Fiend (id 10547) has no table entry at all, deliberately. Its own
  // wiki Notes section states outright "it has 0 healing power and cannot be increased by any
  // means" — a genuine coefficient-0 non-scaler, same shape as Restorative Spear (72966) below.
  // Unlike Restorative Spear, though, its wiki infobox base value (926) doesn't match the live
  // API's (510) — but since the coefficient is 0 either way, a curated entry would be a pure no-op
  // at best (identical to today's uncurated fallback display of the raw 510 API fact) or actively
  // wrong at worst (if 926 were used instead) — no version-history entry reconciles the gap.
  // **Investigated 2026-08-22**, left uncurated on purpose, not an oversight.
  // Necromancer — Well of Blood (base skill id only; id 10670 shares this same wiki page — its
  // infobox literally lists `id = 10527, 10670` as one canonical pair, unlike a structurally-
  // unreachable orphan — but its *live* API values, 5240/280, still don't match either the
  // PvE or WvW/PvP split below. **Re-investigated 2026-08-22**: 280 is exactly the pre-
  // 2023-11-28-patch WvW/PvP pulse value (before that patch's "280 to 496" bump), and 10670
  // carries no `GroundTargeted` flag where 10527 does — same "frozen legacy duplicate id,
  // stale pre-patch numbers" shape as Guardian's underwater Sanctuary (31295) above, not a
  // genuine Scourge-context variant as originally guessed. Still left uncurated — a frozen id's
  // own stale numbers aren't the WvW-current figure this table is supposed to encode, and 5240
  // doesn't cleanly match any single historical patch value either, so there's nothing reliable
  // to curate it TO). WvW splits used for both facts on 10527 (PvE 2936/1.0, 664/0.5).
  10527: [
    { factText: 'Initial Self Heal', baseValue: 4454, coefficient: 1.0 },
    { factText: 'Health per Second', baseValue: 496, coefficient: 0.2 }
  ],
  // Necromancer — Consume Conditions. No PvE/WvW split.
  10548: [
    { factText: 'Healing', baseValue: 6840, coefficient: 1.0 },
    { factText: 'Heal per condition', baseValue: 724, coefficient: 0.1 }
  ],
  // Necromancer — Taste of Death. WvW groups with PvE here (not PvP) — "pve wvw"=3960 vs pvp=4460 —
  // used the pve/wvw value.
  10577: [{ factText: 'Healing', baseValue: 3960, coefficient: 1.0 }],
  // Necromancer — Signet of Vampirism. No PvE/WvW split on any fact. The API's "Initial Self Heal"
  // (4950) is a stale pre-2023-11-28-patch duplicate of the same effect now shown as "Healing"
  // (5750) — not a distinct mechanic, so only "Healing" is curated, not "Initial Self Heal".
  // "Active Life Siphon Heal" and "Healing" reconfirmed exact via 2 live in-game WvW readings
  // 2026-08-23 (108/215 Healing Power); "Passive Life-Siphon Healing"'s coefficient was found wrong
  // by that same pass (0.024 predicted 198 at 108 Healing Power, live tooltip showed 197) and
  // corrected to 0.022, which fits both readings exactly — base (195) was already right. This skill's
  // sibling `Life Siphon Damage` facts are now curated too, see `CURATED_SIPHON_DAMAGE_COEFFICIENTS`.
  21762: [
    { factText: 'Passive Life-Siphon Healing', baseValue: 195, coefficient: 0.022 },
    { factText: 'Active Life Siphon Heal', baseValue: 600, coefficient: 0.24 },
    { factText: 'Healing', baseValue: 5750, coefficient: 0.5 }
  ],
  // Necromancer — "Your Soul Is Mine!" (Reaper). PvE/WvW base-value split (PvE 4555 vs WvW 6174,
  // same 0.7 coefficient) — WvW value used.
  30488: [{ factText: 'Healing', baseValue: 6174, coefficient: 0.7 }],
  // Necromancer — Sand Flare (Scourge). "Self Barrier"/"Ally Barrier" are genuine wiki Barrier-type
  // facts (not Healing Power-scaled healing, despite the API tagging their target as "Healing") —
  // not modeled by this app's Healing Power formula, so only "Self Heal" is curated. Its coefficient
  // splits by mode (PvE 1.1 vs WvW 0.75, same 3230 base) — WvW value used.
  43148: [{ factText: 'Self Heal', baseValue: 3230, coefficient: 0.75 }],
  // Necromancer — Resilient Weapon (Ritualist). PvE/WvW split (PvE 1092/0.28 vs WvW 1412/0.2) — WvW
  // value used.
  77259: [{ factText: 'Healing per Second', baseValue: 1412, coefficient: 0.2 }],
  // Ranger — Water Spirit. WvW split used (PvE was 3002/0.4). Originally also keyed to 69244 (the id
  // the picker's GroundTargeted signal picked, sharing identical facts with 21773) — the full
  // skill-picker duplicate-id audit (2026-08-04) found 69244 isn't the wiki-documented id, same
  // shape as its 5 sibling Spirits (Storm/Stone/Frost/Sun/Nature), all of which have an identical
  // unexplained non-ground duplicate; moved to `skill-variant-exclusions.json`.
  21773: [{ factText: 'Healing', baseValue: 1998, coefficient: 0.4 }],
  // Ranger — Troll Unguent. No PvE/WvW split. factText fixed 2026-08-12 (found by the Tier 2
  // golden-snapshot build): live API capitalizes this fact "Health per Second" — was silently never
  // matching due to the lowercase "second", value unchanged.
  12483: [{ factText: 'Health per Second', baseValue: 1062, coefficient: 0.12 }],
  // Ranger — Healing Spring. No PvE/WvW split.
  12489: [{ factText: 'Healing', baseValue: 4920, coefficient: 1.0 }],
  // Ranger — Aqua Surge (Water Spirit's underwater slam follow-up). Confirmed via its own wiki page
  // that unlike Water Spirit itself, this fact has NO PvE/WvW split — 3002/0.4 applies in every mode.
  21776: [{ factText: 'Healing', baseValue: 3002, coefficient: 0.4 }],
  // Ranger — Glyph of Rejuvenation (Druid). 2 ids are the wiki's own "(non-celestial)" vs "(Celestial
  // Avatar)" sub-pages, not duplicates — self/ally roles swap once transformed. Both split PvE/WvW by
  // COEFFICIENT as well as base value (not just base value) — WvW values used for both.
  31819: [
    { factText: 'Self-Healing', baseValue: 5589, coefficient: 1.25 },
    { factText: 'Allied Healing', baseValue: 2535, coefficient: 1.0 }
  ],
  31867: [
    { factText: 'Self-Healing', baseValue: 2535, coefficient: 1.0 },
    { factText: 'Allied Healing', baseValue: 5589, coefficient: 1.25 }
  ],
  // Ranger — "We Heal As One!". No PvE/WvW split.
  31914: [{ factText: 'Healing', baseValue: 6520, coefficient: 1.0 }],
  // Ranger — Bear Stance (Soulbeast). No PvE/WvW split on either fact.
  44948: [
    { factText: 'Healing', baseValue: 4963, coefficient: 0.4 },
    { factText: 'Per Condition Removed', baseValue: 408, coefficient: 0.4 }
  ],
  // Ranger — Soothing Breeze (Galeshot). No PvE/WvW split.
  77271: [{ factText: 'Healing', baseValue: 6520, coefficient: 1.0 }],
  // Revenant — Empowering Misery (28219 core Revenant Legend skill; 78681 is its
  // specializationId-79 "Conduit" variant). Both ids share identical facts. No split found.
  28219: [
    { factText: 'Healing', baseValue: 4600, coefficient: 1.0 },
    { factText: 'Heal per Condition', baseValue: 596, coefficient: 0.1 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  78681: [
    { factText: 'Healing', baseValue: 4600, coefficient: 1.0 },
    { factText: 'Heal per Condition', baseValue: 596, coefficient: 0.1 }
  ],
  // Revenant — Enchanted Daggers (Legendary Assassin). Siphon Healing has no split. Initial Heal's
  // wiki base (1640, coefficient 0.25, no PvE/WvW split) never matched this app's own API base
  // (1560), an unexplained 80-point discrepancy that didn't fit `siphon-damage-calc.ts`'s own
  // `wikiQuoted = apiRaw + coefficient * 1000` pattern found on this same skill's Siphon Damage facts
  // (0.25*1000 = 250, not 80). **Resolved 2026-08-23** via 2 live in-game tooltip readings at known
  // Healing Power (0 HP -> 1,560 heal; 1,348 HP -> 1,897 heal): base = 1560 (exact match for the
  // API's own raw value — the wiki's 1640 was simply wrong) and coefficient = (1897-1560)/1348 =
  // 0.25 (predicts 1897.0 exactly at 1348 HP). Same in-game pass independently reconfirmed Siphon
  // Healing's existing 768/0.2 entry below (0 HP -> 768; 1,348 HP -> 1,038, matching 768+0.2*1348 =
  // 1037.6 -> rounds to 1038) and Siphon Damage's WvW pair (see `siphon-damage-calc.ts`).
  26937: [
    { factText: 'Siphon Healing', baseValue: 768, coefficient: 0.2 },
    { factText: 'Initial Heal', baseValue: 1560, coefficient: 0.25 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Infuse Light (Herald, Legendary Dragon Stance). No PvE/WvW split.
  27228: [{ factText: 'Healing', baseValue: 1853, coefficient: 1.0 }],
  // Revenant — Soothing Stone (Legendary Centaur Stance). No PvE/WvW split.
  27372: [
    { factText: 'Healing', baseValue: 5501, coefficient: 1.0 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Project Tranquility (Legendary Centaur Stance facet). Single "Healing" fact with a
  // PvE/WvW split (PvE 363 vs WvW 325, same 0.05 coefficient) — WvW value used.
  29148: [{ factText: 'Healing', baseValue: 325, coefficient: 0.05 }],
  // Revenant — Selfless Spirit / Selfish Spirit (Vindicator, specializationId 69) — 2 different-named
  // skills, not a shared page. No PvE/WvW split on either.
  62680: [
    { factText: 'Healing', baseValue: 714, coefficient: 0.22 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  62719: [
    { factText: 'Healing per Hit', baseValue: 714, coefficient: 0.22 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Shielding Hands (Conduit). Self-Healing has a PvE/WvW base-value split (PvE 1950
  // vs WvW 1310, same 0.2 coefficient) — WvW value used. Allied Healing has no split.
  77043: [
    { factText: 'Self-Healing', baseValue: 1310, coefficient: 0.2 },
    { factText: 'Allied Healing', baseValue: 975, coefficient: 0.1 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Thief — Withdraw. WvW split used (PvE was 4778/0.66).
  13021: [{ factText: 'Healing', baseValue: 5243, coefficient: 0.66 }],
  // Thief — Hide in Shadows. No PvE/WvW split.
  13027: [{ factText: 'Healing', baseValue: 6026, coefficient: 1.0 }],
  // Thief — Signet of Malice. Active on-cast heal only — the passive per-hit heal shares the exact
  // same fact `text` ("Healing") as the active heal in this app's own skill data, and this table's
  // lookup matches by factText string, so curating both would let one silently clobber the other
  // (same reason Healing Signet's passive tick is excluded above). No split on the active heal.
  13050: [{ factText: 'Healing', baseValue: 3275, coefficient: 0.5 }],
  // Thief — Skelk Venom. Initial Self Heal has a PvE/WvW split (PvE 4210/0.75 vs WvW 3578/0.4) — WvW
  // value used. The per-hit "Healing" fact has no split.
  21778: [
    { factText: 'Initial Self Heal', baseValue: 3578, coefficient: 0.4 },
    { factText: 'Healing', baseValue: 1206, coefficient: 0.3 }
  ],
  // Thief — Channeled Vigor (Daredevil). Wiki lists both facts as 3-pulse SUMMED totals (the
  // tooltip's own convention, confirmed in its Notes section) rather than this app's per-pulse
  // `AttributeAdjust` values — divided each by 3 to match: 7320/1.5 -> 2440/0.5 (clean), 5520/1.123
  // -> 1840/0.3743 (both base values land exactly on this app's own API value after dividing,
  // confirming the derivation; the second coefficient just isn't a round number in-game).
  30400: [
    { factText: 'Heal if Endurance is Full', baseValue: 2440, coefficient: 0.5 },
    { factText: 'Healing', baseValue: 1840, coefficient: 0.3743 }
  ],
  // Thief — Malicious Restoration (Deadeye). No PvE/WvW split.
  45088: [{ factText: 'Healing', baseValue: 7200, coefficient: 0.7 }],
  // Thief — Well of Gloom (Specter). Both facts have a PvE/WvW split (Self-Heal PvE 3560/1.0 vs WvW
  // 4454/1.0; Area Heal PvE 857/0.666 vs WvW 520/0.2) — WvW values used for both.
  63292: [
    { factText: 'Self-Heal', baseValue: 4454, coefficient: 1.0 },
    { factText: 'Area Heal', baseValue: 520, coefficient: 0.2 }
  ],
  // Warrior — Healing Signet (active burst only; the passive per-second tick isn't captured as an
  // `AttributeAdjust` fact in this app's skill data at all, so it can't be rendered here) and
  // Mending. Neither has a PvE/WvW split.
  14389: [{ factText: 'Healing', baseValue: 2320, coefficient: 0.35 }],
  14401: [{ factText: 'Healing', baseValue: 6520, coefficient: 1.2 }],
  // Warrior — "To the Limit!". 3-way split by mode (PvE 9100 / WvW 7735 / PvP 6575, same 1.0
  // coefficient) — WvW value used.
  14402: [{ factText: 'Healing', baseValue: 7735, coefficient: 1.0 }],
  // Warrior — Blood Reckoning (Berserker). No PvE/WvW split.
  30189: [{ factText: 'Healing', baseValue: 3230, coefficient: 0.3 }],
  // Warrior — Combat Stimulant (Bladesworn). "Initial Healing" groups PvE+WvW together (vs a lower
  // PvP-only value) — the grouped value matches this app's own API base value directly. "Delayed
  // Healing" is a single fact split 3 ways by mode (PvE 7160/1.0, WvW 3580/0.5, PvP 3080/0.5) — WvW
  // value used; the 3 apiValues given for this skill are simply that fact's 3 mode variants, not 3
  // separate stacking tiers.
  62978: [
    { factText: 'Initial Healing', baseValue: 3260, coefficient: 0.5 },
    { factText: 'Delayed Healing', baseValue: 3580, coefficient: 0.5 }
  ],
  // Warrior — "We Shall Return!" (Paragon). No PvE/WvW split on either fact, despite the page's
  // header declaring a split exists.
  76755: [
    { factText: 'Healing', baseValue: 3890, coefficient: 0.7 },
    { factText: 'Echo Healing', baseValue: 1950, coefficient: 0.5 }
  ],
  // Racial — Prayer to Dwayna (Human). No PvE/WvW split.
  12360: [{ factText: 'Healing', baseValue: 6520, coefficient: 0.85 }],
  // Racial — Healing Seed (Sylvari). No PvE/WvW split.
  12440: [{ factText: 'Healing', baseValue: 6520, coefficient: 1.0 }],

  // --- Utility-slot skills (category sweep 2026-08-02, see TODO.md/COMPLETED.md) ---
  // Of 40 Utility-slot skills the API tags with a Healing-type `AttributeAdjust` fact, 17 are
  // actually Barrier facts (the API mislabels Barrier's target as "Healing" too — same quirk
  // already noted on Necromancer's Sand Flare above); those are out of scope (Barrier is a
  // separate resource bar this app doesn't model) and not listed here at all, curated or not.
  // Of the 23 genuine Healing candidates, 3 stayed uncurated on their own id: Guardian's underwater
  // Sanctuary variant (id 31295, no wiki-documented coefficient exists for it at all), Guardian's
  // Repose (id 62669, the wiki's own coefficient field was a literal unfilled "?" stub — resolved
  // 2026-08-23, see below), and Revenant's Natural Harmony's orphan (id 29082, wiki base 1124 vs.
  // this id's own live API base 1620 — a genuine disagreement). Of those 3, Natural Harmony is NOT a
  // real gap — same shape as Energy Expulsion above: 29082 is a structurally-unreachable orphan (see
  // Elite section above), and the live/reachable id (27025, below) was separately curated with the
  // wiki-correct 1124 in the 2026-08-12 Renegade sweep. TODO.md's exceptions list closed this item
  // 2026-08-13 on that basis; Sanctuary remains genuinely open (see TODO.md).
  // Elementalist — Signet of Water (both ids share one wiki page/identical Healing fact; 49056
  // is a stale/legacy duplicate id missing the post-2025-06-24 "Conditions Removed" fact). No
  // PvE/WvW split on the heal itself.
  5570: [{ factText: 'Healing', baseValue: 1940, coefficient: 1.3 }],
  49056: [{ factText: 'Healing', baseValue: 1940, coefficient: 1.3 }],
  // Engineer — Elixir C. Heals once per boon currently held, right after converting conditions to
  // boons. No PvE/WvW split.
  5860: [{ factText: 'Healing', baseValue: 450, coefficient: 0.05 }],
  // Guardian — Sanctuary (ground-targeted version; id 31295 is a self-cast underwater variant the
  // wiki's page doesn't separately document a coefficient for — left uncurated). Per-pulse heal, no
  // PvE/WvW split (only recharge differs by mode).
  9128: [{ factText: 'Healing', baseValue: 522, coefficient: 0.1375 }],
  // Guardian/Willbender — Repose (Flash Combo's follow-up heal). Wiki stub had no coefficient at
  // all; resolved 2026-08-23 via 2 live in-game tooltip readings at known Healing Power (0 HP →
  // 1,635 heal; 1,347 HP → 2,713 heal), solving base+coefficient*HP directly: base = 1635 (the
  // reading at 0 HP, and an exact match for the already-known post-2025-11-18-patch WvW/PvP base
  // noted below), coefficient = (2713-1635)/1347 ≈ 0.8 (predicts 2712.6 at 1347 HP, which rounds to
  // the observed 2713 — confirms the fit). No PvE reading taken; this app only stores the WvW value
  // anyway per its existing convention. If the PvE value is ever needed, note a 2025-11-18 balance
  // patch dropped the WvW/PvP base from 2595 to 1635 without touching PvE (the API's own raw base is
  // still 2595, i.e. the pre-patch/PvE figure) — don't reuse 2595 as the WvW base.
  62669: [{ factText: 'Healing', baseValue: 1635, coefficient: 0.8 }],
  // Guardian — Bow of Truth (2 flip-skill halves — cast + follow-up — sharing one wiki page and
  // identical facts). Coefficient splits PvE 0.15 vs "pvp wvw" 0.05 (base value unchanged) — WvW
  // value used. The wiki infobox's own `id = 9175, 43565` field documents exactly these 2 as
  // canonical; this app's local data also carried a same-shape auto-target duplicate pair
  // (46600/46750, identical facts) that the wiki page never documents — moved to
  // `skill-variant-exclusions.json` by the full skill-picker duplicate-id audit (2026-08-04), same
  // "4th Spirit Weapon" family as Guardian's already-fixed Sword of Justice/Shield of the
  // Avenger/Hammer of Wisdom.
  9175: [{ factText: 'Healing', baseValue: 232, coefficient: 0.05 }],
  43565: [{ factText: 'Healing', baseValue: 232, coefficient: 0.05 }],
  // Guardian — Merciful Intervention. Single heal-on-impact effect split PvE (2344/1.1) vs "pvp wvw"
  // (2024/0.8) — the API flattens this into two identically-labeled "Healing" facts (same shape as
  // Thief's Signet of Malice above), so only the WvW-correct pair is curated here.
  9246: [{ factText: 'Healing', baseValue: 2024, coefficient: 0.8 }],
  // Guardian — Valorous Stance (Willbender). Genuine Healing-Power-scaling proc heal fired once per
  // boon granted to nearby allies (confirmed via description — not Barrier, not a flat tick). No
  // PvE/WvW split.
  77300: [{ factText: 'Healing', baseValue: 76, coefficient: 0.0046 }],
  // Ranger — Glyph of Alignment (Celestial Avatar-form cast; the non-celestial cast deals damage
  // instead, a separate id not in this table). No PvE/WvW split.
  31348: [{ factText: 'Healing', baseValue: 3076, coefficient: 1.0 }],
  // Ranger — Glyph of Burgeoning (non-Celestial-Avatar-form cast; id 31740 is the same skill name's
  // Celestial-Avatar-form cast, which grants Barrier instead — excluded, Barrier not modeled). No
  // PvE/WvW split.
  31888: [{ factText: 'Healing', baseValue: 1935, coefficient: 1.0 }],
  // Thief — Shadow Refuge. Per-pulse tick (5 pulses over the field's duration); wiki's own skill-fact
  // template gives the 5-pulse aggregate (2850/0.9), matched here to this app's per-pulse API fact by
  // dividing by 5. No PvE/WvW split. Also grants percentage-based revive healing to downed allies
  // (5%/pulse) not captured by this Healing Power coefficient at all.
  13117: [{ factText: 'Healing', baseValue: 570, coefficient: 0.18 }],
  // Warrior — Dolyak Signet (active burst heal). No PvE/WvW split.
  14413: [{ factText: 'Healing', baseValue: 2870, coefficient: 0.35 }],
  // Revenant — Vengeful Hammers (Legendary Dwarf Stance, Jalis). Passive per-hit heal tick from the
  // summoned hammers. No PvE/WvW split.
  26557: [
    { factText: 'Healing', baseValue: 53, coefficient: 0.004 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Purifying Essence (Legendary Centaur Stance, Ventari facet). No PvE/WvW split on the
  // healing fact itself (only recharge splits).
  29197: [{ factText: 'Healing per Condition Removed', baseValue: 325, coefficient: 0.2 }],
  // Revenant — Tree Song (Legendary Alliance Stance, Kurzick; Vindicator. 2 ids are the same skill's
  // legend-swap variants, confirmed byte-identical Healing facts via direct API pulls). No PvE/WvW
  // split.
  62793: [{ factText: 'Healing per Condition', baseValue: 709, coefficient: 0.22 }],
  62941: [
    { factText: 'Healing per Condition', baseValue: 709, coefficient: 0.22 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Necromancer — Nightmare Weapon (Ritualist utility, not Harbinger as previously noted here —
  // corrected 2026-08-23 after a live in-game screenshot showed the caster's own character panel;
  // confirmed by `specializations.json`, which already has Ritualist modeled). Both game-mode variants
  // share the exact same fact text ("Life Siphon Healing") on the wiki too — a genuine duplicate
  // label, not an app oversight — so only the WvW-correct pair is curated (PvE-only: base 774,
  // coefficient 0.5). This skill's sibling `Life Siphon Damage` fact is now curated too, see
  // `CURATED_SIPHON_DAMAGE_COEFFICIENTS`.
  76739: [{ factText: 'Life Siphon Healing', baseValue: 606, coefficient: 0.15 }],
  // Necromancer — Weapon of Remedy (Harbinger). No PvE/WvW split.
  77022: [{ factText: 'Healing per Condition Removed', baseValue: 408, coefficient: 0.2 }],

  // --- Elite-slot skills (category sweep 2026-08-02, see TODO.md/COMPLETED.md) ---
  // Only 12 equippable Elite-slot skills carry a Healing-type `AttributeAdjust` fact at all (a much
  // smaller surface than Heal/Utility) — of those, 1 (Warrior's "We Will Never Yield!", id 76562) is
  // the same API Barrier-mislabeling trap already seen on Necromancer's Sand Flare/several Utility
  // skills (its 2 Healing-tagged facts are literally named "Minimum Barrier"/"Maximum Barrier") and is
  // out of scope, not listed here. Of the remaining 11 genuine Healing candidates, 1 (Revenant's
  // Energy Expulsion, id 29114 — its own stale pre-2022-06-28 fact set, see below) stayed uncurated
  // on its own id, but the skill itself is NOT a real gap: the live/reachable id (27356, outside this
  // 12-candidate count since it originally carried zero API Healing facts) was separately curated via
  // synthetic-facts.json in the 2026-08-12 Renegade sweep — see that entry below. TODO.md's exceptions
  // list closed this item 2026-08-13 on that basis.
  // Elementalist — Crashing Waves. No PvE/WvW split.
  25492: [{ factText: 'Healing', baseValue: 6410, coefficient: 1.0 }],
  // Elementalist — "Rebound!" (Tempest). No PvE/WvW split.
  29968: [{ factText: 'Healing', baseValue: 2836, coefficient: 1.5 }],
  // Guardian — Signet of Courage (both ids share identical facts — 68676 is a Dragonhunter-tagged
  // duplicate of the same core-Guardian signet). No PvE/WvW split on any of the 3 facts. A 4th fact
  // shares the exact same text ("Passive Healing") as the base passive heal but is the Perfect
  // Inscriptions trait's boosted variant (requires_trait 579) — same identical-text collision already
  // documented on Thief's Signet of Malice. **Re-investigated 2026-08-05** alongside building
  // `HealingCoefficient.requiresTrait` (the same fix `CURATED_DAMAGE_COEFFICIENTS`'s Mesmer entries and
  // `CURATED_BARRIER_COEFFICIENTS`'s Lava Skin got) to see if this could finally be curated: Perfect
  // Inscriptions' own wiki page gives a clean `{{skill fact|percent|20}}` and its Notes table states
  // "Signet of Courage: Passive Healing increased by 20%," but 202 * 1.2 = 242.4 doesn't reconcile with
  // the live API's own traited `value` (240) closely enough to trust — a genuine, small, unexplained
  // mismatch, not confidently attributable to rounding. Left uncurated rather than guessing which of
  // baseValue/coefficient the 20% applies to, or forcing the API's raw 240 with no wiki-sourced
  // coefficient to pair it with — same "leave uncurated" bar as this table's other unclear cases
  // (Blurred Inscriptions above, Rectifier Signet below).
  30461: [
    { factText: 'Passive Healing', baseValue: 202, coefficient: 0.15 },
    { factText: 'Active Heal Pulse', baseValue: 650, coefficient: 0.2 },
    { factText: 'Final Heal Pulse', baseValue: 3250, coefficient: 2.0 }
  ],
  68676: [
    { factText: 'Passive Healing', baseValue: 202, coefficient: 0.15 },
    { factText: 'Active Heal Pulse', baseValue: 650, coefficient: 0.2 },
    { factText: 'Final Heal Pulse', baseValue: 3250, coefficient: 2.0 }
  ],
  // Necromancer — Xinrae's Weapon (Harbinger). "Life Siphon Healing" splits by mode (PvE 1990/0.005
  // vs "pvp wvw" 1001/0.005, same coefficient) — WvW value used. The wiki doesn't separately document
  // a plain "Healing" fact for this skill; only the siphon.
  76941: [{ factText: 'Life Siphon Healing', baseValue: 1001, coefficient: 0.005 }],
  // Ranger — Glyph of the Stars (Druid). 2 ids are genuinely different sub-skills, not duplicates —
  // the wiki's own "(Celestial Avatar)" and "(non-celestial)" sub-pages document different base
  // values/coefficients for each cast form. No PvE/WvW split on either's healing fact (only the
  // Celestial Avatar form's separate revive-% fact splits by mode, unrelated to Healing Power).
  55024: [{ factText: 'Healing', baseValue: 392, coefficient: 0.14 }], // Celestial Avatar form
  55046: [{ factText: 'Healing', baseValue: 293, coefficient: 0.105 }], // non-celestial form
  // Revenant — Soulcleave's Summit (Vindicator). Both "Healing" and "Life Siphon Healing" split by
  // mode (Healing: "pve wvw" 1439/0.25 vs pvp 1199/0.25; Life Siphon Healing: "pve wvw" 578/0.5 vs
  // pvp 489/0.12) — WvW groups with PvE for both here (opposite of Xinrae's Weapon above) — WvW
  // values used for both.
  45773: [
    { factText: 'Healing', baseValue: 1439, coefficient: 0.25 },
    { factText: 'Life Siphon Healing', baseValue: 578, coefficient: 0.5 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Urn of Saint Viktor (Vindicator). PvE/WvW base-value split (PvE+PvP grouped 708 vs WvW
  // 450, same 0.22 coefficient) — WvW value used.
  62687: [
    { factText: 'Healing', baseValue: 450, coefficient: 0.22 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Drop Urn of Saint Viktor (Vindicator, Urn of Saint Viktor's flip-skill detonate). No
  // PvE/WvW split.
  62738: [{ factText: 'Base Heal', baseValue: 709, coefficient: 0.22 }],

  // --- Weapon-slot skills (category sweep 2026-08-02, see TODO.md/COMPLETED.md; last category —
  // Heal/Utility/Elite were swept first). Of 648 distinct weapon-skill ids across every profession's
  // weapons (main-hand, off-hand, two-handed, underwater, every elite-spec weapon including the
  // newer Janthir Wilds Spear), 110 carry a Healing-type `AttributeAdjust` fact. 17 are the familiar
  // Barrier-mislabeling trap (API tags Barrier facts `target: 'Healing'` too) and out of scope, not
  // listed here. A second, previously-unseen trap surfaced this sweep: 38 candidates (nearly every
  // initiative-costing Thief weapon skill) turned out to be a single trait, Assassin's Reward
  // ("Heal yourself...for each point of initiative spent", id 1238, Deadly Arts), duplicated onto
  // every skill's own facts as a `requires_trait`-gated entry — that's a shared trait formula, not a
  // per-skill design, so it doesn't belong in a per-skill coefficient table (same reasoning already
  // used below to leave Signet of Courage's Perfect Inscriptions-boosted variant uncurated) and none
  // of those 38 are listed here either; a generalized trait-bonus table (like
  // `FURY_CRIT_CHANCE_TRAIT_BONUSES`) would be the right home for it if ever built, but that shape
  // needs per-skill initiative-cost data this app doesn't model anywhere yet (see TODO.md, investigated
  // 2026-08-05 while curating Chillblains below) — deferred, not curated. A third, one-off case that
  // looked like the same shape but wasn't: Necromancer's Chillblains (id 10605) has no unconditional
  // Healing fact at all — its only Healing fact requires trait 778 (Transfusion) — but unlike Assassin's
  // Reward, Transfusion's own wiki page documents this exact fact as a real per-skill design (its
  // "Chillblains additional effects" bullet), so it's curated below via `requiresTrait` instead of
  // excluded.
  //
  // Of the remaining 55 genuine candidates, 49 landed in the table (research done in parallel via one
  // agent per profession, each fetching raw wikitext directly, same methodology as every prior sweep).
  // 5 stayed uncurated after investigation; re-checked fresh 2026-08-22 (see TODO.md's
  // "Coefficient curation — remaining exceptions" leftovers sweep) — no change on any of the 4 that
  // were re-investigated (Ranger 31889 wasn't re-checked this pass). Of those, **Elementalist 72982
  // (Etching: Jökulhlaup, Spear) is now RESOLVED (2026-08-23)**, and **Necromancer 30860 (Death
  // Spiral) is now RESOLVED too (2026-08-23)** — its wiki-stub `{{stub||missing siphon coefficients}}`
  // block turned out fully solvable via 2 live in-game WvW readings alone, no wiki involvement needed
  // (see this skill's own entry below, and `CURATED_SIPHON_DAMAGE_COEFFICIENTS`'s top comment for the
  // sibling Life Siphon Damage fact this same pass also resolved); 3 remain open:
  // - **Necromancer 69302 (Life Siphon)**: wiki documents coefficients (0.082 PvE / 0.036 WvW+PvP)
  //   paired with base values (450 PvE / 300 WvW+PvP) that don't match this app's API-sourced values
  //   (537 / 238) under either mode ordering — still unresolved despite 2 live WvW readings taken
  //   2026-08-23 (Pulse Heal 238 -> 249 across Power 2,678 -> 2,786 with **Healing Power confirmed 0
  //   in both**), because that pairing is the opposite of what this fact needs: with Healing Power
  //   fixed at 0, its `target: 'Healing'` value should have stayed flat if the API's own labeling is
  //   right, but it moved with Power instead — suggesting `Pulse Heal` may be another Barrier-style
  //   API target mislabeling (genuinely Power-scaled, not Healing-Power-scaled) rather than confirming
  //   either existing base. Left uncurated rather than guess the formula shape; a reading with
  //   deliberately-varied Healing Power (Power held fixed) would settle it.
  // - **Ranger 31889 (Astral Wisp, Druid Staff, post-2026-07-15 rework)**: wiki's rewritten page gives
  //   one base value (1288) shared across all modes with only the coefficient split (0.6 pve/pvp vs 0.9
  //   wvw), but the API shows two duplicate-text facts both valued 322 — roughly a quarter of 1288,
  //   suggesting a pulse-count relationship neither source documents post-rework. Left uncurated rather
  //   than guessing which coefficient pairs with which quartering.
  // - **Thief 72991 (Shadow Veil, Spear)**: two facts share the identical factText "Healing" (2570 and
  //   1290) — the wiki still documents a coefficient for only one of them (1290 -> 0.5), and since
  //   this table matches facts by factText alone, an entry here would bind to whichever fact
  //   `Array.find` returns first (2570, listed first in both the API and this app's own facts array),
  //   not reliably the one the coefficient was verified against. The wiki page declares `split = pve,
  //   wvw pvp` but gives only one mode-agnostic skill fact template, so whether 2570 is the undocumented
  //   PvE half of the same split or an unrelated quantity (e.g. a multi-block total, given "Additional
  //   Blocks: 2" is also on this skill) still can't be determined. Left entirely uncurated rather than
  //   risk mislabeling.
  // Elementalist — Water Trident. Both facts keep the same base value across modes but the coefficient
  // splits (PvE 1.0/0.1 vs WvW 0.7/0.1) — WvW coefficients used.
  5510: [
    { factText: 'First-Hit Healing', baseValue: 1099, coefficient: 0.7 },
    { factText: 'Additional-Hit Healing', baseValue: 550, coefficient: 0.1 }
  ],
  // Elementalist — Cone of Cold. Wiki documents one 4-pulse-total fact per mode (PvE 1888/1.2, WvW/PvP
  // 1416/0.8); divided by 4 to match this app's per-pulse API facts (472 PvE, 354 WvW/PvP, both exact)
  // — WvW per-pulse value used.
  5537: [{ factText: 'Healing', baseValue: 354, coefficient: 0.2 }],
  // Elementalist — Water Blast. PvE/WvW coefficient split (PvE 0.25 vs WvW 0.15, same 372 base) — WvW
  // value used.
  5549: [{ factText: 'Healing', baseValue: 223, coefficient: 0.15 }],
  // Elementalist — Healing Rain (Staff 5). No PvE/WvW split.
  5551: [{ factText: 'Heal per Condition', baseValue: 427, coefficient: 0.1 }],
  // Elementalist — Cleansing Wave. No PvE/WvW split (unified since a 2024-10-08 patch); wiki's 2222 vs
  // this app's API 2220 is a negligible 2-point rounding difference, not a real conflict.
  5558: [{ factText: 'Healing', baseValue: 2220, coefficient: 1.0 }],
  // Elementalist — Tidal Wave. No PvE/WvW split.
  5607: [{ factText: 'Healing', baseValue: 325, coefficient: 0.1 }],
  // Elementalist — Geyser. Wiki documents one 5-pulse-total fact per mode (PvE 2760/2.0, WvW/PvP
  // 2205/1.25); divided by 5 to match this app's per-pulse API fact (552, exact) — WvW per-pulse value
  // used.
  5681: [{ factText: 'Healing', baseValue: 441, coefficient: 0.25 }],
  // Elementalist — Undercurrent (Trident). No PvE/WvW split.
  5748: [{ factText: 'Healing', baseValue: 1940, coefficient: 1.0 }],
  // Elementalist — Water Globe (Warhorn). Base value unchanged across modes but coefficient splits
  // (PvE 0.24 vs WvW 0.125) — WvW value used.
  30446: [{ factText: 'Healing', baseValue: 470, coefficient: 0.125 }],
  // Elementalist — Tidal Surge (Warhorn). No PvE/WvW split on the healing fact (only damage splits).
  30864: [{ factText: 'Healing', baseValue: 1302, coefficient: 0.5 }],
  // Elementalist — Pressure Blast (Catalyst hammer). No PvE/WvW split on either fact.
  40332: [
    { factText: 'Ally Healing', baseValue: 1285, coefficient: 0.5 },
    { factText: 'Self Healing', baseValue: 1285, coefficient: 0.25 }
  ],
  // Elementalist — Seiche (Catalyst hammer). No PvE/WvW split.
  41052: [{ factText: 'Healing', baseValue: 66, coefficient: 0.05 }],
  // Elementalist — Aqua Siphon (Catalyst hammer). No PvE/WvW split.
  41167: [{ factText: 'Healing', baseValue: 2255, coefficient: 0.5 }],
  // Elementalist — Steam Surge (Catalyst hammer). Base value unchanged across modes but coefficient
  // splits (PvE base 427 shown by API) — WvW base 213, same coefficient 0.1 both modes.
  42330: [{ factText: 'Healing', baseValue: 213, coefficient: 0.1 }],
  // Elementalist — Riptide (Weaver dagger). PvE/WvW+PvP split (PvE 216/0.18 vs WvW 120/0.05) — WvW
  // value used. Wiki separately flags an unintended PvP-only scaling bug (coefficient reads 0.5
  // in-game) that explicitly doesn't apply to WvW, so the documented 0.05 stands for WvW.
  44405: [{ factText: 'Healing', baseValue: 120, coefficient: 0.05 }],
  // Elementalist — Crashing Font (Catalyst hammer). Base value splits by mode on both facts (WvW
  // 1580/3159 vs PvE 2330/4659); coefficient is identical across modes for both.
  62948: [
    { factText: 'Lesser Healing', baseValue: 1580, coefficient: 0.225 },
    { factText: 'Greater Healing', baseValue: 3159, coefficient: 0.45 }
  ],
  // Elementalist — Soothing Splash (Spear). No PvE/WvW split.
  72033: [{ factText: 'Healing per Unique Condition', baseValue: 23, coefficient: 0.05 }],
  // Elementalist — Restorative Spear. Wiki explicitly documents `coefficient=0` — a genuine flat heal
  // with no Healing Power scaling, not an undocumented/missing value.
  72966: [{ factText: 'Healing', baseValue: 216, coefficient: 0 }],
  // Elementalist — Ripple (Spear). Base value splits by mode (PvE 2025 vs WvW/PvP 1385), coefficient
  // (0.5) identical across modes.
  72967: [{ factText: 'Healing', baseValue: 1385, coefficient: 0.5 }],
  // Elementalist — Etching: Jökulhlaup (Spear). Wiki's `{{skill fact|healing|532}}` template (no
  // `coefficient=` param) and this app's own API snapshot agree on base 532, but that figure never
  // matched live testing. Resolved 2026-08-23 via 2 in-game tooltip readings at known Healing Power
  // (0 HP -> 340 heal; 1,257 HP -> 466 heal): base=340, coefficient=(466-340)/1257=0.1 (predicts
  // 465.7 -> rounds to the observed 466 — confirms the fit). base=340 flatly contradicts the cached
  // 532 both sources agree on — either a live balance change since that snapshot, or (more likely,
  // given wiki and API never disagreed with each other here) an undiscovered WvW-specific split on
  // this fact that the local data never captured, same shape as the `rechargeSeconds` WvW-override
  // gap `fetch-recharge-wvw-overrides.ts` generalized for Recharge/cooldown facts but never extended
  // to Healing/AttributeAdjust facts. Curating the live-verified WvW value per this table's usual
  // "prefer the WvW-correct number" convention regardless of which explanation is right.
  72982: [{ factText: 'Healing', baseValue: 340, coefficient: 0.1 }],
  // Engineer — Essence of Living Shadows (Spear). Both facts group "pve wvw" together (WvW = PvE
  // here, PvP-only differs) — the API's own values (970/645) already match the WvW-correct number.
  71882: [
    { factText: 'Initial Heal', baseValue: 970, coefficient: 0.45 },
    { factText: 'Pulse Heal', baseValue: 645, coefficient: 0.2 }
  ],
  // Guardian — Leap of Faith (Spear). No PvE/WvW split on either fact.
  9080: [
    { factText: 'First-Hit Healing', baseValue: 1750, coefficient: 0.2 },
    { factText: 'Additional-Hit Healing', baseValue: 750, coefficient: 0.1 }
  ],
  // Guardian — Symbol of Faith (Spear). No PvE/WvW split.
  9111: [{ factText: 'Healing', baseValue: 527, coefficient: 0.5 }],
  // Guardian — Ray of Judgment (Spear). No PvE/WvW split on the healing fact (only damage splits).
  9112: [{ factText: 'Healing', baseValue: 975, coefficient: 0.2 }],
  // Guardian — Holy Strike (Spear). PvE/WvW+PvP split (PvE 221/0.25 vs WvW 177/0.1) — WvW value used.
  9140: [{ factText: 'Healing', baseValue: 177, coefficient: 0.1 }],
  // Guardian — Empower (Spear). No PvE/WvW split on either fact.
  9265: [
    { factText: 'Final Heal', baseValue: 1500, coefficient: 0.5 },
    { factText: 'Heal Pulses', baseValue: 496, coefficient: 0.17 }
  ],
  // Guardian — Helio Rush (Spear). "Illuminated" is a self-buff state (not a trait), so both facts are
  // the base skill's own effects, not a trait-conditional variant. Both split PvE/WvW+PvP by
  // coefficient (base value unchanged) — WvW coefficients used.
  72940: [
    { factText: 'Healing', baseValue: 805, coefficient: 0.4 },
    { factText: 'Illuminated Healing', baseValue: 966, coefficient: 0.48 }
  ],
  // Guardian — Daybreaking Slash (Spear). PvE/WvW+PvP base-value split (PvE 390 vs WvW 198), same
  // 0.06 coefficient both modes — WvW value used.
  73055: [{ factText: 'Healing', baseValue: 198, coefficient: 0.06 }],
  // Guardian — Solar Storm (Spear). No PvE/WvW split.
  73094: [{ factText: 'Healing', baseValue: 966, coefficient: 0.3 }],
  // Mesmer — Friendly Fire (Spear). PvE/WvW+PvP split (PvE 325/0.2 vs WvW 229/0.1) — WvW value used.
  71892: [{ factText: 'Healing', baseValue: 229, coefficient: 0.1 }],
  // Mesmer — Journey (Spear). 3-way split by mode (PvE 1295 / WvW 911 / PvP, separately valued), same
  // 0.67 coefficient across modes — WvW value used.
  71897: [{ factText: 'Healing', baseValue: 911, coefficient: 0.67 }],
  // Mesmer — Imaginary Inversion (Spear). "Empowered Healing" is a distinct wiki-labeled sub-effect
  // (boosted heal while under the Clarity buff), not a trait-gated variant — confirmed no
  // `requires_trait` on either fact. Both split PvE/WvW+PvP by base value, same 0.1 coefficient both.
  73152: [
    { factText: 'Healing', baseValue: 1610, coefficient: 0.1 },
    { factText: 'Empowered Healing', baseValue: 2890, coefficient: 0.1 }
  ],
  // Necromancer — Chillblains (Staff 3). **Curated 2026-08-05** (previously excluded as the
  // Transfusion trap, see this table's Weapon-slot intro comment above) — this skill carries no
  // unconditional Healing fact at all, only one gated behind trait 778 (Transfusion), so it's a
  // `requiresTrait` entry like `CURATED_DAMAGE_COEFFICIENTS`'s Mesmer phantasm-trait fixes rather than
  // a shared-formula duplicate: Transfusion's own wiki page documents this exact fact under its
  // "Chillblains additional effects" bullet (1302/0.5 pve+wvw grouped, matching this app's API value
  // exactly), so it's a genuine per-skill design, not the Assassin's Reward shape (see below).
  10605: [{ factText: 'Healing', baseValue: 1302, coefficient: 0.5, requiresTrait: 778 }],
  // Necromancer/Reaper — Death Spiral (greatsword 3). RESOLVED 2026-08-23 — previously blocked
  // entirely on the wiki's own `{{stub||missing siphon coefficients}}` tag (no coefficient documented
  // for either fact); solved directly from 2 live in-game WvW readings (0 Healing Power -> 1764/294;
  // 215 Healing Power -> 1807/301), no wiki involvement needed. `First-Hit Life Siphon Healing`'s
  // coefficient (0.2) is clean; `Additional-Hit Healing`'s (~0.033, exact value 7/215) has lower
  // precision — the 215-point Healing Power range tested only pins it down to roughly ±10% — a wider
  // range reading would tighten it if ever needed. This skill's sibling `Life Siphon Damage` fact is
  // now curated too, see `CURATED_SIPHON_DAMAGE_COEFFICIENTS`.
  30860: [
    { factText: 'First-Hit Life Siphon Healing', baseValue: 1764, coefficient: 0.2 },
    { factText: 'Additional-Hit Healing', baseValue: 294, coefficient: 0.033 }
  ],
  // Necromancer — Locust Swarm. 4 API facts: an untraited PvE/WvW+PvP pair (37/55, same 0.08
  // coefficient) plus a second pair gated behind trait 799 (Banshee's Wail) at 55/83 — only the
  // untraited baseline is curated here, same reasoning as Signet of Courage's traited variant below;
  // the trait bonus isn't reflected. WvW value of the untraited pair used.
  10557: [{ factText: 'Life Siphon Healing', baseValue: 55, coefficient: 0.08 }],
  // Necromancer — Deadly Feast. No PvE/WvW split. factText fixed 2026-08-12 (found by the Tier 2
  // golden-snapshot build): live API labels this skill's fact plain "Healing", not "Life Siphon
  // Healing" like its Life-Siphon-family siblings — was silently never matching, value unchanged.
  10619: [{ factText: 'Healing', baseValue: 69, coefficient: 0.1 }],
  // Necromancer — Soul Grasp. PvE/WvW+PvP base-value split (PvE 1003 vs WvW 440), same 0.2
  // coefficient both modes — WvW value used.
  55050: [{ factText: 'Life Siphon Healing', baseValue: 440, coefficient: 0.2 }],
  // Necromancer — Path of Gluttony (Spear). No PvE/WvW split on either fact.
  71799: [
    { factText: 'First-Hit Healing', baseValue: 2410, coefficient: 0.4 },
    { factText: 'Additional-Hit Healing', baseValue: 410, coefficient: 0.1 }
  ],
  // Necromancer — Hungering Maelstrom (Spear). First-Hit Healing groups "pve wvw" together (vs a
  // lower PvP-only value) — the grouped value matches this app's own API value directly.
  // Additional-Hit Healing has no split.
  71813: [
    { factText: 'First-Hit Healing', baseValue: 1764, coefficient: 0.2 },
    { factText: 'Additional-Hit Healing', baseValue: 294, coefficient: 0.034 }
  ],
  // Necromancer — Enervation Blade (Spear). No PvE/WvW split on either fact.
  71986: [
    { factText: 'First-Hit Healing', baseValue: 202, coefficient: 0.05 },
    { factText: 'Additional-Hit Healing', baseValue: 40, coefficient: 0.01 }
  ],
  // Ranger — Sublime Conversion (Druid Staff). No PvE/WvW split.
  31496: [{ factText: 'Healing', baseValue: 162, coefficient: 0.025 }],
  // Ranger — Ancestral Grace (Druid Staff). Base value unchanged across modes but coefficient splits
  // (PvE 1.0 vs WvW 1.5) — WvW value used.
  31535: [{ factText: 'Healing', baseValue: 1450, coefficient: 1.5 }],
  // Ranger — Solar Beam (Druid Staff). PvE/WvW+PvP base-value split (PvE 66 vs WvW 30), same 0.03
  // coefficient both modes — WvW value used.
  31710: [{ factText: 'Healing', baseValue: 30, coefficient: 0.03 }],
  // Ranger — Astral Wisp (Druid Staff, post-rework). Re-investigated 2026-08-13 (was left uncurated
  // as an unconfirmed "wiki gives one base value across modes, API shows two duplicate-text facts at
  // ~1/4 each" mismatch): resolved — same per-pulse-vs-total shape as Mitotic State above. The wiki
  // documents ONE total value per mode (1288, coefficient 0.6 pve/pvp vs 0.9 wvw) across the skill's
  // now-4 pulses (an undocumented wiki patch note confirms "Number of pulses reduced to 4"), and
  // 1288 / 4 = 322 exactly, matching the API's two (of what should be four) identical 322 raw facts.
  // Curated with the wiki's own total per this table's usual convention — `.find()` binds to
  // whichever of the two identical-text API facts comes first, which is safe here since both raw
  // facts share the exact same value (unlike Thief's Shadow Veil below, where the two API facts
  // differ and only one has a documented coefficient — left uncurated for that reason). WvW value
  // used per convention.
  31889: [{ factText: 'Healing', baseValue: 1288, coefficient: 0.9 }],
  // Ranger — Flourish (Spear). "wvw pvp" grouped coefficient split from PvE (PvE 509/0.5 vs WvW+PvP
  // 410/0.25) — WvW value used.
  71999: [{ factText: 'Healing', baseValue: 410, coefficient: 0.25 }],
  // Revenant — Crystal Hibernation (Herald, Legendary Dragon Stance). PvE/WvW+PvP split confirmed by
  // version history as a competitive-mode balance pass (620/0.5 pve vs 496/0.125 wvw+pvp) — WvW value
  // used.
  28262: [{ factText: 'Healing', baseValue: 496, coefficient: 0.125 }],
  // Revenant — Mender's Rebuke (Legendary Dwarf Stance, Jalis). No PvE/WvW split on the healing fact.
  29145: [{ factText: 'Healing', baseValue: 650, coefficient: 0.2 }],
  // Revenant — Renewing Wave (Legendary Assassin Stance, Shiro). No PvE/WvW split.
  29321: [{ factText: 'Healing', baseValue: 1295, coefficient: 0.65 }],
  // Revenant — Envoy of Exuberance (Herald facet). Coefficient (1.0) identical across modes; only
  // base value splits (PvE 1620 vs WvW+PvP 1215) — WvW value used.
  29386: [{ factText: 'Healing', baseValue: 1215, coefficient: 1.0 }],
  // Revenant — Reckoning Blast (underwater trident skill 4, condition-per-active-legend). No PvE/WvW
  // split.
  50410: [{ factText: 'Healing', baseValue: 1428, coefficient: 0.8 }],
  // --- Thief — Assassin's Reward (Deadly Arts trait 1238) weapon-skill healing, resolved 2026-08-13
  // (see this table's Weapon-slot intro comment above for the original "shared trait formula,
  // deferred, needs initiative-cost data this app doesn't model" write-up). Turns out no new data
  // modeling was actually needed — the blocker was about *this app's own* stored data, not the GW2
  // API, which does expose per-skill initiative cost (`skill.initiative`, confirmed live). The
  // trait's own wiki page gives a flat, unconditional per-point rate (`{{skill fact|healing|151|
  // coefficient=0.085}}`, no PvE/WvW split) — "Heal yourself for each point of initiative spent" —
  // so each entry below is just `baseValue = 151 * N` / `coefficient = 0.085 * N`, N being that
  // skill's own wiki-documented initiative cost, cross-checked against the live API 2026-08-13.
  // Of the 45 candidate skills the original sweep found:
  // - 22 (below) carry exactly one `requires_trait: 1238` Healing fact — safely bindable, curated
  //   with that fact's own live value as baseValue.
  // - 6 more (below, "Spear/UW weapon quirk") are also single-fact/safely bindable, but their live
  //   API value is baked at the OLD 102/point rate (pre-2023-06-27) instead of the current 151 —
  //   confirmed via direct live-API pulls, not a stale local snapshot: e.g. Shadow Assault (13068)
  //   shows `initiative: 5` (current, matches the wiki) but a Healing fact of 509 (=102*5, minus the
  //   usual ±1 rounding seen throughout this table — not 151*5=755). Every Spear-weapon skill with
  //   this trait shows the same pattern; every non-Spear skill doesn't — a genuine, still-live
  //   ArenaNet data inconsistency isolated to that one weapon type, not a guess. baseValue below is
  //   the raw (buggy) live value, reproducing exactly what today's tooltip shows; coefficient still
  //   uses the trait's real 0.085 rate, since N itself is unambiguous here (it matches both the
  //   wiki's current cost and the buggy value's own implied N — only the flat-rate constant is
  //   stale, not N).
  // - 14 stayed EXCLUDED: each carries 2-3 duplicate `Healing`+`requires_trait:1238` facts (a real
  //   PvE/WvW/PvP initiative-cost split materialized as separate facts, live-API-verified) sharing
  //   the identical factText — the same `Array.find`-binds-to-array-order trap already documented
  //   for Thief's Shadow Veil above, and this table has no way to disambiguate two facts sharing
  //   both the same factText AND the same requiresTrait. Death Blossom (13006), Larcenous Strike
  //   (13007), Unload (13011), Choking Gas (13024, a 3-way split), Infiltrator's Arrow (13025),
  //   Shadow Shot (13040), Disabling Shot (13083), Debilitating Arc/Helmet Breaker (30520/71802, a
  //   flip-skill pair sharing both duplicate sets), Vault (30597), Twilight Combo (63254), Harrowing
  //   Storm (71864), Recall Axes (71895), Orchestrated Assault (71965).
  // - 3 more stayed excluded for other reasons: Black Powder (13113) only exposes its PvE/PvP-
  //   grouped value (907, cost 6) as a fact — the wiki documents a separate WvW-only cost (7) with
  //   no directly-sourced number to pair it with, so it's left out rather than self-computing one
  //   (this table only ever uses wiki/API-sourced numbers, never a formula-derived guess). Measured
  //   Shot (63267) and Repeater (13111, the non-dual-wield id) each show a live Healing fact baked
  //   at an OLDER, pre-balance-patch initiative cost than their current live `initiative` field
  //   (e.g. Measured Shot: `initiative: 4` current, but Healing fact = 453 = 151*3, its pre-
  //   2025-06-24 cost) — unlike the Spear group, here it's N itself (not just the rate) that's
  //   stale, and there's no way to know whether the trait's HP-scaling coefficient applies at the
  //   stale or the current N without live-testing; left uncurated rather than guessing.
  13008: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Bola Shot
  13010: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Shadow Strike
  13012: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Head Shot
  13015: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Infiltrator's Strike
  13016: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Flanking Strike
  13019: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Dancing Dagger
  13041: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Cluster Bomb
  13073: [{ factText: 'Healing', baseValue: 756, coefficient: 0.425, requiresTrait: 1238 }], // Deluge
  13074: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Escape
  13075: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Crippling Shot
  13076: [{ factText: 'Healing', baseValue: 756, coefficient: 0.425, requiresTrait: 1238 }], // Ink Shot
  13097: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Heartseeker
  13110: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Twisting Fangs
  13112: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Stab
  13128: [{ factText: 'Healing', baseValue: 302, coefficient: 0.17, requiresTrait: 1238 }], // Infiltrator's Return (pve+wvw grouped value — this skill's split groups wvw with pve, not pvp)
  16432: [{ factText: 'Healing', baseValue: 756, coefficient: 0.425, requiresTrait: 1238 }], // Cloak and Dagger
  29911: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Weakening Whirl
  30775: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Dust Strike
  59526: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Repeater (dagger dual-wield variant) — bakes the gross pre-refund cost (3), not the net 2 the Repeater effect actually charges
  63128: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Endless Night
  63154: [{ factText: 'Healing', baseValue: 604, coefficient: 0.34, requiresTrait: 1238 }], // Triple Threat
  71852: [{ factText: 'Healing', baseValue: 453, coefficient: 0.255, requiresTrait: 1238 }], // Venomous Volley
  // Spear/UW weapon quirk group (see comment above) — baseValue baked at the old 102/point rate.
  13068: [{ factText: 'Healing', baseValue: 509, coefficient: 0.425, requiresTrait: 1238 }], // Shadow Assault
  13069: [{ factText: 'Healing', baseValue: 306, coefficient: 0.255, requiresTrait: 1238 }], // Flanking Dive
  13070: [{ factText: 'Healing', baseValue: 407, coefficient: 0.34, requiresTrait: 1238 }], // Tow Line
  13122: [{ factText: 'Healing', baseValue: 509, coefficient: 0.425, requiresTrait: 1238 }], // Nine-Tailed Strike
  13130: [{ factText: 'Healing', baseValue: 204, coefficient: 0.17, requiresTrait: 1238 }], // Break Stance
  50379: [{ factText: 'Healing', baseValue: 306, coefficient: 0.255, requiresTrait: 1238 }], // Hooked Spear
  // Warrior — Line Breaker (Spear). 3-way split by mode (PvE 3240/2.25, WvW 2203/1.25, PvP separately
  // valued) — WvW value used.
  71860: [{ factText: 'Healing', baseValue: 2203, coefficient: 1.25 }],
  // Warrior — Defiant Roar (Spear). 3-way split by mode (PvE 5180/2.5, WvW 1940/1.1, PvP separately
  // valued) — WvW value used.
  71889: [{ factText: 'Healing', baseValue: 1940, coefficient: 1.1 }],
  // Warrior — Valiant Leap (Spear). 3-way split by mode (PvE 1295/1.0, WvW 975/0.5, PvP separately
  // valued) — WvW value used.
  72002: [{ factText: 'Healing', baseValue: 975, coefficient: 0.5 }],
  // Revenant — Energy Expulsion, the LIVE/canonical id (27356, referenced by legends.json's
  // Legend6 `elite` — confirmed via docs/game-data.md's "Revenant legends" section this is the id
  // `RevenantSkillsEditor` actually displays; 29114 below is a same-named orphan id, structurally
  // unreachable in this app). Unlike 29114, this id carries ZERO real API Healing fact at all (a
  // straightforward empty-facts gap, not a mismatch), so the wiki's stated value is used directly
  // per the usual synthetic-facts.json Case 1 pattern — see there for the matching Buff/Number
  // facts (Knockdown, Conditions Removed) added alongside this. 3-way split (PvE 1970/1.0, WvW+PvP
  // 1478/0.5) — WvW value used, same convention as every other split entry in this table.
  // Rapid Flow (Invocation trait 1760) entry added 2026-08-12, same trait-granted-boons-on-skills
  // curation as the block below this table — kept alongside this skill's own unrelated Healing
  // entry rather than duplicated there.
  27356: [
    { factText: 'Healing', baseValue: 1478, coefficient: 0.5 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Natural Harmony, the LIVE/canonical id (27025, Legend6 `utilities[1]`) — its orphan
  // sibling 29082 (structurally unreachable, see the Protective Solace/Jade Winds writeup in
  // docs/game-data.md) carries a real Healing fact whose OWN live API value (1620 base) disagrees
  // with the current wiki text (1124 base) — user-verified 2026-08-12 against the live wiki page
  // (base unchanged across every dated Version History entry back to 2015; only the coefficient has
  // ever moved) that 1124 is correct, siding with the wiki over 29082's API value per this app's
  // standing convention (wiki is hand-updated same-day for balance patches; a structurally-orphaned
  // API id has no in-game path forcing ArenaNet to keep it in sync, unlike the live 27025 id used
  // here). 3-way split (PvE 2.75, WvW 1.75, PvP 1.0, same 1124 base in all 3) — WvW value used.
  27025: [
    { factText: 'Healing', baseValue: 1124, coefficient: 1.75 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Purifying Essence, the LIVE/canonical id (27715, Legend6 `utilities[2]`) — its own
  // orphan sibling 29197 (above, in the Heal/Utility section) already carries this exact same
  // Healing fact for real; 27715 doesn't, so the same value is mirrored here via a
  // synthetic-facts.json Case 1 entry. No PvE/WvW split (wiki's `{{skill fact|healing|...}}`
  // template for this skill carries no `game mode=` tag at all, matching 29197's own comment above).
  27715: [
    { factText: 'Healing per Condition Removed', baseValue: 325, coefficient: 0.2 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  // Revenant — Breakrazor's Bastion, Legendary Renegade Stance's heal skill (45686 base, 72389 its
  // "Band Together"-enhanced flip target — see revenant-flip-duplicates.ts's doc comment; this was
  // the one sibling in that family the 2026-08-12 Renegade sweep left uncurated, closed here
  // 2026-08-13). Unlike its 3 Legend5 siblings (Darkrazor's Daring/Razorclaw's Rage/Icerazor's Ire),
  // this skill carries real Healing facts, not just Buff ones — API returns ZERO facts of any kind
  // on either id, so all values are wiki-sourced per the usual synthetic-facts.json Case 1 pattern.
  // 3 Healing sub-facts, each with its own PvE/WvW/PvP split (Initial Self Heal 4529/1.3 pve vs
  // 4529/0.8 wvw vs 3397/0.8 pvp; Heal Pulses 615/1.0 pve vs 373/0.3 wvw vs 325/0.1 pvp; Final Heal
  // 1845/3.0 pve vs 1845/1.5 wvw vs 1605/0.5 pvp) — WvW values used throughout, same convention as
  // every other split entry in this table. Per the wiki's own Notes, healing (and the Resolution
  // buff facts, curated as plain Buff facts alongside these, no coefficient) apply on EVERY cast,
  // base or enhanced — hence identical Healing entries on both ids, mirroring how the sibling trio's
  // own shared action facts (Stability/Daze/Bonus Defiance Break) are likewise repeated on their own
  // enhanced ids. Only Barrier (2440/0.5, no mode split) is enhance-only, curated in
  // CURATED_BARRIER_COEFFICIENTS on 72389 alone. Might/Swiftness/Rapid Flow Healing are deliberately
  // NOT repeated on 72389, matching the sibling trio's own precedent (avoids double-counting a
  // trait proc that fires once per skill-use event regardless of which cast variant triggers it).
  45686: [
    { factText: 'Initial Self Heal', baseValue: 4529, coefficient: 0.8 },
    { factText: 'Heal Pulses', baseValue: 373, coefficient: 0.3 },
    { factText: 'Final Heal', baseValue: 1845, coefficient: 1.5 },
    { factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }
  ],
  72389: [
    { factText: 'Initial Self Heal', baseValue: 4529, coefficient: 0.8 },
    { factText: 'Heal Pulses', baseValue: 373, coefficient: 0.3 },
    { factText: 'Final Heal', baseValue: 1845, coefficient: 1.5 }
  ],
  // Revenant — Energy Expulsion, the ORPHAN id (29114, a same-named sibling of the live 27356
  // above — see that entry's comment). Deliberately left uncurated, now CONFIRMED (not just
  // suspected) stale: its "Healing Fragment"/"Number of Fragments"/"Knockback" fact set is the
  // skill's pre-2022-06-28 design — the wiki's own Version History for Energy Expulsion states
  // that patch "no longer creates healing fragments and instead heals and removes conditions from
  // allies in the area... now knocks down enemies that it strikes instead of knocking them back,"
  // which is exactly the current mechanic curated on 27356 above (user-verified 2026-08-12, who
  // also confirmed the game's real "When Empowered" behavior matches the wiki: +3-stack Stability,
  // 5s PvE/PvP -> 3s WvW-only per a 2024-03-19 patch — not curated here, a state-conditional
  // proc-gated bonus only the skill cast right after a legend-swap/Project Tranquility gets, same
  // "misrepresents every cast" reason every other "When Empowered" bonus in this legend is left
  // out). 29114 itself is moot either way — structurally unreachable in this app, so even accurate
  // data here would be dead weight (same shape as Jade Winds' harmless-dead-data orphan, see
  // docs/game-data.md's Protective Solace/Jade Winds writeup).

  // Rapid Flow (Revenant/Invocation trait 1760, trait-granted-boons-on-skills curation
  // 2026-08-12, TODO.md): "Heal yourself and gain swiftness when you use a skill that has an
  // energy cost" — every legend's heal/utility/elite skill costs Energy by design, so each gets
  // its own copy of the trait's Healing fact (`requires_trait: 1760`, matching synthetic-facts.json)
  // so the skill's own tooltip shows the real, healing-power-scaled number instead of the generic
  // "Healing (base): 500" placeholder `numericFactLines` would otherwise show. `factText:
  // 'Rapid Flow Healing'` is a made-up label distinct from a plain "Healing" fact text on purpose —
  // `skillFactLines`' `healingByLabel` lookup is keyed by fact text alone (not also by
  // `requiresTrait`), so reusing the generic "Healing" text on a skill that ALSO has its own
  // unconditional "Healing" fact (27025, 27356 above) would collapse the two into one shown value
  // instead of two distinct lines. Wiki: `{{skill fact|healing|500|coefficient=0.05|game
  // mode=pve}}{{skill fact|healing|333|coefficient=0.05|game mode=pvp wvw}}` — WvW value (333) used
  // per this table's usual convention; the `value: 500` baked into the synthetic Fact itself is the
  // PvE/reference-build number, matching how the live API's own trait-1760 fact reports it (matched
  // by presence only, not by re-checking `value` against `baseValue` — see this file's own top
  // comment). Shackling Wave (28472, a Sword weapon skill) is the one wiki-documented exception:
  // "Updated this trait to allow Shackling Wave to heal the revenant" (2017-12-13 patch note) even
  // though it's not a legend skill and the live API exposes no Energy Cost fact for it either (a
  // separate, unrelated empty-facts gap — not curated here since nothing in this app displays a
  // Revenant Energy resource bar).
  27220: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Facet of Light
  28379: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Facet of Darkness
  27014: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Facet of Elements
  26644: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Facet of Strength
  27760: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Facet of Chaos
  29209: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Riposting Shadows
  28231: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Phase Traversal
  27107: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Impossible Odds
  28406: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Jade Winds
  28516: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Inspiring Reinforcement
  26679: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Forced Engagement
  27975: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Rite of the Great Dwarf
  27322: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Pain Absorption
  27505: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Banish Enchantment
  27917: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Call to Anguish
  28287: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Embrace the Darkness
  42949: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Razorclaw's Rage
  40485: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Icerazor's Ire
  41220: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Darkrazor's Daring
  28427: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Ventari's Will
  26821: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Protective Solace
  62832: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Nomad's Advance
  62962: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Scavenger Burst
  62878: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Reaver's Rage
  62942: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Spear of Archemorus
  62702: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Battle Dance
  62796: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Awakening
  77243: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Hex-Eater Vortex
  77291: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Gladiator's Defense
  76805: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Beguiling Haze
  76968: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Twin Moon Sweep
  28472: [{ factText: 'Rapid Flow Healing', baseValue: 333, coefficient: 0.05, requiresTrait: 1760 }], // Shackling Wave (Sword weapon skill)

  // Dragon Slash—Boost (River's Flow, 80228, Bladesworn) — Bladesworn's support-branch reflavor of
  // its Boost burst; the only one of the 6 Sharp as the Wind/River's Flow variant ids with a real
  // Healing fact (see `dragon-slash-skills.ts`'s doc comment for the full writeup). No PvE/WvW+PvP
  // split on the wiki, used as-is — Minimum = ending the channel at the lowest charge level,
  // Maximum = at full charge (same shape as the base skill's own Minimum/Maximum Damage pair).
  80228: [
    { factText: 'Minimum Healing', baseValue: 3215, coefficient: 0.8 },
    { factText: 'Maximum Healing', baseValue: 6558, coefficient: 1.63 }
  ]
}

export interface HealingLine {
  label: string
  value: number
}

/**
 * Real, current-build-scaled healing lines for one skill — `Heal = baseValue + coefficient *
 * healingPower` per curated entry, gated the same `requires_trait` way as `numericFactLines`
 * (only counts a trait-conditional fact once that trait is actually chosen). Returns `[]` for any
 * skill with no curated entry (the vast majority, until this table grows) rather than falling back
 * to an unscaled/wrong number.
 */
export function healingLinesForSkill(skill: Skill, healingPower: number, activeIds: ReadonlySet<number>): HealingLine[] {
  const entries = CURATED_HEALING_COEFFICIENTS[skill.id]
  if (!entries) return []

  const allFacts: Fact[] = [...skill.facts, ...skill.traitedFacts]
  const lines: HealingLine[] = []
  for (const entry of entries) {
    const fact = allFacts.find(
      (f) =>
        f.type === 'AttributeAdjust' &&
        f.target === 'Healing' &&
        f.text === entry.factText &&
        (f.requires_trait ?? null) === (entry.requiresTrait ?? null)
    )
    if (!fact) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    lines.push({ label: entry.factText, value: Math.round(entry.baseValue + entry.coefficient * healingPower) })
  }
  return lines
}
