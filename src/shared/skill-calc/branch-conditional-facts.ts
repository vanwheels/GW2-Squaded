import type { Legend, Skill, Trait } from '../types'
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
const DRACONIC_ECHO_ID = 1772
const FACET_OF_NATURE_ID = 29371
const SIPHON_ID = 63067
const MEASURED_SHOT_ID = 63267
const ENDLESS_NIGHT_ID = 63128
const SHADOW_BOLT_ID = 63066
const DOUBLE_BOLT_ID = 63182
const TRIPLE_BOLT_ID = 63134

// Guardian Luminary (specialization id 81)'s 3 reworked Virtues — see `radiantJusticeSections`'s
// doc comment below for the full writeup. Ids are each virtue's F1/F2/F3 mechanic-bar entry point,
// same ones `profession-mechanic.ts`'s generic resolver already picks (no hand-injection needed).
const RADIANT_JUSTICE_ID = 78837
const RADIANT_RESOLVE_ID = 78604
const RADIANT_COURAGE_ID = 78358

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
// True Nature's own "Recharge"/"Damage" fact icons (skills.json ids 51667/51675/51696/51713/51714,
// live-verified 2026-08-20) — reused for `trueNatureBranches` below rather than inventing new ones.
const RECHARGE_ICON = 'https://render.guildwars2.com/file/D767B963D120F077C3B163A05DC05A7317D7DB70/156651.png'
const DAMAGE_ICON = 'https://render.guildwars2.com/file/61AA4919C4A7990903241B680A69530121E994C7/156657.png'

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
 * (2357) Superspeed grant wasn't special-cased here — Superspeed isn't a
 * `classifyBoonCondition`-recognized status (GW2's own boon/condition split; it only lives in
 * `MISCELLANEOUS_MATCHERS`'s presence-only named-fact pipeline), so this file's divider mechanism
 * didn't apply. The general "`namedFactsFrom` has no WvW-override concept" gap this trait exposed
 * (TODO.md) was fixed properly instead (2026-08-15, `namedFactsFrom`/`computeNamedFactSources`/
 * `namedFactsForSkill` in `sources.ts` now consult the same per-source `WvwFactOverride` map
 * `extractFromFacts` does), with a `2357: { Superspeed: 2 }` entry added to `fetch-wvw-splits.ts`'s
 * `MANUAL_OVERRIDES` to fix this trait's own tooltip as the first real case. Strengthening Stanzas
 * (2385) is the one that genuinely needed this file's own
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

// Same generic "Number"-type fact icon core Virtue of Justice's own live API fact uses for its
// "Number of Attacks to Trigger" line (skill 9115) — reused here since Radiant Justice's own copy
// of that same fact doesn't exist in the live API at all (see `radiantJusticeSections` below).
const NUMBER_FACT_ICON = 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png'

/**
 * Guardian Luminary (specialization id 81, released 2025-10-28)'s 3 reworked Virtues — TODO.md bug
 * flagged 2026-08-16 ("Luminary's F1-F4 skills don't display boon/condition/damage info on their
 * tooltips at all"). Live-verified: the mechanic-bar resolver already picks the right id for each
 * slot with zero hand-injection needed (unlike Dragonhunter/Specter/Vindicator's gaps in
 * `profession-mechanic.ts` — Luminary's ids are correctly tagged `specializationId: 81` and DO
 * appear in `Profession.professionSkills`), so the F1-F4 icons/names were never the problem. The
 * real gap: all 3 Virtues' own `facts` arrays in the live API carry only `Recharge` (Courage also
 * gets `StunBreak`) — every actual boon/condition/heal number lives entirely in the wiki's
 * structured `{{skill fact}}` templates instead, the same "empty API facts" shape as Otherworldly
 * Bond/the Chants above. Fetched fresh 2026-08-16 directly from each Virtue's own wiki page
 * (Radiant Justice/Radiant Resolve/Radiant Courage). WvW+PvP values used throughout (this app's
 * usual convention) wherever the wiki carries a PvE/WvW/PvP split; PvE-only numbers are noted per
 * line for anyone extending this later, not used here.
 *
 * Each Virtue has 2 real components — a passive ("Virtue:" prefix in the in-game description,
 * always ticking while this line is equipped, no player action needed) and an active one
 * ("Activate:" prefix, the F-key press) — plus, for all 3, a bonus "Empowered <weapon>" effect
 * primed on the NEXT use of a specific Radiant Forge weapon-bar skill (Dazzling Hammer/Luminous
 * Staff/Gleaming Blade/Radiant Bulwark — see `bundle-skills.ts`'s `RADIANT_FORGE_SLOT_SKILLS` for
 * how those 4 skills themselves get wired into the F4 bundle). The Empowered bonus is a real,
 * separate secondary hit/effect (confirmed by Justice's own description, "creates a delayed
 * secondary impact" — not a modifier of Dazzling Hammer's own base damage fact), so it's shown as
 * its own labeled section rather than folded into the base Virtue/Activate facts.
 *
 * `countsTowardTotals` (see `ConditionalBranch`'s doc comment): the Virtue and Activate sections are
 * flagged true — same "idealized always-maintained" assumption every other boon/condition source in
 * this app already makes, and the closest equivalent to how a normal skill's live API facts feed
 * `computeBoonConditionSources` unconditionally (these 3 skills have none to feed, so the flag is
 * what stands in for that). The 4 "Empowered <weapon>" sections stay tooltip-only: each needs a
 * genuine follow-up choice (casting a specific Radiant Forge weapon skill next rather than any
 * other), a real build-time/rotation decision closer to `otherworldlyBondBranches`' Enemy/Ally
 * Target split than to a Chant's passively-ticking Motivation band.
 *
 * Left as descriptive `numericLines` text rather than a tracked `BoonConditionSource`, and so
 * NOT counted in any aggregate total: Radiant Resolve's own "Radiant Resolve (effect)" self-heal
 * (84 + 0.06×Healing Power — the wiki gives no interval/duration to compute a real uptime rate
 * from, only the per-tick amount) and its Healing-Power-scaled Heal-on-Activate/Empowered-Staff
 * numbers (same `baseValue + coefficient × healingPower` shape `chantOfRecuperationSections` uses,
 * computed inline for the same reason — no live API fact to attach a coefficient to); Radiant
 * Courage's "Luminary's Blessing" effect (a brand-new custom status, not one of this app's
 * `BOON_NAMES`/`CONDITION_NAMES`/`AURA_NAMES` — `classifyBoonCondition`/`classifyAura` would both
 * return `null` for it) and its Empowered-Shield Barrier (WvW+PvP is a flat value, no coefficient
 * at all per the wiki, so nothing to scale) and Stun Break (this app's `BoonConditionSource` has no
 * concept of a control-break flag, same as every other skill's own live `StunBreak` fact type,
 * which is handled by a completely separate numeric-fact code path, not this one).
 */
function radiantJusticeSections(skill: Skill, durationPercent: { boon: number; condition: number }): ConditionalBranch[] {
  const burning: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Burning',
    isCondition: true,
    category: 'condition',
    baseDurationSeconds: 2, // WvW+PvE value (PvP 4s)
    scaledDurationSeconds: 2 * (1 + durationPercent.condition / 100),
    applyCount: 1,
    requiresTraitId: null,
    // Procs off the player's own attack landing — no AoE/allied-target fact on the wiki page,
    // unlike Resolve/Courage's party-wide bursts below.
    targetCount: 1
  }
  const quickness: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Quickness',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 2, // WvW+PvP value (PvE 3s)
    scaledDurationSeconds: 2 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    // Description reads "Activate: Gain quickness" — no "you and your allies" (contra core Virtue
    // of Justice's own wording) and no targets/radius fact on the wiki page — self-only.
    targetCount: 1
  }
  const empoweredHammerVulnerability: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Vulnerability',
    isCondition: true,
    category: 'condition',
    baseDurationSeconds: 8, // no PvE/WvW/PvP split
    scaledDurationSeconds: 8 * (1 + durationPercent.condition / 100),
    applyCount: 4, // WvW+PvP stack count (PvE 8 stacks)
    requiresTraitId: null,
    targetCount: 5
  }

  return [
    {
      label: 'Virtue (Passive)',
      numericLines: [{ icon: NUMBER_FACT_ICON, text: 'Number of Attacks to Trigger: 5' }],
      facts: [burning],
      countsTowardTotals: true
    },
    { label: 'Activate', numericLines: [], facts: [quickness], countsTowardTotals: true },
    {
      label: 'Empowered Hammer (next Dazzling Hammer use)',
      numericLines: [{ icon: null, text: 'Damage Coefficient: 1.05 (delayed secondary impact)' }], // PvE 1.5
      facts: [empoweredHammerVulnerability]
    }
  ]
}

