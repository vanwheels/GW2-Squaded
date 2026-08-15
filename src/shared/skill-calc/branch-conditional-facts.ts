import type { Skill, Trait } from '../types'
import type { BoonConditionSource } from '../boon-calc/sources'
import { BOON_CONDITION_ICONS, MISCELLANEOUS_ICONS } from '../boon-calc/icons'
import type { FactLine } from './fact-numbers'

const DRAGON_SLASH_FORCE_SHARP_AS_THE_WIND_ID = 80199
const DRAGON_SLASH_BOOST_SHARP_AS_THE_WIND_ID = 80281
const DRAGON_SLASH_REACH_SHARP_AS_THE_WIND_ID = 80246

const CHANT_OF_ACTION_ID = 77342
const CHANT_OF_RECUPERATION_ID = 76782
const CHANT_OF_FREEDOM_ID = 77155
const STRENGTHENING_STANZAS_ID = 2385

/**
 * One labeled alternative-outcome section of a skill's tooltip — a divider ("Enemy Target" / "Ally
 * Target") followed by that branch's own facts, same `factsBlock(numericLines, facts)` shape every
 * other fact block uses. Reuses `additiveEnhancementFacts`'s divider CSS
 * (`.tooltip-divider`/`.tooltip-section-label` in global.css) rather than inventing new styling —
 * visually the same "own labeled section below the base facts" idea, just with a hand-picked label
 * instead of a "When Enhanced" trigger name.
 */
export interface ConditionalBranch {
  label: string
  /** The wiki's own phase-by-phase narrative for this branch (e.g. "0-2 Seconds: ... / 2-4 Seconds:
   *  Additionally ... / 4-6 Seconds: ..."), rendered the same `.tooltip-description` way
   *  `TooltipBody` renders a skill's own description — without this, a flat bullet list of every
   *  status the branch ever grants reads as "all of these apply from the moment of cast," which
   *  misrepresents a skill built entirely around escalating over time. Optional since not every
   *  future branch necessarily has (or needs) wiki prose to quote. */
  description?: string
  numericLines: FactLine[]
  facts: BoonConditionSource[]
  /** `true` when this branch's `facts` should ALSO count toward the aggregate Boon/Condition panel
   *  (`computeBoonConditionSources`), not just this skill's own tooltip — see that function's
   *  `mechanicBarIdsForBuild`/branch-consulting doc comments in `boon-calc/sources.ts` for the full
   *  reasoning. Defaults to falsy (tooltip-only, the original behavior every branch had before
   *  2026-08-15) since most branches are a genuine build-time CHOICE with no defensible single
   *  "always true" pick (e.g. `otherworldlyBondBranches`' Enemy vs. Ally Target) — only set this on
   *  a branch that represents the steady-state/best-case outcome of a skill this app already treats
   *  as "always sustained" everywhere else (every other boon source's duration/uptime number is
   *  already an idealized, not live-simulated, figure). At most ONE branch per skill should be
   *  flagged for any given mutually-exclusive GROUP (e.g. a Motivation tier) — an "Initial Cast"
   *  addable ADDITIONALLY alongside one tier is fine, since it's not exclusive with the tiers. */
  countsTowardTotals?: boolean
}

const RANGE_ICON = 'https://render.guildwars2.com/file/0AAB34BEB1C9F4A25EC612DDBEACF3E20B2810FA/156666.png'
const RADIUS_ICON = 'https://render.guildwars2.com/file/B0CD8077991E4FB1622D2930337ED7F9B54211D5/156665.png'
const ALLIED_TARGETS_ICON = 'https://render.guildwars2.com/file/BBE8191A494B0352259C10EADFDACCE177E6DA5B/1770208.png'
// "Duration" and "Fuse Time" facts share this same clock icon across every skill that carries either
// (confirmed against Blossoming Aura's own Fuse Time fact, id 71816) — reused here since Otherworldly
// Bond's own "Duration: 7 seconds" line has no live API fact to pull an icon from at all.
const DURATION_ICON = 'https://render.guildwars2.com/file/7B2193ACCF77E56C13E608191B082D68AA0FAA71/156659.png'
const INTERVAL_ICON = 'https://render.guildwars2.com/file/B75E91EB22E0DFCC1D08030204055946506D56F6/1770206.png'
// The exact icon a live `AttributeAdjust`/`target: 'Healing'`/`text: 'Healing'` fact carries
// elsewhere in data/game-data/skills.json (e.g. skill 1125 "Eat Egg") — reused here since Chant of
// Recuperation's own Healing facts don't exist in the live API at all (see
// `chantOfRecuperationSections`'s doc comment).
const HEALING_ICON = 'https://render.guildwars2.com/file/D4347C52157B040943051D7E09DEAD7AF63D4378/156662.png'

