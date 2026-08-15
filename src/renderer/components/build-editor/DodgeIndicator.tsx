import type { Build } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { daredevilDodgeContent, relicDodgeContent, vindicatorDodgeContent } from '@shared/skill-calc/dodge-replacement-facts'
import type { DodgeReplacementContent } from '@shared/skill-calc/dodge-replacement-facts'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { factsBlock, useDurationContext } from './SkillsEditor'

interface Props {
  build: Build
  combatState?: CombatState
}

/**
 * TODO.md's dodge-roll item, Problem 2's proposed UI treatment: "a small visual indicator above the
 * skill bar (not a real skill slot) with its own custom tooltip for whatever a build's dodge grants
 * beyond the normal evade frames." Renders 0-2 rows: `vindicatorDodgeContent`/`daredevilDodgeContent`
 * (Problem 2, keyed by active traits) can never both have content for the same build (different
 * professions entirely), so at most one of those two ever fires — but `relicDodgeContent` (Problem
 * 3, added 2026-08-15, keyed by the equipped relic instead) is profession-agnostic and can co-occur
 * with either, e.g. a Vindicator running Relic of Rivers, so this renders every non-`null` content
 * as its own row rather than picking just one. Not a real `skill-slot-button` — deliberately smaller
 * and unclickable, since there's no `Build` field this could ever toggle.
 */
export function DodgeIndicator({ build, combatState }: Props) {
  const { gameData, activeIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)

  const professionContent =
    vindicatorDodgeContent(activeIds, characterAttributes.power, characterAttributes.healingPower, targetArmor, durationPercent) ??
    daredevilDodgeContent(activeIds)
  const relicContent = relicDodgeContent(build.relicId, gameData.relicsById, gameData.relicEffects)
  const contents = [professionContent, relicContent].filter((c): c is DodgeReplacementContent => c !== null)

  if (contents.length === 0) return null

  return (
    <>
      {contents.map((content, i) => (
        <div className="dodge-indicator-bar" key={i}>
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
      ))}
    </>
  )
}