function radiantResolveSections(skill: Skill, durationPercent: { boon: number; condition: number }, healingPower: number): ConditionalBranch[] {
  const lightAura: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Light Aura',
    isCondition: false,
    category: 'aura',
    baseDurationSeconds: 4, // no PvE/WvW/PvP split
    scaledDurationSeconds: 4 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const empoweredStaffRegeneration: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Regeneration',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 4, // no PvE/WvW/PvP split
    scaledDurationSeconds: 4 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  // WvW+PvP base 985, coefficient 1.0 (PvE base 1,625, coefficient 1.4) — same shared formula for
  // both the base Activate heal and the Empowered Staff bonus (the wiki repeats the identical
  // {{skill fact|healing}} pair under both blocks).
  const activateHealLine = (): FactLine => ({
    icon: HEALING_ICON,
    text: `Healing: ${Math.round(985 + 1.0 * healingPower).toLocaleString()}`
  })

  return [
    {
      label: 'Virtue (Passive)',
      numericLines: [{ icon: null, text: `Radiant Resolve (self effect): ${Math.round(84 + 0.06 * healingPower).toLocaleString()} Heal` }],
      facts: []
    },
    {
      label: 'Activate',
      numericLines: [activateHealLine(), { icon: null, text: 'Self Condition Removal: 2' }],
      facts: [lightAura],
      countsTowardTotals: true
    },
    {
      label: 'Empowered Staff (next Luminous Staff use)',
      numericLines: [activateHealLine()],
      facts: [empoweredStaffRegeneration]
    }
  ]
}

function radiantCourageSections(skill: Skill, durationPercent: { boon: number; condition: number }): ConditionalBranch[] {
  const aegis: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Aegis',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 20, // no PvE/WvW/PvP split
    scaledDurationSeconds: 20 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const resistance: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Resistance',
    isCondition: false,
    category: 'boon',
    baseDurationSeconds: 4, // no PvE/WvW/PvP split
    scaledDurationSeconds: 4 * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5
  }
  const empoweredSwordImmobile: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Immobile',
    isCondition: true,
    category: 'condition',
    baseDurationSeconds: 2, // no PvE/WvW/PvP split
    scaledDurationSeconds: 2 * (1 + durationPercent.condition / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 1
  }

  return [
    { label: 'Virtue (Passive)', numericLines: [{ icon: INTERVAL_ICON, text: 'Aegis Refresh: 40 seconds' }], facts: [] },
    {
      label: 'Activate',
      numericLines: [
        {
          icon: null,
          text: "Luminary's Blessing (6s PvE / 3s WvW+PvP): Reduced incoming strike damage; heals when it expires"
        }
      ],
      facts: [aegis, resistance],
      countsTowardTotals: true
    },
    {
      label: 'Empowered Sword (next Gleaming Blade use)',
      numericLines: [{ icon: null, text: 'Damage Increase: 50%' }],
      facts: [empoweredSwordImmobile]
    },
    {
      label: 'Empowered Shield (next Radiant Bulwark use)',
      numericLines: [
        { icon: MISCELLANEOUS_ICONS.Barrier, text: 'Barrier: 2,265' }, // PvE 3,225 base + 1.0 coefficient x Healing Power
        { icon: MISCELLANEOUS_ICONS['Breaks Stun'], text: 'Breaks Stun' }
      ],
      facts: []
    }
  ]
}