/**
 * Otherworldly Bond (Revenant scepter 3, id 71952): a tether the player casts at EITHER an ally or
 * an enemy (their choice at cast time), escalating over 3 time tiers while it survives (0-2s/2-4s/
 * 4-6s, severed early by range or a weapon swap, 7s max). The live API's own `facts` array for this
 * skill carries only Range/Recharge — every other number here comes from the wiki's raw
 * `{{skill fact}}` templates + its own rendered Skill Facts table (fetched fresh 2026-08-14), NOT
 * from the reference screenshot the user originally supplied: that screenshot was captured on a live
 * character with its own boon-duration gear equipped, and a first draft of this file that transcribed
 * numbers straight off it got 2 of them wrong as a result — Fury read 3s (actually the character's own
 * base-2s × a +50% boon-duration bonus, not a base value) and "Might Stacks per Level" read "(5x4s):
 * 20 Condition Damage, 40 Power" (a live-scaled reading; the wiki's flat base is "(4s): 30 Condition
 * Damage, 30 Power" — standard, un-split Might scaling). Vulnerability/Crippled/Slow happened to
 * already match the wiki's base WvW values exactly, consistent with that same character having boon
 * duration but no condition duration equipped — corroborating, not contradicting, the fix. Every
 * duration below is now the wiki's own WvW+PvP base value (this app's usual WvW-first convention),
 * left for `boonConditionFactsForSkill`'s normal scaling to reproduce whatever a given build's own
 * gear should show — never a number read off any one specific build's tooltip again.
 *
 * `COMPLETED.md` Session 131 (2026-08-07) looked at curating this and concluded a single flat fact
 * list would misrepresent it: the two branches are mutually exclusive per cast with no discriminator
 * field, so folding both into one list would show every cast granting everything at once. This
 * function resolves that the same way the real tooltip does — TWO separate labeled sections ("Enemy
 * Target"/"Ally Target") rather than one merged list, so nothing claims both branches happen on the
 * same cast. The other Session 131 objection (open-ended tick count, no `stacks=`) is sidestepped by
 * never claiming a total application count: every boon/condition row here uses `applyCount: 1` (an
 * unadorned duration, "this is what one application looks like") rather than projecting how many
 * times a real cast would tick — the Duration/Interval numeric lines already convey "ticks every 1s
 * for up to 7s" without this function pretending to know how long any given tether actually survives.
 * `Deactivate Otherworldly Bond` (71858, this skill's flip target) has nothing beyond Range to add —
 * Session 131 already confirmed that, unchanged here.
 *
 * Neither branch gets `countsTowardTotals` (added 2026-08-15, see that field's doc comment): unlike
 * the Chants'/Dragon Slash's tiers (a single skill's own value escalating over time, where "assume
 * the best-maintained state" is a defensible idealization), Enemy vs. Ally Target is a genuine
 * build-time CHOICE the player makes per cast — a control-focused build would only ever use Enemy
 * Target, a support/might build only Ally Target. Counting either unconditionally would silently
 * inflate one archetype's totals with a boon/condition it may never actually apply.
 */
