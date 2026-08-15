import type { Skill } from '../types'
import type { BoonConditionSource } from '../boon-calc/sources'
import { BOON_CONDITION_ICONS } from '../boon-calc/icons'
import type { FactLine } from './fact-numbers'

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
  numericLines: FactLine[]
  facts: BoonConditionSource[]
}

const RANGE_ICON = 'https://render.guildwars2.com/file/0AAB34BEB1C9F4A25EC612DDBEACF3E20B2810FA/156666.png'
const RADIUS_ICON = 'https://render.guildwars2.com/file/B0CD8077991E4FB1622D2930337ED7F9B54211D5/156665.png'
const ALLIED_TARGETS_ICON = 'https://render.guildwars2.com/file/BBE8191A494B0352259C10EADFDACCE177E6DA5B/1770208.png'
// "Duration" and "Fuse Time" facts share this same clock icon across every skill that carries either
// (confirmed against Blossoming Aura's own Fuse Time fact, id 71816) — reused here since Otherworldly
// Bond's own "Duration: 7 seconds" line has no live API fact to pull an icon from at all.
const DURATION_ICON = 'https://render.guildwars2.com/file/7B2193ACCF77E56C13E608191B082D68AA0FAA71/156659.png'
const INTERVAL_ICON = 'https://render.guildwars2.com/file/B75E91EB22E0DFCC1D08030204055946506D56F6/1770206.png'

/**
 * Otherworldly Bond (Revenant scepter 3, id 71952): a tether the player casts at EITHER an ally or
 * an enemy (their choice at cast time), escalating over 3 time tiers while it survives (0-2s/2-4s/
 * 4-6s, severed early by range or a weapon swap, 7s max). The live API's own `facts` array for this
 * skill carries only Range/Recharge — every other number here is transcribed from the real in-game
 * tooltip (both branches shown together, exactly as the client renders them, screenshot supplied
 * 2026-08-14) since the GW2 API exposes nothing else to pull from.
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
      numericLines: [
        { icon: DURATION_ICON, text: 'Duration: 7 seconds' },
        { icon: INTERVAL_ICON, text: 'Interval: 1 second' }
      ],
      facts: [conditionRow('Vulnerability', 8), conditionRow('Crippled', 1), conditionRow('Slow', 1)]
    },
    {
      label: 'Ally Target',
      numericLines: [
        // The wiki/in-game tooltip itself keeps this one as flat descriptive text rather than a
        // scaled duration row — it describes an escalating per-tier stack/attribute combination
        // ("Level" 1/2/3, each 5 stacks × 4s), not a single fixed application this app's
        // BoonConditionSource shape (one status, one duration) could represent without inventing
        // numbers the tooltip doesn't actually give.
        { icon: BOON_CONDITION_ICONS.Might, text: 'Might Stacks per Level (5x4s): 20 Condition Damage, 40 Power' },
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
          baseDurationSeconds: 3,
          scaledDurationSeconds: 3 * (1 + durationPercent.boon / 100),
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
 * Per-skill mutually-exclusive-outcome fact sections for `skillTooltipContent` to render as extra
 * labeled dividers below the base facts — `null` for every skill without one. Only Otherworldly Bond
 * needs this today; kept as its own lookup (rather than folded into `synthetic-facts.json`) since
 * that file's shape has no concept of "these facts are alternatives, not simultaneous" — see this
 * function's own id check and `otherworldlyBondBranches`'s doc comment for why a flat merge would
 * misrepresent this specific skill. A future skill with the same "one cast, mutually exclusive
 * branches" shape (e.g. Twin Moon Sweep, COMPLETED.md Session 130) could reuse this same mechanism.
 */
export function branchConditionalFacts(skill: Skill, durationPercent: { boon: number; condition: number }): ConditionalBranch[] | null {
  if (skill.id === 71952) return otherworldlyBondBranches(skill, durationPercent)
  return null
}