// Core Value (Revenant/Herald Grandmaster major, id 1806): "Facet of Nature's consume skill has
// improved effectiveness." See `trueNatureBranches`'s own doc comment for how its boost is applied.
const CORE_VALUE_TRAIT_ID = 1806

/**
 * Legend.name -> True Nature's real per-legend skill id (skills.json, live-verified 2026-08-20).
 * "True Nature" is Facet of Nature's own Consume effect (id 29393 generically, `flipSkill: null` on
 * 29371 in the live API — same gap shape `FLIP_SKILL_OVERRIDES` fixes for Facet of Elements, except
 * here the "one flip target" model doesn't fit: the REAL effect is one of 5 different skill objects
 * depending on which OTHER legend the player currently has invoked, only resolvable with the build's
 * own equipped-legend context `flip-skill-overrides.ts`'s plain `Skill -> Skill` map can't carry).
 * Only these 5 "classic" legends (all released before Renegade/Vindicator) have a True Nature variant
 * at all — matches 29393's own facts, which enumerate exactly these same 5 legend markers (each a
 * bare, numberless `PrefixedBuff`) and nothing else; a Herald invoking Kalla or the Alliance legend
 * gets no True Nature branch here, same as the real game (Facet of Nature has no Renegade/Vindicator
 * form). Handled entirely inside `trueNatureBranches` below rather than via a `flipSkill`/
 * `withFlipChain` walk — the 5 variants' own real facts are hand-copied in as this app's usual
 * "wiki/API values curated once, with a comment" convention, attributed to Facet of Nature's own
 * `sourceId`/`sourceName`/`sourceIcon` (same "constructed facts credited to the DISPLAYED skill"
 * convention `otherworldlyBondBranches` already uses for its own flip-adjacent Enemy/Ally branches).
 */
const TRUE_NATURE_SKILL_ID_BY_LEGEND_NAME: Record<string, number> = {
  'Legendary Assassin Stance': 51667,
  'Legendary Dwarf Stance': 51675,
  'Legendary Dragon Stance': 51696,
  'Legendary Centaur Stance': 51713,
  'Legendary Demon Stance': 51714
}

/**
 * Facet of Nature (Herald F2, id 29371)'s own Consume effect, True Nature — TODO.md's "Herald F2
 * lacks linked tooltips + Core Value lacks its details" item (flagged 2026-08-19, closed 2026-08-20).
 * One labeled branch per True-Nature-eligible legend the build actually has equipped (see
 * `TRUE_NATURE_SKILL_ID_BY_LEGEND_NAME`'s doc comment for why only 5 of Revenant's legends qualify,
 * and why this needs real equipped-legend context rather than a static flip-target map). Numbers are
 * each variant's own live `skills.json` facts (`Recharge`/`Number of Targets`/`Radius` shared by all
 * 5, verified 2026-08-20), reusing this file's existing icon constants where the raw fact's own icon
 * already matches one (confirmed byte-for-byte against the live data).
 *
 * Core Value (1806, Herald Grandmaster major): "Facet of Nature's consume skill has improved
 * effectiveness." Each True Nature variant's own `traitedFacts` carries exactly ONE entry
 * (`requires_trait: 1806`) with an `overrides` field — the GW2 API's own documented convention of an
 * INDEX into that skill's base `facts` array naming which entry this traited fact replaces, not an
 * unrelated number (confirmed by cross-referencing all 5: e.g. 51667's base `facts[4]` is "Boons
 * Removed: 2", its traitedFact reads `value: 3, overrides: 4` — index 4 IS "Boons Removed", so Core
 * Value simply raises it to 3; same pattern holds for all 5 variants' own single boosted fact below).
 * Resolved inline per variant (`coreValueActive ? boosted : base`) rather than a generic "supersedes"
 * resolver — this app's `Fact` type already carries `overrides` (untouched by any other code today,
 * confirmed via a full grep) but nothing generically consumes it; every value below is hand-picked
 * from the raw data rather than read at runtime, matching this file's existing convention of curated,
 * not derived, numbers.
 *
 * Only 2 of the 5 variants (Dwarf's Stability, Demon's Might) grant a real tracked boon — flagged
 * `countsTowardTotals: true`, same "both equipped legends' kits always contribute" convention
 * `RevenantSkillSelection.activeLegendIndex`'s own doc comment documents (a player can invoke either
 * equipped legend at will, so both count rather than only whichever is currently displayed). The
 * other 3 (Assassin's boon-strip, Dragon's boon-duration-increase/condition-cleanse, Centaur's
 * condition-cleanse/heal) aren't recognized boon/condition names, so stay tooltip-only `numericLines`
 * — same "display-only" treatment this file's other trait-marker sections already use. Centaur's own
 * "Heal per Condition Removed" fact appears twice in the raw data with no discriminator (970/323, no
 * `alt=` or game-mode tag) — read as the usual undocumented PvE/WvW+PvP pair (this app's WvW-first
 * convention), the lower value used. Assassin's own `Damage` fact (`dmg_multiplier: 1`) has no
 * curated coefficient — shown as the bare "1 hit" `factLine` rendering every other un-curated Damage
 * fact in this app gets, not a live Power-scaled number (would need `power`/`targetArmor` threaded
 * through this whole call chain for one skill's one fact; a reasonable future follow-up, not done
 * here). Facet of Nature's OWN base per-legend numbers (its passive tick, not this Consume effect)
 * remain a separate, still-open TODO.md item — wiki-fetched but not yet precisely verified.
 */