function otherworldlyBondBranches(skill: Skill, durationPercent: { boon: number; condition: number }): ConditionalBranch[] {
  const conditionRow = (name: 'Vulnerability' | 'Crippled' | 'Slow', baseDurationSeconds: number): BoonConditionSource => ({
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: name,
    isCondition: true,
    category: 'condition',
    baseDurationSeconds,
    scaledDurationSeconds: baseDurationSeconds * (1 + durationPercent.condition / 100),
    applyCount: 1,
    requiresTraitId: null,
    // Single-target tether — only the linked enemy, never an area effect.
    targetCount: 1
  })

  return [
    {
      label: 'Enemy Target',
      // Verbatim off the wiki's own infobox prose (`{{skill fact|enemy target|...}}`, fetched
      // 2026-08-14) — quoted, not paraphrased, same as every other curated fact in this file.
      description:
        '0-2 Seconds: Inflict vulnerability on linked enemy each interval.\n' +
        '2-4 Seconds: Additionally inflicts cripple.\n' +
        '4-6 Seconds: Additionally inflicts slow. Gain access to Otherworldly Attraction.',
      numericLines: [
        { icon: DURATION_ICON, text: 'Duration: 7 seconds' },
        { icon: INTERVAL_ICON, text: 'Interval: 1 second' }
      ],
      facts: [conditionRow('Vulnerability', 8), conditionRow('Crippled', 1), conditionRow('Slow', 1)]
    },
    {
      label: 'Ally Target',
      description:
        '0-2 Seconds: Grant might to the linked ally and players around you each interval.\n' +
        '2-4 Seconds: Grant more might.\n' +
        '4-6 Seconds: Grant even more might. In addition, grant fury. Gain access to Otherworldly Attraction.',
      numericLines: [
        // The wiki's own rendered fact table keeps this one as flat text ("Might Stacks per Level
        // (4s): 30 Condition Damage, 30 Power" at WvW+PvP base) rather than a scaled duration row —
        // it labels an escalating per-tier grant ("Level" 1/2/3 across the tether's 3 phases), not a
        // single fixed application this app's BoonConditionSource shape (one status, one duration)
        // could represent without inventing numbers the wiki doesn't actually give a duration-% split
        // for. Left unscaled by `durationPercent` for the same reason — the wiki gives no basis to
        // scale it correctly, so showing the flat base is honest where guessing wouldn't be.
        { icon: BOON_CONDITION_ICONS.Might, text: 'Might Stacks per Level (4s): 30 Condition Damage, 30 Power' },
        { icon: ALLIED_TARGETS_ICON, text: 'Number of Allied Targets: 3' },
        { icon: DURATION_ICON, text: 'Duration: 7 seconds' },
        { icon: INTERVAL_ICON, text: 'Interval: 1 second' },
        { icon: RADIUS_ICON, text: 'Radius: 360' },
        { icon: RANGE_ICON, text: 'Range: 900' }
      ],
      facts: [
        {
          sourceKind: 'skill',
          sourceId: skill.id,
          sourceName: skill.name,
          sourceIcon: skill.icon,
          boonOrConditionName: 'Fury',
          isCondition: false,
          category: 'boon',
          baseDurationSeconds: 2,
          scaledDurationSeconds: 2 * (1 + durationPercent.boon / 100),
          applyCount: 1,
          requiresTraitId: null,
          // Reaches the linked ally and nearby allies alike, same reach as the Might ticks above it
          // (see "Number of Allied Targets: 3" in this branch's own numeric lines).
          targetCount: 3
        }
      ]
    }
  ]
}

/**
 * Bladesworn's Sharp as the Wind reflavor of Dragon Slash—Force/Boost/Reach (see
 * `dragon-slash-skills.ts`'s `DRAGON_SLASH_SHARP_AS_THE_WIND_SKILLS` for the full writeup):
 * "consumes all charges to increase burning duration," wiki-verified with an explicit Minimum
 * Burning Duration (lowest charge) / Maximum Burning Duration (full charge, WvW+PvP value per this
 * app's convention) pair per skill, same "two real, mutually exclusive per-cast outcomes" shape as
 * `otherworldlyBondBranches`'s Enemy/Ally Target split — 2 flat `Buff` facts directly on the skill
 * would double-count into `computeBoonConditionSources`'s aggregate totals as if both durations
 * apply on the same cast, since Burning (unlike Damage) is a tracked `CONDITION_NAMES` entry. No
 * `numericLines` needed per branch — the base facts block (rendered once, above these branches)
 * already carries Damage/Range/Recharge/targets; each branch only adds its own Burning row.
 */
