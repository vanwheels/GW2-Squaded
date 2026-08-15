import type { FactLine } from './fact-numbers'
import type { BoonConditionSource } from '../boon-calc/sources'
import type { Relic, RelicEffectsById } from '../types'
import { WEAPON_STRENGTH_MIDPOINTS } from './damage-calc'
import { formatRelicDescription } from '../gear-calc/relic-effects-format'

// Icons quoted straight off each mechanic's own live API fact (Death Drop 62693/Imperial Impact
// 62859/Saint's Shield 62689's own `facts` arrays, fetched 2026-08-15) rather than invented —
// Damage/Radius/Targets share one icon each across all 3, Healing/Barrier come from Saint's Shield's
// own 2 AttributeAdjust facts.
const DAMAGE_ICON = 'https://render.guildwars2.com/file/61AA4919C4A7990903241B680A69530121E994C7/156657.png'
const RADIUS_ICON = 'https://render.guildwars2.com/file/B0CD8077991E4FB1622D2930337ED7F9B54211D5/156665.png'
const TARGETS_ICON = 'https://render.guildwars2.com/file/BBE8191A494B0352259C10EADFDACCE177E6DA5B/1770208.png'
const HEALING_ICON = 'https://render.guildwars2.com/file/D4347C52157B040943051D7E09DEAD7AF63D4378/156662.png'
const BARRIER_ICON = 'https://render.guildwars2.com/file/357922487919E8E84B914EAC13D5796DDDC42D14/1770209.png'

const TENACIOUS_RUIN_ID = 2262
const TENACIOUS_RUIN_ICON = 'https://render.guildwars2.com/file/1F450E36D1969A3B0F9E09B070A1E5A73C5B3133/2491540.png'
const FORERUNNER_OF_DEATH_ID = 2257
const FORERUNNER_OF_DEATH_ICON = 'https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png'
const VASSALS_OF_THE_EMPIRE_ID = 2232
const VASSALS_OF_THE_EMPIRE_ICON = 'https://render.guildwars2.com/file/955F334FAA12550A15127A6200CB7BDE4D41BD0A/2491538.png'
const SAINT_OF_ZU_HELTZER_ID = 2238
const SAINT_OF_ZU_HELTZER_ICON = 'https://render.guildwars2.com/file/42D514BF15A3F84ECECBACC7E05F95CAE03EBF6D/2491539.png'

const LOTUS_TRAINING_ID = 1833
const LOTUS_TRAINING_ICON = 'https://render.guildwars2.com/file/E5724D46CEE62333E00CE26905C5FDD5439F6667/1058552.png'
const UNHINDERED_COMBATANT_ID = 1964
const UNHINDERED_COMBATANT_ICON = 'https://render.guildwars2.com/file/0D7324A22F580F3DA3F244C466770FB69292C307/1058553.png'
const BOUNDING_DODGER_ID = 2047
const BOUNDING_DODGER_ICON = 'https://render.guildwars2.com/file/F3E22D0FDFDB436780BD4ACBA5D135EE40507FFD/1058554.png'

/**
 * TODO.md's dodge-roll item, Problem 2 ("whole dodge-replacement mechanics have no skill id to hang
 * a tooltip off of"): the content the small dodge indicator (`DodgeIndicator.tsx`) renders — unlike
 * `branchConditionalFacts`, keyed by which TRAITS are active rather than a skill id, since none of
 * this has one. Scoped to Vindicator + Daredevil only (2026-08-15) — Mirage Cloak itself grants no
 * quantifiable facts beyond unlocking Ambush skills (a separate, much larger per-weapon feature of
 * its own), and its few boon-granting modifier traits (Renewing Oasis etc.) are already labeled via
 * `DODGE_TRIGGER_NOTES` instead, so a near-empty Mirage entry wasn't worth the UI surface.
 *
 * `facts` below are DISPLAY-ONLY — passed straight to `factsBlock` for their icon/name/duration
 * formatting, never registered with `computeBoonConditionSources`. Vulnerability (Forerunner of
 * Death) and Might/Protection (Vassals of the Empire) already reach the aggregate Boon/Condition
 * panel correctly via `synthetic-trait-facts.json` + `DODGE_TRIGGER_NOTES` (Sessions 204/205) — this
 * component repeats them purely so a player can see "everything my dodge does" in one place without
 * separately double-counting them into any total.
 *
 * `relicDodgeContent` below (Problem 3, "relics can grant dodge-triggered effects too") is the same
 * DISPLAY-ONLY idea applied to relics rather than traits — see its own doc comment for why it's
 * deliberately never registered with `computeBoonConditionSources` either, and why that's actually
 * correct rather than a leftover gap.
 */
export interface DodgeReplacementContent {
  icon: string
  name: string
  description: string
  numericLines: FactLine[]
  facts: BoonConditionSource[]
}