function trueNatureBranches(
  skill: Skill,
  equippedLegendIdSet: ReadonlySet<string>,
  legends: Legend[],
  activeTraitIds: ReadonlySet<number>,
  durationPercent: { boon: number; condition: number }
): ConditionalBranch[] {
  const coreValueActive = activeTraitIds.has(CORE_VALUE_TRAIT_ID)
  const boonRow = (name: 'Stability' | 'Might', baseDurationSeconds: number, applyCount: number): BoonConditionSource => ({
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: name,
    isCondition: false,
    category: 'boon',
    baseDurationSeconds,
    scaledDurationSeconds: baseDurationSeconds * (1 + durationPercent.boon / 100),
    applyCount,
    requiresTraitId: null,
    // "Number of Targets: 5" on every variant's own numericLines below.
    targetCount: 5
  })

  const branchFor = (legend: Legend): ConditionalBranch | null => {
    const label = `True Nature (${legend.name})`
    switch (legend.name) {
      case 'Legendary Assassin Stance':
        return {
          label,
          description: 'Strip boons from nearby enemies.',
          numericLines: [
            { icon: RECHARGE_ICON, text: 'Recharge: 20s' },
            { icon: NUMBER_FACT_ICON, text: 'Unblockable' },
            { icon: DAMAGE_ICON, text: 'Damage: 1 hit' },
            { icon: ALLIED_TARGETS_ICON, text: 'Number of Targets: 5' },
            { icon: NUMBER_FACT_ICON, text: `Boons Removed: ${coreValueActive ? 3 : 2}` }, // Core Value: 2 -> 3
            { icon: RADIUS_ICON, text: 'Radius: 360' }
          ],
          facts: []
        }
      case 'Legendary Dwarf Stance':
        return {
          label,
          description: 'Grant stability to nearby allies.',
          numericLines: [
            { icon: RECHARGE_ICON, text: 'Recharge: 20s' },
            { icon: ALLIED_TARGETS_ICON, text: 'Number of Targets: 5' },
            { icon: RADIUS_ICON, text: 'Radius: 600' }
          ],
          facts: [boonRow('Stability', 4, coreValueActive ? 3 : 2)], // Core Value: 2 -> 3 stacks
          countsTowardTotals: true
        }
      case 'Legendary Dragon Stance':
        return {
          label,
          description: "Increase the duration of allies' boons. Remove conditions from allies.",
          numericLines: [
            { icon: RECHARGE_ICON, text: 'Recharge: 20s' },
            { icon: ALLIED_TARGETS_ICON, text: 'Number of Targets: 5' },
            { icon: DURATION_ICON, text: `Duration Increase: ${coreValueActive ? 3 : 2}s` }, // Core Value: 2s -> 3s
            { icon: NUMBER_FACT_ICON, text: 'Conditions Removed: 3' },
            { icon: RADIUS_ICON, text: 'Radius: 600' }
          ],
          facts: []
        }
      case 'Legendary Centaur Stance':
        return {
          label,
          description: 'Cleanse conditions from nearby allies. Heal for each condition removed.',
          numericLines: [
            { icon: RECHARGE_ICON, text: 'Recharge: 20s' },
            { icon: HEALING_ICON, text: 'Heal per Condition Removed: 323' }, // WvW+PvP value (PvE 970)
            { icon: ALLIED_TARGETS_ICON, text: 'Number of Targets: 5' },
            { icon: NUMBER_FACT_ICON, text: `Conditions Removed: ${coreValueActive ? 3 : 2}` }, // Core Value: 2 -> 3
            { icon: RADIUS_ICON, text: 'Radius: 600' }
          ],
          facts: []
        }
      case 'Legendary Demon Stance':
        return {
          label,
          description: 'Transfer conditions to nearby enemies. Gain might for each condition transferred.',
          numericLines: [
            { icon: RECHARGE_ICON, text: 'Recharge: 20s' },
            { icon: ALLIED_TARGETS_ICON, text: 'Number of Targets: 5' },
            { icon: NUMBER_FACT_ICON, text: `Conditions Transferred: ${coreValueActive ? 3 : 2}` }, // Core Value: 2 -> 3
            { icon: RADIUS_ICON, text: 'Radius: 600' },
            { icon: NUMBER_FACT_ICON, text: 'Unblockable' }
          ],
          facts: [boonRow('Might', 10, 5)],
          countsTowardTotals: true
        }
      default:
        return null
    }
  }

  return legends
    .filter((l) => equippedLegendIdSet.has(l.id) && l.name in TRUE_NATURE_SKILL_ID_BY_LEGEND_NAME)
    .map(branchFor)
    .filter((b): b is ConditionalBranch => b !== null)
}