function dragonSlashSharpAsTheWindBranches(
  skill: Skill,
  durationPercent: { boon: number; condition: number },
  maxDurationSeconds: number,
  minDurationSeconds: number
): ConditionalBranch[] {
  const burningRow = (baseDurationSeconds: number, applyCount: number): BoonConditionSource => ({
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Burning',
    isCondition: true,
    category: 'condition',
    baseDurationSeconds,
    scaledDurationSeconds: baseDurationSeconds * (1 + durationPercent.condition / 100),
    applyCount,
    requiresTraitId: null,
    // "Number of Targets: 5" on the base facts block — a cleaving burst finisher, not single-target.
    targetCount: 5
  })

  return [
    { label: 'Minimum Charge', numericLines: [], facts: [burningRow(minDurationSeconds, 1)] },
    // Maximum Charge stacks=4 is the WvW+PvP value on every one of the 3 skills; PvE's own
    // (higher stack count, lower duration) reading is noted per-caller below, not used here.
    // `countsTowardTotals` steady-state pick (see `ConditionalBranch`'s doc comment): a
    // well-played Bladesworn charges to max before releasing for the strongest Burning, the same
    // "idealized best-case, not live-simulated" assumption every other boon/condition source in
    // this app already makes — Minimum Charge stays a tooltip-only alternative.
    { label: 'Maximum Charge', numericLines: [], facts: [burningRow(maxDurationSeconds, 4)], countsTowardTotals: true }
  ]
}

/**
 * Paragon's 3 Chant skills (Warrior elite spec 74) are each simultaneously a Burst (an immediate,
 * one-time effect on cast) and a "Refrain" (a self-buff that ticks its own boons every `Interval`
 * seconds, scaling up in 3 bands as the wiki calls them out — 1-3/4-6/7-10 Motivation — until the
 * player's Motivation stacks run out or another chant is activated). The live API's own `facts`
 * array for all 3 stops at Recharge/Radius/Number of Targets/Interval; every number below comes
 * from the wiki's raw `{{skill fact}}` templates cross-checked against the wiki's own *rendered*
 * Skill Facts panel (fetched fresh 2026-08-15 via both `action=raw` and the normal page — the raw
 * templates alone were ambiguous about which positional argument was which for Chant of Action's
 * stacked Might/Fury facts, the rendered panel wasn't). WvW values used throughout (this app's usual
 * convention) wherever a fact carries a PvE/WvW/PvP split.
 *
 * Same shape decision as `otherworldlyBondBranches`: no `motivationStacks` `CombatState` field was
 * added for this (TODO.md had flagged that as a likely prerequisite before this was picked up, but
 * on inspection this mechanism is tooltip-only — same as Otherworldly Bond's own branches — so a
 * combat-state gate isn't actually required to render it correctly; every band is honestly labeled
 * with its own Motivation range rather than picking one to imply is "current"). Every boon fact here
 * uses `applyCount: 1` unless the wiki's own rendered text shows more than one stack applying at
 * once (Chant of Action's Might), same "this is what one application looks like, not a projected
 * total over the tether's lifetime" convention `otherworldlyBondBranches` already established.
 *
 * Deliberately still missing from this file: Chant of Recuperation's own Barrier (on cast) and
 * Healing (per Refrain tick) numbers use a real Healing-Power-scaled formula
 * (`baseValue + coefficient * healingPower`, same as `CURATED_HEALING_COEFFICIENTS`/
 * `CURATED_BARRIER_COEFFICIENTS`) computed directly here rather than through either curated table,
 * since both tables require a matching live API fact to attach a coefficient to (`Array.find` by
 * `factText`) and these skills have none — see each function's own doc comment. The 5 wiki-flagged
 * Chant-modifying traits (TODO.md) were picked up in a follow-up pass (2026-08-15) rather than this
 * one: Feverish Pulse (2369) turned out to already render correctly with zero code changes (its
 * Quickness/Alacrity split was already fixed via `WvwFactOverrides` in Session 173, and its
 * "Recharge Time Reduced" fact is a generic `Time`-type line `numericFactLines` already handles);
 * Enduring Refrain (2428) already shows everything the wiki quantifies (its "stronger Refrain
 * effects" is genuinely never given a number — only "+1 Motivation Stack" is, and that's already a
 * plain `Number` fact); Calming Tongue's (2433) "Conditions Removed" pve+wvw-vs-pvp duplicate got a
 * small `NUMERIC_FACT_WVW_OVERRIDES` dedup entry in `fact-numbers.ts` instead of touching this file,
 * since `Number`-type facts are outside `fetch-wvw-splits.ts`'s Buff-only scope; Liberating Liaise's
 * (2357) Superspeed grant turned out to be a dead end — Superspeed isn't a
 * `classifyBoonCondition`-recognized status (GW2's own boon/condition split; it only lives in
 * `MISCELLANEOUS_MATCHERS`'s presence-only named-fact pipeline, which has no WvW-override concept
 * of its own at all), logged as an open, general-not-just-this-trait gap in TODO.md rather than
 * special-cased here. Strengthening Stanzas (2385) is the one that genuinely needed this file's own
 * divider mechanism — see `strengtheningStanzasBranches` below, exposed through the sibling
 * `branchConditionalTraitFacts` (not `branchConditionalFacts` itself, which is `Skill`-shaped) that
 * `TraitsEditor.tsx` now calls the same way `SkillsEditor.tsx` calls this one.
 */