/**
 * Vindicator's dodge (Tenacious Ruin, minor trait 2262 — always active once the spec line is
 * equipped, `activeTraitIds` already includes every equipped line's minor traits unconditionally):
 * "Instead of dodging, deliver a powerful blow from above, striking foes when you hit the ground."
 * Reskinned further by whichever of the 3 mutually-exclusive Grandmasters (2257/2232/2238) is chosen,
 * if any — GW2's own trait system guarantees at most one of the 3 is ever active at once (same tier).
 *
 * Damage numbers use this app's standard `weaponStrength * coefficient * power / targetArmor`
 * formula (`damage-calc.ts`) with `weapon: 'unequipped'` (690.5, the wiki's own `weapon=trait skill`
 * midpoint) — NOT threaded through `CURATED_DAMAGE_COEFFICIENTS` itself, since that table's own doc
 * comment scopes it to skills a `damageLinesForSkill(skill, ...)` call can look up by a real `Skill`
 * object's `facts`, and Death Drop/Imperial Impact/Saint's Shield only exist as bare ids with no
 * profession-mechanic-bar or skill-bar slot to hang a `Skill` lookup off of here.
 *
 * All 3 GM coefficients/values are the wiki's own WvW figure (this app's usual convention), fetched
 * fresh via raw wikitext 2026-08-15:
 * - Forerunner of Death → Death Drop (62693): PvE 3.3/WvW 2.22/PvP 0.75 coefficient, radius shrinks
 *   180 (from Tenacious Ruin's own unmodified 240), Vulnerability 10s×5 (already curated separately,
 *   see `TARGET_COUNT_OVERRIDES.trait`'s "2257" entry: 5 foes), self "Forerunner of Death" +15%
 *   Damage (WvW; PvE +25%) for 10s — this self-buff is a non-`BOON_NAMES` custom status with no
 *   tracked consumer (same bucket as Daredevil's 3 traits below), shown as a plain text line.
 * - Vassals of the Empire → Imperial Impact (62859): PvE 2.0/WvW 0.625/PvP 0.5 coefficient (the API's
 *   3 "duplicate" Damage facts are actually 3 different game-modes' single value, not 3 real hits —
 *   same pattern this app's WvW-first convention exists to un-confuse), Might 8s×3/Protection 2s×1
 *   (WvW; both already curated via `synthetic-trait-facts.json`), 5 foes + 5 allies, radius 240
 *   (unchanged from base). Chilled is deliberately DROPPED here — the wiki only tags it
 *   `game mode=pve`, no WvW/PvP line exists at all, same "never show a fact confirmed absent in WvW"
 *   rule Saint of zu Heltzer's reverted Alacrity fix (Session 206) established.
 * - Saint of zu Heltzer → Saint's Shield (62689): replaces Damage with Healing AND Barrier, WvW
 *   `300 + 0.2 × healingPower` each (same `CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`
 *   formula shape, computed inline here for the same reason `chantOfRecuperationSections` does — no
 *   live API fact for either table to attach a coefficient to), radius grows to 300, 5 allies, self
 *   "Saint of zu Heltzer" +20% Healing to Others for 6s (plain text line, same non-tracked-status
 *   reasoning as Forerunner of Death's self-buff above). Alacrity is deliberately EXCLUDED — the
 *   live API fact for it is real (`{{skill fact|alacrity|4|game mode = pve}}`, no WvW/PvP line at
 *   all) but wiki-confirmed PvE-only (Session 206), and `synthetic-trait-facts.json`/
 *   `DODGE_TRIGGER_NOTES.trait` both already correctly omit it for trait 2238 — this indicator must
 *   stay consistent with that, not reopen it.
 */