/**
 * Specter's F1 "Siphon" (id 63067, the "Steal" replacement `SPECTER_MECHANIC_SKILLS` in
 * `profession-mechanic.ts` already hand-injects into the mechanic bar). TODO.md "Specter Siphon F1
 * Effects" (Leg 2, 2026-09-20): user reported the skill's ally-facing effect doesn't display at all
 * and the enemy-facing effects shown are incomplete. Root cause is the same "empty/stale API facts"
 * shape `otherworldlyBondBranches` documents, not a rendering bug: this app's local `skills.json`
 * entry for 63067 is an unmigrated copy of core Thief's "Steal" (`description: "Steal."`, `facts`
 * carrying only Range/Recharge) rather than Specter's real dual-target Siphon. Verified against the
 * wiki's raw `action=raw` wikitext (fetched 2026-09-20), not a rendered/summarized page.
 *
 * Genuinely 2 mutually exclusive per-cast outcomes depending on the player's current target (enemy
 * vs. ally) — same shape as `otherworldlyBondBranches`, including its `countsTowardTotals` reasoning:
 * neither branch is flagged, since which one fires is a real per-cast choice (what the player targets
 * with F1), not something always sustained.
 *
 * Ally Target's Barrier (wiki: base 1428, coefficient 0.5 x Healing Power) is computed inline rather
 * than through `CURATED_BARRIER_COEFFICIENTS`, same reason `chantOfRecuperationSections` does: that
 * table matches a live API fact by `factText` and this skill has no Barrier fact to match against.
 *
 * Left out as a separate, out-of-scope finding (TODO.md, not fixed here since the user's report was
 * about missing/incomplete effects, not this number): the wiki's own infobox splits Recharge as
 * `recharge = 18` (PvE) vs. `recharge pvp = 25`/`recharge wvw = 25`, but the stale API fact this app's
 * base facts block renders today is a flat 18 with no split at all.
 *
 * Follow-up (same day, user screenshot comparison against a live trait-loaded reference build): the
 * base facts above are only HALF the real tooltip — a live "Steal" or "Siphon" tooltip also folds in
 * every equipped Thief trait that grants its own bonus "when you Steal" (Kleptomaniac/Sleight of
 * Hand/Thrill of the Crime/Even the Odds/Serpent's Touch/Bountiful Theft's own "Boons Stolen" count),
 * per each trait's own wiki `improves skill = Steal, Deadeye's Mark, Siphon, Skritt Swipe` tag — not
 * Specter-specific at all, core Steal (13014) has the exact same gap. Every one of those EXCEPT
 * Sleight of Hand's Daze is a real `classifyBoonCondition`-recognized status or a plain `Number` fact,
 * so it's handled the normal generic way (`data/game-data/synthetic-facts.json` entries on all 4
 * "Steal-family" skill ids — 13014/43390 Deadeye's Mark/63067/77397 Skritt Swipe — gated by
 * `requires_trait`, already flowing through `boonConditionFactsForSkill`/`numericFactLines` with zero
 * new code) rather than through this branch mechanism. Also fixed alongside: `synthetic-facts.json`'s
 * pre-existing Bountiful Theft (1277) copy on those same 4 skills carried the raw pve(5-stack)/
 * wvw+pvp(1-stack) Might duplicate pair unresolved — the trait's own tooltip already had this fixed
 * via `BUFF_INSTANCE_VALUE_OVERRIDES.trait[1277]`, but that lookup keys off the PASSED-IN source
 * (here, the skill), so the fix never reached the skill-side copy; mirrored into
 * `BUFF_INSTANCE_VALUE_OVERRIDES.skill` for all 4 ids. Even the Odds' Vulnerability is native/correct
 * on core Steal already and added synthetically only for 63067 (which lacks it entirely) — Deadeye's
 * Mark/Skritt Swipe carry a separate, STALE native value for it (pre-2024-10-08-patch stack count),
 * a distinct data-staleness gap logged to TODO.md rather than fixed here.
 *
 * Daze (Sleight of Hand, trait 1158) is the one exception: a real `Buff` fact, but Daze is a control
 * effect, not a `classifyBoonCondition`-recognized boon/condition, and `factLine`/`numericFactLines`
 * has no case for raw `Buff`-type facts at all (see that function's own doc comment) — so it has no
 * existing generic path to render through, same "no code path claims this fact type" gap this file's
 * `strengtheningStanzasBranches`/`draconicEchoSections` already work around. Added here instead, as a
 * conditional Enemy Target line gated on `activeTraitIds`.
 */
function siphonSections(
  skill: Skill,
  durationPercent: { boon: number; condition: number },
  healingPower: number,
  activeTraitIds: ReadonlySet<number>
): ConditionalBranch[] {
  const SLEIGHT_OF_HAND_TRAIT_ID = 1158
  const slow: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Slow',
    isCondition: true,
    category: 'condition',
    baseDurationSeconds: 5, // WvW value (PvP 3s)
    scaledDurationSeconds: 5 * (1 + durationPercent.condition / 100),
    applyCount: 1,
    requiresTraitId: null,
    // Steal-style single-enemy target, unchanged from core Thief's own Steal.
    targetCount: 1
  }
  const barrierLine = (): FactLine => ({
    icon: MISCELLANEOUS_ICONS.Barrier,
    text: `Barrier: ${Math.round(1428 + 0.5 * healingPower).toLocaleString()}`
  })

  return [
    {
      label: 'Enemy Target',
      description: "Steal your foe's shadow, slowing them for a period of time while gaining shadow force.",
      numericLines: [
        // Shadow Force isn't a tracked boon/condition in this app — display-only, same treatment
        // `chantOfActionSections`'s own "Motivation Cost per Interval" lines get.
        { icon: null, text: 'Shadow Force Gain: 25%' }, // WvW+PvE value (PvP 15%)
        // Sleight of Hand (1158): Daze has no generic Buff-fact render path — see this function's
        // own doc comment.
        ...(activeTraitIds.has(SLEIGHT_OF_HAND_TRAIT_ID) ? [{ icon: null, text: 'Daze: 1s (Sleight of Hand)' }] : [])
      ],
      facts: [slow]
    },
    {
      label: 'Ally Target',
      description: 'Grant your target barrier and reduce the cooldown of Siphon. If you are in shroud, transfer your tether to the target.',
      numericLines: [
        barrierLine(),
        { icon: null, text: 'Shrouded Ally: transfers tether to target' },
        { icon: RECHARGE_ICON, text: 'Ally Target Recharge Reduction: 50%' }
      ],
      facts: []
    }
  ]
}