function chantOfActionSections(skill: Skill, durationPercent: { boon: number; condition: number }): ConditionalBranch[] {
  const might = (applyCount: number): BoonConditionSource => ({
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Might',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 4, // WvW value (PvE 8s, PvP 6s)
    scaledDurationSeconds: 4 * (1 + durationPercent.boon / 100),
    applyCount,
    requiresTraitId: null,
    targetCount: 5
  })
  const fury: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Fury',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 2, // WvW+PvP value (PvE 5s)
    scaledDurationSeconds: 2 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const costLine = (n: number): FactLine => ({ icon: null, text: `Motivation Cost per Interval: ${n}` })

  return [
    // Initial Cast + 7-10 Motivation are this skill's `countsTowardTotals` steady-state pick (see
    // `ConditionalBranch.countsTowardTotals`'s doc comment) — Initial Cast recurs on every cast
    // (not mutually exclusive with a Motivation tier), and 7-10 is the best-maintained band, same
    // "idealized sustained rotation" assumption this app's boon uptime already makes everywhere
    // else. The 1-3/4-6 tiers stay tooltip-only alternatives, same as before.
    { label: 'Initial Cast', numericLines: [], facts: [might(2), fury], countsTowardTotals: true },
    { label: '1-3 Motivation', numericLines: [costLine(1)], facts: [might(1)] },
    { label: '4-6 Motivation', numericLines: [costLine(2)], facts: [might(2), fury] },
    { label: '7-10 Motivation', numericLines: [costLine(3)], facts: [might(3), fury], countsTowardTotals: true }
  ]
}