export function vindicatorDodgeContent(
  activeIds: ReadonlySet<number>,
  power: number,
  healingPower: number,
  targetArmor: number,
  durationPercent: { boon: number; condition: number }
): DodgeReplacementContent | null {
  if (!activeIds.has(TENACIOUS_RUIN_ID)) return null

  const weaponStrength = WEAPON_STRENGTH_MIDPOINTS.unequipped
  const damageLine = (coefficient: number): FactLine => ({
    icon: DAMAGE_ICON,
    text: `Damage: ${Math.round((weaponStrength * coefficient * power) / targetArmor).toLocaleString()}`
  })
  const radiusLine = (distance: number): FactLine => ({ icon: RADIUS_ICON, text: `Radius: ${distance}` })
  const targetsLine = (n: number, label = 'Number of Targets'): FactLine => ({ icon: TARGETS_ICON, text: `${label}: ${n}` })

  if (activeIds.has(FORERUNNER_OF_DEATH_ID)) {
    const vulnerability: BoonConditionSource = {
      sourceKind: 'trait',
      sourceId: FORERUNNER_OF_DEATH_ID,
      sourceName: 'Forerunner of Death',
      sourceIcon: FORERUNNER_OF_DEATH_ICON,
      boonOrConditionName: 'Vulnerability',
      isCondition: true,
      category: 'condition',
      baseDurationSeconds: 10,
      scaledDurationSeconds: 10 * (1 + durationPercent.condition / 100),
      applyCount: 5,
      requiresTraitId: null,
      targetCount: 5
    }
    return {
      icon: FORERUNNER_OF_DEATH_ICON,
      name: 'Death Drop',
      description: 'Dodging now deals more damage but affects a smaller area.',
      numericLines: [damageLine(2.22), radiusLine(180), targetsLine(5), { icon: null, text: 'Forerunner of Death: +15% Damage (10s)' }],
      facts: [vulnerability]
    }
  }
  if (activeIds.has(VASSALS_OF_THE_EMPIRE_ID)) {
    const might: BoonConditionSource = {
      sourceKind: 'trait',
      sourceId: VASSALS_OF_THE_EMPIRE_ID,
      sourceName: 'Vassals of the Empire',
      sourceIcon: VASSALS_OF_THE_EMPIRE_ICON,
      boonOrConditionName: 'Might',
      isCondition: false,
      category: 'boon',
      baseDurationSeconds: 8,
      scaledDurationSeconds: 8 * (1 + durationPercent.boon / 100),
      applyCount: 3,
      requiresTraitId: null,
      targetCount: 5
    }
    const protection: BoonConditionSource = {
      sourceKind: 'trait',
      sourceId: VASSALS_OF_THE_EMPIRE_ID,
      sourceName: 'Vassals of the Empire',
      sourceIcon: VASSALS_OF_THE_EMPIRE_ICON,
      boonOrConditionName: 'Protection',
      isCondition: false,
      category: 'boon',
      baseDurationSeconds: 2,
      scaledDurationSeconds: 2 * (1 + durationPercent.boon / 100),
      applyCount: 1,
      requiresTraitId: null,
      targetCount: 5
    }
    return {
      icon: VASSALS_OF_THE_EMPIRE_ICON,
      name: 'Imperial Impact',
      description: 'Dodging now grants boons to allies and strikes foes when landing.',
      numericLines: [damageLine(0.625), radiusLine(240), targetsLine(5), targetsLine(5, 'Number of Allied Targets')],
      facts: [might, protection]
    }
  }
  if (activeIds.has(SAINT_OF_ZU_HELTZER_ID)) {
    const healAndBarrier = Math.round(300 + 0.2 * healingPower).toLocaleString()
    return {
      icon: SAINT_OF_ZU_HELTZER_ICON,
      name: "Saint's Shield",
      description: 'The affected area of your dodge is increased. You heal allies in an area when you land instead of dealing damage.',
      numericLines: [
        { icon: HEALING_ICON, text: `Healing: ${healAndBarrier}` },
        { icon: BARRIER_ICON, text: `Barrier: ${healAndBarrier}` },
        radiusLine(300),
        targetsLine(5, 'Number of Allied Targets'),
        { icon: null, text: 'Saint of zu Heltzer: +20% Outgoing Healing to Others (6s)' }
      ],
      facts: []
    }
  }
  return {
    icon: TENACIOUS_RUIN_ICON,
    name: 'Tenacious Ruin',
    description: 'Instead of dodging, deliver a powerful blow from above, striking foes when you hit the ground.',
    numericLines: [damageLine(1.0), radiusLine(240), targetsLine(5)],
    facts: []
  }
}

/**
 * Daredevil's 3 mutually-exclusive Grandmaster dodge-replacement traits — unlike Vindicator, nothing
 * here is active by default (Physical Supremacy, the actual always-on minor mechanic, only grants a
 * 3rd endurance bar/Physical skill access, not a dodge reskin), so this returns `null` unless the
 * player has chosen exactly one of the 3. Each grants a custom, non-`BOON_NAMES`-tracked self-buff —
 * confirmed out of `DODGE_TRIGGER_NOTES`' scope entirely (see that table's own doc comment) since
 * there's no tracked boon/condition consumer for any of them — so every number here is a plain text
 * `numericLines` entry, same treatment `strengtheningStanzasBranches` gives Paragon's Chant bonuses.
 * WvW durations (4s) used throughout, wiki-verified via raw wikitext 2026-08-15 — all 3 traits' PvE
 * value is a longer 6s with an identical percentage, a 2025-06-24 patch pattern common to all 3.
 */