/**
 * Specter Scepter skill 3's off-hand-Pistol variant, Measured Shot (63267, id-verified 2026-09-20
 * fixing `weapon-calc/weapon-skills.ts`' resolver — see TODO.md "Specter Scepter/Pistol Skill 3
 * Display"). Same "empty/stale API facts" shape `siphonSections` documents: this app's local
 * `skills.json` entry carries only Range/Maximum Travel Distance — every real Enemy/Ally-branch
 * number (both scepter skill-3 variants share the identical "hinders foes and helps allies" kit,
 * reworked 2023-06-27 to add the radius/allied-targets falloff mechanic) lives entirely in the
 * wiki's raw `{{skill fact}}` templates (fetched fresh 2026-09-20 via `action=raw`, not a
 * rendered/summarized page). WvW+PvP values used throughout (this app's usual convention) wherever
 * a fact carries a PvE/WvW/PvP split.
 *
 * Damage's own `weapon=scepter|coefficient=0.33` isn't computed to a real number here — same
 * "would need `power`/`targetArmor` threaded through this whole call chain" gap
 * `trueNatureBranches`' own doc comment already flags as a follow-up, not a guess — shown as a bare
 * coefficient line instead.
 *
 * "Pierces up to 4 targets" is the wiki page's own Notes prose (no `{{skill fact}}` template gives
 * a numeric enemy target count for this skill), used as this app's best available number for the
 * tracked Immobile fact's `targetCount` — same "take an explicit prose number over inventing one"
 * precedent `flipTargetSkills`'/`otherworldlyBondBranches`' own quoted narrative descriptions set.
 *
 * The Healing shot (Ally Target) isn't a tracked boon/condition — shown as a computed
 * `baseValue + coefficient * healingPower` numeric line only, same convention
 * `chantOfRecuperationSections`'s own Healing lines use for the identical "no matching live
 * Healing/AttributeAdjust fact to attach a coefficient to" reason.
 */
function measuredShotSections(skill: Skill, durationPercent: { boon: number; condition: number }, healingPower: number): ConditionalBranch[] {
  const immobile: BoonConditionSource = {
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: 'Immobile',
    isCondition: true,
    category: 'condition',
    baseDurationSeconds: 1, // no PvE/WvW/PvP split
    scaledDurationSeconds: 1 * (1 + durationPercent.condition / 100),
    applyCount: 1,
    requiresTraitId: null,
    // Wiki Notes: "Pierces up to 4 targets" — no structured target-count fact given.
    targetCount: 4
  }
  const healLine = (): FactLine => ({
    icon: HEALING_ICON,
    text: `Healing: ${Math.round(1441 + 0.444 * healingPower).toLocaleString()}` // WvW+PvP base (PvE 2151)
  })

  return [
    {
      label: 'Enemy Target',
      description: 'Shadowstep away from your target and launch a shot that immobilizes enemies.',
      numericLines: [
        { icon: null, text: 'Damage Coefficient: 0.33 (scepter)' },
        { icon: null, text: 'Maximum Distance from Target: 900' }
      ],
      facts: [immobile]
    },
    {
      label: 'Ally Target',
      description: 'Shadowstep toward your target and launch a healing shot. Effectiveness is reduced for allies that are not the primary target.',
      numericLines: [
        healLine(),
        { icon: null, text: 'Effectiveness Decreased (secondary targets): 25%' }, // WvW+PvP value (PvE 50%)
        { icon: ALLIED_TARGETS_ICON, text: 'Allied Targets: 5' },
        { icon: RADIUS_ICON, text: 'Radius: 240' },
        { icon: null, text: 'Maximum Distance from Ally: 80' },
        { icon: null, text: 'Unblockable' }
      ],
      facts: []
    }
  ]
}

/**
 * Measured Shot's flip target, Endless Night (63128) — same finding/session as
 * `measuredShotSections` above (see its doc comment for the shared root cause and sourcing method).
 * Live-verified this skill's ally-branch Vigor/Quickness split is a genuine per-game-mode BOON
 * swap, not just a duration difference (2025-02-11 patch note: "This skill now applies vigor
 * instead of quickness in WvW only") — PvE and WvW both grant Vigor (1s/0.5s), only PvP grants
 * Quickness (0.5s) instead. This app's WvW-first convention picks Vigor (the WvW value), so
 * Quickness is deliberately left out entirely rather than shown as if it always applies.
 *
 * "Up to 3 enemy targets"/"one allied target" both come from the wiki's own Mechanics section
 * prose (no structured `{{skill fact}}` target-count template for either branch) — same "prose
 * number over invented one" precedent `measuredShotSections`' own Immobile `targetCount` uses. The
 * app's pre-existing base `facts` array's own "Number of Targets: 1" is the PRE-2023-06-27-rework
 * value (core single-target beam, before the ally-radius/allied-targets falloff mechanic existed)
 * — stale for the Ally Target branch's real 5-target reach, left untouched on the base facts block
 * since `NUMERIC_FACT_WVW_OVERRIDES`-style per-mode correction is out of this fix's scope (TODO.md).
 */
