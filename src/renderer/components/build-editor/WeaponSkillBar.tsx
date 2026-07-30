import type { Build } from '@shared/types'
import { boonConditionFactsForSkill } from '@shared/boon-calc/sources'
import { weaponSkillIdsForPair } from '@shared/weapon-calc/weapon-skills'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { skillTooltipContent, useDurationContext } from './SkillsEditor'

interface Props {
  build: Build
  onBuildChange: (patch: Partial<Pick<Build, 'environment' | 'activeWeaponSet' | 'activeUnderwaterSet'>>) => void
}

/**
 * The weapon-derived half of the skill bar: an ENVIRONMENT toggle (land/underwater) and, within
 * that, a toggle for which weapon-swap set is currently displayed (both sets always contribute
 * to boon/condition totals — see `Build.activeWeaponSet` — this toggle is display-only, same as
 * the Revenant legend-bar toggle it mirrors). Applies to every profession; weapon skills are
 * orthogonal to the Heal/Utility/Elite (or Legend) mechanic rendered above it.
 */
export function WeaponSkillBar({ build, onBuildChange }: Props) {
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { professions, skillsById } = gameData
  const profession = professions.find((p) => p.id === build.profession)

  const isLand = build.environment === 'land'
  const mainKey = isLand ? (build.activeWeaponSet === 'A' ? 'weaponA1' : 'weaponB1') : build.activeUnderwaterSet === 'U1' ? 'weaponU1' : 'weaponU2'
  const offKey = isLand ? (build.activeWeaponSet === 'A' ? 'weaponA2' : 'weaponB2') : null

  const mainType = build.equipment[mainKey]?.weaponType
  const offType = offKey ? build.equipment[offKey]?.weaponType : undefined
  const mainWeapon = mainType && profession ? profession.weapons[mainType] : undefined
  const offWeapon = offType && profession ? profession.weapons[offType] : mainWeapon

  const skillIds = profession ? weaponSkillIdsForPair(mainWeapon, offWeapon, build.environment, skillsById) : []
  const hasAnyWeapon = mainWeapon !== undefined || offWeapon !== undefined

  function skillTooltipFor(skillId: number) {
    const skill = skillsById.get(skillId)
    if (!skill) return null
    const facts = boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
    return skillTooltipContent(skill, facts)
  }

  return (
    <div className="weapon-skill-bar">
      <div className="legend-bar-toggle">
        <button
          type="button"
          className={isLand ? 'legend-toggle-button active' : 'legend-toggle-button'}
          onClick={() => onBuildChange({ environment: 'land' })}
        >
          Land
        </button>
        <button
          type="button"
          className={!isLand ? 'legend-toggle-button active' : 'legend-toggle-button'}
          onClick={() => onBuildChange({ environment: 'underwater' })}
        >
          Underwater
        </button>
      </div>

      <div className="legend-bar-toggle">
        {isLand ? (
          <>
            <button
              type="button"
              className={build.activeWeaponSet === 'A' ? 'legend-toggle-button active' : 'legend-toggle-button'}
              onClick={() => onBuildChange({ activeWeaponSet: 'A' })}
            >
              Weapon I
            </button>
            <button
              type="button"
              className={build.activeWeaponSet === 'B' ? 'legend-toggle-button active' : 'legend-toggle-button'}
              onClick={() => onBuildChange({ activeWeaponSet: 'B' })}
            >
              Weapon II
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={build.activeUnderwaterSet === 'U1' ? 'legend-toggle-button active' : 'legend-toggle-button'}
              onClick={() => onBuildChange({ activeUnderwaterSet: 'U1' })}
            >
              Set 1
            </button>
            <button
              type="button"
              className={build.activeUnderwaterSet === 'U2' ? 'legend-toggle-button active' : 'legend-toggle-button'}
              onClick={() => onBuildChange({ activeUnderwaterSet: 'U2' })}
            >
              Set 2
            </button>
          </>
        )}
      </div>

      <div className="skill-bar">
        {hasAnyWeapon ? (
          skillIds.map((skillId, i) => {
            const skill = skillId !== null ? skillsById.get(skillId) : undefined
            return (
              <Tooltip
                key={i}
                content={skill ? (skillTooltipFor(skill.id) ?? <TooltipBody title="Unknown skill" />) : <TooltipBody title="Empty" />}
              >
                <button type="button" className="skill-slot-button" disabled>
                  {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">—</span>}
                </button>
              </Tooltip>
            )
          })
        ) : (
          <div className="skill-picker-header">Choose a weapon in the Equipment panel to see its skill bar</div>
        )}
      </div>
    </div>
  )
}