function chantOfRecuperationSections(skill: Skill, durationPercent: { boon: number; condition: number }, healingPower: number): ConditionalBranch[] {
  const vigor: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Vigor',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 3, // WvW value (PvE+PvP 5s)
    scaledDurationSeconds: 3 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const regeneration: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Regeneration',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 2, // WvW value (PvE+PvP 3s)
    scaledDurationSeconds: 2 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  // Barrier/Healing formula (baseValue + coefficient * healingPower) is quoted straight off the
  // wiki's own WvW+PvP facts, same math `barrierLinesForSkill`/`healingLinesForSkill` apply — just
  // computed inline instead of through either curated table, since both match against a live
  // `AttributeAdjust` fact by `factText` and this skill's API facts have no Barrier/Healing entry at
  // all to match against (confirmed via a full dump of skill 76782's own `facts` array).
  const barrierLine = (): FactLine => ({ icon: MISCELLANEOUS_ICONS.Barrier, text: `Barrier: ${Math.round(1615 + 0.5 * healingPower).toLocaleString()}` })
  const healLine = (baseValue: number, coefficient: number): FactLine => ({
    icon: HEALING_ICON,
    text: `Healing: ${Math.round(baseValue + coefficient * healingPower).toLocaleString()}`
  })
  const costLine = (n: number): FactLine => ({ icon: null, text: `Motivation Cost per Interval: ${n}` })

  return [
    // Same `countsTowardTotals` steady-state pick as `chantOfActionSections` — Initial Cast's Vigor
    // recurs every cast, 7-10 Motivation's Regeneration is the best-maintained band.
    { label: 'Initial Cast', numericLines: [barrierLine()], facts: [vigor], countsTowardTotals: true },
    { label: '1-3 Motivation', numericLines: [healLine(330, 0.1), costLine(2)], facts: [] },
    { label: '4-6 Motivation', numericLines: [healLine(431, 0.15), costLine(2)], facts: [] },
    { label: '7-10 Motivation', numericLines: [healLine(532, 0.2), costLine(3)], facts: [regeneration], countsTowardTotals: true }
  ]
}

function chantOfFreedomSections(skill: Skill, durationPercent: { boon: number; condition: number }): ConditionalBranch[] {
  const stability: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Stability',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 3, // no PvE/WvW/PvP split
    scaledDurationSeconds: 3 * (1 + durationPercent.boon / 100),
    applyCount: 2,
    requiresTraitId: null,
    targetCount: 5
  }
  const swiftness: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Swiftness',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 3, // no PvE/WvW/PvP split
    scaledDurationSeconds: 3 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const resolution: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Resolution',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 2, // WvW value (PvE+PvP 3s)
    scaledDurationSeconds: 2 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const protection: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Protection',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 2, // WvW value (PvE+PvP 3s)
    scaledDurationSeconds: 2 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const costLine = (n: number): FactLine => ({ icon: null, text: `Motivation Cost per Interval: ${n}` })

  return [
    // "Breaks Stun" is already a real live API fact on this skill (StunBreak type) — only Stability
    // itself needs adding here. Same `countsTowardTotals` steady-state pick as the other 2 Chants.
    { label: 'Initial Cast', numericLines: [], facts: [stability], countsTowardTotals: true },
    { label: '1-3 Motivation', numericLines: [costLine(1)], facts: [swiftness] },
    { label: '4-6 Motivation', numericLines: [costLine(2)], facts: [swiftness, resolution] },
    { label: '7-10 Motivation', numericLines: [costLine(3)], facts: [swiftness, resolution, protection], countsTowardTotals: true }
  ]
}

/**
 * Per-skill mutually-exclusive-outcome fact sections for `skillTooltipContent` to render as extra
 * labeled dividers below the base facts — `null` for every skill without one. Kept as its own
 * lookup (rather than folded into `synthetic-facts.json`) since that file's shape has no concept of
 * "these facts are alternatives, not simultaneous" — see `otherworldlyBondBranches`'s doc comment
 * for why a flat merge would misrepresent a skill like this. A future skill with the same "one
 * cast, mutually exclusive branches" shape (e.g. Twin Moon Sweep, COMPLETED.md Session 130) could
 * reuse this same mechanism.
 */