function endlessNightSections(skill: Skill, durationPercent: { boon: number; condition: number }, healingPower: number): ConditionalBranch[] {
  const enemyRow = (name: 'Slow' | 'Torment', baseDurationSeconds: number): BoonConditionSource => ({
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
    targetCount: 3 // wiki Mechanics: "up to 3 enemy targets"
  })
  const allyRow = (name: 'Regeneration' | 'Vigor', baseDurationSeconds: number): BoonConditionSource => ({
    sourceKind: 'skill',
    sourceId: skill.id,
    sourceName: skill.name,
    sourceIcon: skill.icon,
    boonOrConditionName: name,
    isCondition: false,
    category: 'boon',
    baseDurationSeconds,
    scaledDurationSeconds: baseDurationSeconds * (1 + durationPercent.boon / 100),
    applyCount: 1,
    requiresTraitId: null,
    targetCount: 5 // "Allied Targets: 5" numeric line below
  })
  const barrierLine = (): FactLine => ({
    icon: MISCELLANEOUS_ICONS.Barrier,
    text: `Barrier: ${Math.round(645 + 0.22 * healingPower).toLocaleString()}` // no PvE/WvW/PvP split
  })

  return [
    {
      label: 'Enemy Target',
      description: 'Deal damage and inflict conditions.',
      numericLines: [
        { icon: null, text: 'Damage Coefficient: 0.33 (scepter)' },
        { icon: NUMBER_FACT_ICON, text: 'Number of Hits: 7' }
      ],
      facts: [
        enemyRow('Slow', 0.5), // WvW value (PvE 1.5s, PvP 0.25s)
        enemyRow('Torment', 6) // WvW value, grouped with PvE (PvP 5s)
      ]
    },
    {
      label: 'Ally Target',
      description: 'Grant your target barrier and boons. Effectiveness is reduced for allies that are not the primary target.',
      numericLines: [
        barrierLine(),
        { icon: null, text: 'Effectiveness Decreased (secondary targets): 25%' }, // WvW+PvP value (PvE 50%)
        { icon: NUMBER_FACT_ICON, text: 'Number of Impacts: 7' },
        { icon: ALLIED_TARGETS_ICON, text: 'Allied Targets: 5' },
        { icon: RADIUS_ICON, text: 'Radius: 240' }
      ],
      facts: [
        allyRow('Regeneration', 1), // WvW+PvP value (PvE 3s)
        allyRow('Vigor', 0.5) // WvW value (PvE 1s; PvP grants Quickness 0.5s instead — see doc comment)
      ]
    }
  ]
}

/**
 * Specter Scepter skill 1's 3-part autoattack chain — Shadow Bolt (63066) -> Double Bolt (63182) ->
 * Triple Bolt (63134), per each skill's own wiki infobox `chain1`/`chain2`/`chain3` fields
 * (id-verified 2026-09-20, TODO.md "Specter Scepter Auto Chain Display"). Same "empty/stale API
 * facts" shape `measuredShotSections`/`siphonSections` already document: this app's local
 * `skills.json` entries for all 3 carry only Range (plus Double/Triple Bolt's own "Number of
 * Impacts") — every real Enemy/Ally-branch number comes from the wiki's raw `{{skill fact}}`
 * templates (fetched fresh 2026-09-20 via `action=raw`). WvW+PvP values used throughout (this app's
 * usual convention); at WvW+PvP, Damage Coefficient (0.33), Torment duration (2s) and Barrier (365
 * base / 0.07 coefficient) are identical across all 3 chain steps — only PvE (unused here) and the
 * chain-step hit count actually vary, so one shared helper covers all 3.
 *
 * Separately, `flip-skill-overrides.ts`'s `FLIP_SKILL_OVERRIDES` now redirects Shadow Bolt's own
 * `flipSkill` — the live API points it at Shadowsquall (63314, the Stealth Attack replacement for
 * this weapon slot) instead of Double Bolt, the real next chain step confirmed by all 3 skills' own
 * wiki `chain1`/`chain2`/`chain3` fields. Every other weapon-1 autoattack's `flipSkill` in this
 * app's data either walks a real further chain step (e.g. Dagger's Double Strike -> Wild Strike) or,
 * when the chain is only 1 hit long, the Stealth Attack instead (e.g. Pistol's Vital Shot -> Sneak
 * Attack) — Scepter is the one case where the API chose the Stealth Attack over a real further chain
 * step that does exist. Without that redirect, `flipTargetSkills`'s tooltip walk (and
 * `withFlipChain`'s aggregate walk) stop at Shadowsquall and never reach Double/Triple Bolt at all —
 * the exact bug reported ("2nd/3rd chain parts aren't shown at all — Shadowsquall displays
 * instead"). Shadowsquall itself is deliberately left uncurated and unreachable from this chain,
 * same as every other weapon's Stealth Attack (Backstab, Sneak Attack, Tactical Strike, etc.) — none
 * of those are shown anywhere in the app today either, a pre-existing, accepted gap outside this
 * leg's scope.
 */
