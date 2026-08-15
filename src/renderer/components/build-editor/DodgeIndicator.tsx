import type { Build } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { daredevilDodgeContent, vindicatorDodgeContent } from '@shared/skill-calc/dodge-replacement-facts'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { factsBlock, useDurationContext } from './SkillsEditor'

interface Props {
  build: Build
  combatState?: CombatState
}

/**
 * TODO.md's dodge-roll item, Problem 2's proposed UI treatment: "a small visual indicator above the
 * skill bar (not a real skill slot) with its own custom tooltip for whatever a build's dodge grants
 * beyond the normal evade frames." Renders 0 or 1 icon — `dodge-replacement-facts.ts`'s 2 content
 * functions each independently return `null` when their spec/trait isn't active, and Vindicator's
 * Tenacious Ruin (always active once the spec line is equipped) and Daredevil's 3 GM traits (only one
 * tier, mutually exclusive) can never both be true for the same build (different professions
 * entirely), so at most one of the two ever has content. Not a real `skill-slot-button` — deliberately
 * smaller and unclickable, since there's no `Build` field this could ever toggle.
 */
export function DodgeIndicator({ build, combatState }: Props) {
  const { activeIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)

  const content =
    vindicatorDodgeContent(activeIds, characterAttributes.power, characterAttributes.healingPower, targetArmor, durationPercent) ??
    daredevilDodgeContent(activeIds)

  if (!content) return null

  return (
    <div className="dodge-indicator-bar">
      <Tooltip
        content={
          <>
            <TooltipBody title={content.name} description={content.description} icon={content.icon} />
            {factsBlock(content.numericLines, content.facts)}
          </>
        }
      >
        <span className="dodge-indicator-icon">
          <img src={content.icon} alt={content.name} />
        </span>
      </Tooltip>
      <span className="dodge-indicator-label">Dodge: {content.name}</span>
    </div>
  )
}