export function branchConditionalFacts(
  skill: Skill,
  durationPercent: { boon: number; condition: number },
  healingPower: number
): ConditionalBranch[] | null {
  if (skill.id === 71952) return otherworldlyBondBranches(skill, durationPercent)
  // Sharp as the Wind's Force/Boost/Reach — Minimum Burning Duration has no PvE/WvW+PvP split on
  // the wiki (used as-is); Maximum is each skill's own WvW+PvP value (PvE noted in the comment).
  if (skill.id === DRAGON_SLASH_FORCE_SHARP_AS_THE_WIND_ID) return dragonSlashSharpAsTheWindBranches(skill, durationPercent, 7, 2) // PvE max: 4s@20 stacks
  if (skill.id === DRAGON_SLASH_BOOST_SHARP_AS_THE_WIND_ID) return dragonSlashSharpAsTheWindBranches(skill, durationPercent, 5.5, 1.5) // PvE max: 3.25s@20 stacks
  if (skill.id === DRAGON_SLASH_REACH_SHARP_AS_THE_WIND_ID) return dragonSlashSharpAsTheWindBranches(skill, durationPercent, 3.5, 1) // PvE max: 2s@20 stacks
  if (skill.id === CHANT_OF_ACTION_ID) return chantOfActionSections(skill, durationPercent)
  if (skill.id === CHANT_OF_RECUPERATION_ID) return chantOfRecuperationSections(skill, durationPercent, healingPower)
  if (skill.id === CHANT_OF_FREEDOM_ID) return chantOfFreedomSections(skill, durationPercent)
  return null
}

/**
 * Strengthening Stanzas (Paragon/Warrior Master trait, id 2385): "Refrains grant bonus effects to
 * you while they are active." Only one of the 3 Chant Refrains can be running on the player at a
 * time (activating a chant replaces whichever Refrain was already ticking) — the same "one cast,
 * mutually exclusive outcomes" shape `otherworldlyBondBranches`/the Chant sections above already
 * exist for, just applied to a trait instead of a skill. The live API's own `facts` for this trait
 * are 3 bare "Chant of Action/Recuperation/Freedom" `Buff` markers with `duration: 0` and no
 * numbers — `classifyBoonCondition` doesn't recognize those statuses (not real boons/conditions),
 * so `numericFactLines`/`boonConditionFactsForTrait` silently drop them today regardless; every %
 * below is wiki-only (raw wikitext, fetched 2026-08-15). WvW values used throughout (this app's
 * usual convention); the wiki's PvE/PvP-only numbers are noted per line for anyone extending this
 * later, not used here. None of "+Damage"/"-Incoming Damage"/"+Movement Speed" is a tracked
 * boon/condition, so every branch's `facts` stays empty — the bonus is plain descriptive text via
 * `numericLines` only, same "display-only, not fed into any aggregate total" treatment
 * `chantOfActionSections`'s own "Motivation Cost per Interval" lines already get.
 */
function strengtheningStanzasBranches(): ConditionalBranch[] {
  return [
    {
      label: 'While Chant of Action Active',
      // PvE 15% Damage/10% Condition Damage (2026-04-14 patch dropped Condition Damage from 15%);
      // PvP 7%/7% (2026-02-03 patch dropped Damage from 10%).
      numericLines: [{ icon: null, text: '+10% Damage, +10% Condition Damage' }],
      facts: []
    },
    {
      label: 'While Chant of Recuperation Active',
      numericLines: [{ icon: null, text: '-7% Incoming Damage, -7% Incoming Condition Damage' }], // PvE -15%/-15%
      facts: []
    },
    {
      label: 'While Chant of Freedom Active',
      numericLines: [{ icon: null, text: '+50% Movement Speed' }], // no PvE/WvW/PvP split
      facts: []
    }
  ]
}

/**
 * `branchConditionalFacts`'s trait counterpart — `Trait`-shaped rather than `Skill`-shaped since a
 * trait tooltip never needs a factSourceSkill/healingPower-style swap, called from
 * `TraitsEditor.tsx` (both minor and major trait tooltips) the same way `skillTooltipContent` calls
 * the skill version. `null` for every trait without one.
 */
export function branchConditionalTraitFacts(trait: Trait): ConditionalBranch[] | null {
  if (trait.id === STRENGTHENING_STANZAS_ID) return strengtheningStanzasBranches()
  return null
}