function scepterAutoBoltSections(
  skill: Skill,
  durationPercent: { boon: number; condition: number },
  healingPower: number,
  numberOfImpacts: number | null
): ConditionalBranch[] {
  const barrierLine = (): FactLine => ({
    icon: MISCELLANEOUS_ICONS.Barrier,
    text: `Barrier: ${Math.round(365 + 0.07 * healingPower).toLocaleString()}` // WvW+PvP value (PvE 522 base, 0.1 coefficient)
  })
  const impactsLine = (label: string): FactLine[] =>
    numberOfImpacts === null ? [] : [{ icon: NUMBER_FACT_ICON, text: `${label}: ${numberOfImpacts}` }]

  return [
    {
      label: 'Enemy Target',
      description: 'Fire a projectile that hinders foes and helps allies.',
      numericLines: [{ icon: null, text: 'Damage Coefficient: 0.33 (scepter)' }, ...impactsLine('Number of Hits')],
      facts: [
        {
          sourceKind: 'skill',
          sourceId: skill.id,
          sourceName: skill.name,
          sourceIcon: skill.icon,
          boonOrConditionName: 'Torment',
          isCondition: true,
          category: 'condition',
          baseDurationSeconds: 2, // WvW+PvP value (PvE 4s Shadow Bolt/Double Bolt, 5s Triple Bolt)
          scaledDurationSeconds: 2 * (1 + durationPercent.condition / 100),
          applyCount: 1,
          requiresTraitId: null,
          targetCount: 1
        }
      ]
    },
    {
      label: 'Ally Target',
      description: 'Missiles track and grant barrier to allies. Effectiveness is reduced for allies that are not the primary target.',
      numericLines: [
        barrierLine(),
        { icon: null, text: 'Effectiveness Decreased (secondary targets): 50%' },
        ...impactsLine('Number of Impacts'),
        { icon: ALLIED_TARGETS_ICON, text: 'Allied Targets: 5' },
        { icon: RADIUS_ICON, text: 'Radius: 240' },
        { icon: null, text: 'Unblockable' }
      ],
      facts: []
    }
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
 *
 * `activeTraitIds`/`equippedLegendIds`/`legends` (added 2026-08-20 for `trueNatureBranches`, see its
 * own doc comment) default to empty so every pre-existing call site keeps compiling unchanged —
 * only Facet of Nature's own branch actually reads them.
 */
export function branchConditionalFacts(
  skill: Skill,
  durationPercent: { boon: number; condition: number },
  healingPower: number,
  activeTraitIds: ReadonlySet<number> = new Set(),
  equippedLegendIds: ReadonlySet<string> = new Set(),
  legends: Legend[] = []
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
  if (skill.id === RADIANT_JUSTICE_ID) return radiantJusticeSections(skill, durationPercent)
  if (skill.id === RADIANT_RESOLVE_ID) return radiantResolveSections(skill, durationPercent, healingPower)
  if (skill.id === RADIANT_COURAGE_ID) return radiantCourageSections(skill, durationPercent)
  if (skill.id === FACET_OF_NATURE_ID) return trueNatureBranches(skill, equippedLegendIds, legends, activeTraitIds, durationPercent)
  if (skill.id === SIPHON_ID) return siphonSections(skill, durationPercent, healingPower, activeTraitIds)
  if (skill.id === MEASURED_SHOT_ID) return measuredShotSections(skill, durationPercent, healingPower)
  if (skill.id === ENDLESS_NIGHT_ID) return endlessNightSections(skill, durationPercent, healingPower)
  if (skill.id === SHADOW_BOLT_ID) return scepterAutoBoltSections(skill, durationPercent, healingPower, null)
  if (skill.id === DOUBLE_BOLT_ID) return scepterAutoBoltSections(skill, durationPercent, healingPower, 2)
  if (skill.id === TRIPLE_BOLT_ID) return scepterAutoBoltSections(skill, durationPercent, healingPower, 3)
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
 * Draconic Echo (Revenant/Herald Master trait, id 1772): "You retain your facet passives for a
 * duration after using their consume skills. Your facet passives grant you additional bonuses."
 * Flagged 2026-08-19 by the user ("draconic echoes doesn't display full details"). The live API's
 * own `facts` carry the Recharge/Duration numbers fine (already rendered by `numericFactLines`) but
 * name each of the 6 facet passives only as bare `Buff` markers with `duration: 0` and no numbers
 * (`status: "Facet of Light"`, etc.) — not a real `classifyBoonCondition` status, so both
 * `numericFactLines` (no case for `Buff`-type facts at all) and `boonConditionFactsForTrait`
 * (`classify` returns null for a made-up marker name) silently drop all 6, same "empty/marker API
 * facts" shape `strengtheningStanzasBranches` above already documents for the Chant markers. Every
 * percent below is wiki-only (raw wikitext, fetched 2026-08-19): each facet has a plain pve(10%)/
 * wvw+pvp(5%) split with no `alt=` wording. Not tracked boon/condition sources (Damage/Condition
 * Damage/Critical Chance/Boon Duration/Healing-to-others/incoming-damage-reduction aren't any of
 * this app's `BOON_NAMES`/`CONDITION_NAMES`), so every branch's `facts` stays empty — same
 * "display-only" treatment `strengtheningStanzasBranches`'s own bonus lines get. Unlike that
 * trait's branches (only one Refrain is ever active, genuinely mutually exclusive), all 6 facets
 * here can be simultaneously true — this still reuses the labeled-divider mechanism for the display
 * treatment (one small section per facet) even though "branch" undersells that they can co-occur;
 * nothing about the rendering claims otherwise.
 */
function draconicEchoSections(): ConditionalBranch[] {
  const facet = (name: string, text: string): ConditionalBranch => ({
    label: `Facet of ${name}`,
    numericLines: [{ icon: null, text: `${text} (WvW+PvP; PvE 10%/-10%)` }],
    facts: []
  })
  return [
    facet('Light', '+5% Healing Increase to Others'),
    facet('Darkness', '+5% Critical Chance'),
    facet('Elements', '+5% Condition Damage'),
    facet('Strength', '+5% Damage'),
    facet('Chaos', '-5% Incoming Damage, -5% Incoming Condition Damage'),
    facet('Nature', '+5% Boon Duration')
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
  if (trait.id === DRACONIC_ECHO_ID) return draconicEchoSections()
  return null
}