export function daredevilDodgeContent(activeIds: ReadonlySet<number>): DodgeReplacementContent | null {
  if (activeIds.has(LOTUS_TRAINING_ID)) {
    return {
      icon: LOTUS_TRAINING_ICON,
      name: 'Impaling Lotus',
      description: 'Your dodge ability now uses Impaling Lotus, firing daggers at nearby enemies.',
      numericLines: [{ icon: null, text: 'Lotus Training: +15% Condition Damage (4s)' }],
      facts: []
    }
  }
  if (activeIds.has(UNHINDERED_COMBATANT_ID)) {
    return {
      icon: UNHINDERED_COMBATANT_ICON,
      name: 'Unhindered Combatant',
      description: 'Your dodge ability is replaced by a long-range dash that removes inhibiting conditions and grants swiftness and damage reduction.',
      numericLines: [
        { icon: null, text: 'Unhindered Combatant: -10% Incoming Damage, -10% Incoming Condition Damage (4s)' },
        {
          icon: null,
          text: 'Removing Chilled/Immobilized this way briefly applies Exhaustion (reduced endurance regen: 2s/4s)'
        }
      ],
      facts: []
    }
  }
  if (activeIds.has(BOUNDING_DODGER_ID)) {
    return {
      icon: BOUNDING_DODGER_ICON,
      name: 'Bound',
      description: 'Your dodge ability is replaced by Bound, dealing damage to the area after you evade.',
      numericLines: [{ icon: null, text: 'Bounding Dodger: +15% Damage (4s)' }],
      facts: []
    }
  }
  return null
}

/**
 * Relic ids whose full effect triggers on dodge rolling or evading an attack — TODO.md's dodge-roll
 * item, Problem 3, curated 2026-08-15 from a full text scan of `data/game-data/relics.json` for
 * "dodge"/"evad" (same terminology-sweep discipline Problem 1's re-checks established). `100614`/
 * `100886` are the same relic (Relic of Evasion) under 2 ids — same "relics.json lists one relic
 * twice" pattern `combat-state.ts`'s `CURATED_RELIC_DAMAGE_BONUSES` already documents for Relic of
 * Fireworks, both included so either equipped id matches.
 *
 * Deliberately EXCLUDES Relic of the Living City (104928/104938, "Titanic Potential"): evading an
 * attack is only 1 of 5 unrelated triggers (healing skill, elite skill, combo field, disabling a
 * foe, evade) that each contribute one stack toward a 5-stack payoff — not a dodge-triggered effect
 * in the sense this indicator means, same "much larger mechanic of its own, out of scope" reasoning
 * `vindicatorDodgeContent`'s doc comment gives for excluding Mirage Cloak/Ambush skills.
 */
const DODGE_RELIC_IDS = new Set([
  99997, // Relic of Isgarren
  100158, // Relic of the Mirage
  100345, // Relic of the Daredevil
  100614, // Relic of Evasion
  100886, // Relic of Evasion (duplicate relics.json id, identical effect)
  101801, // Relic of Mosyn
  103015, // Relic of Rivers
  107030 // Relic of Fog
])

/**
 * The equipped relic's content for the dodge indicator, when it's one of `DODGE_RELIC_IDS` —
 * `null` for every other relic (including no relic equipped at all). Unlike the trait-sourced
 * content above, this reuses `formatRelicDescription` wholesale (description + wiki-sourced facts +
 * recharge, already relied on for the relic's own gear-picker tooltip in `EquipmentEditor.tsx`)
 * rather than hand-building `numericLines`/`facts` — there's no new data to shape, just the same
 * already-curated relic tooltip surfaced here too so a player can see "everything my dodge does" in
 * one place without opening the gear picker.
 *
 * `facts` is always `[]` here, unlike Forerunner of Death/Vassals of the Empire's boon lines above —
 * and deliberately so, not a leftover gap. `RelicEffect`'s own doc comment (`types/game-data.ts`)
 * already documents why relic facts stay out of `computeBoonConditionSources` entirely: a relic
 * fires on a conditional player action with no fixed "you get this every N seconds" guarantee the
 * way an on-cast skill or minor trait does, so aggregating it into an uptime total would mean
 * inventing a usage-frequency assumption this app doesn't model anywhere else. A dodge roll is just
 * as conditional/player-paced as any other relic trigger ("after granting a boon," "upon dealing
 * damage with a 20s+ recharge skill") — nothing about it being dodge-specific changes that. This
 * indicator only ever renders the content, never feeds it into a total.
 */
export function relicDodgeContent(relicId: number | null, relicsById: Map<number, Relic>, relicEffects: RelicEffectsById): DodgeReplacementContent | null {
  if (relicId === null || !DODGE_RELIC_IDS.has(relicId)) return null
  const relic = relicsById.get(relicId)
  if (!relic) return null
  return {
    icon: relic.icon,
    name: relic.name,
    description: formatRelicDescription(relic, relicEffects[relicId]),
    numericLines: [],
    facts: []
  }
}
