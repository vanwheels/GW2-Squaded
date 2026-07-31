import type { Build, TomeChapter } from '@shared/types'
import { boonConditionFactsForSkill, tomeChapterBoonSources } from '@shared/boon-calc/sources'
import { weaponSkillIdsForPair } from '@shared/weapon-calc/weapon-skills'
import { bundleCapableSkillIds, resolveActiveBundle } from '@shared/skill-calc/bundle-skills'
import { professionMechanicBar } from '@shared/skill-calc/profession-mechanic'
import { formatFactLine } from '@shared/gear-calc/relic-effects-format'
import { isBoonName, isConditionName } from '@shared/boon-calc/constants'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { factsBlock, skillTooltipContent, useDurationContext, type SkillVariantContext } from './SkillsEditor'

interface Props {
  build: Build
  equippedSpecializationIds: ReadonlySet<number>
  onBuildChange: (patch: Partial<Pick<Build, 'environment' | 'activeWeaponSet' | 'activeUnderwaterSet' | 'activeBundleSkillId'>>) => void
}

/**
 * The weapon-derived half of the skill bar: an ENVIRONMENT toggle (land/underwater) and, within
 * that, a toggle for which weapon-swap set is currently displayed (both sets always contribute
 * to boon/condition totals — see `Build.activeWeaponSet` — this toggle is display-only, same as
 * the Revenant legend-bar toggle it mirrors). Applies to every profession; weapon skills are
 * orthogonal to the Heal/Utility/Elite (or Legend) mechanic rendered above it.
 *
 * When the build has any equipped Engineer Kit or (for Firebrand) an available Tome — see
 * `bundle-skills.ts` — an extra toggle row lets the displayed 1-5 bar be swapped to that bundle's
 * own 5 skills instead, matching the real in-game "kit/tome replaces your weapon skills while
 * active" mechanic. Every equipped kit/tome always contributes to boon/condition totals regardless
 * of this toggle (see `Build.activeBundleSkillId`'s doc comment) — this only changes what's shown.
 */
export function WeaponSkillBar({ build, equippedSpecializationIds, onBuildChange }: Props) {
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { professions, skillsById, tomeChapters } = gameData
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
  const variantContext: SkillVariantContext = { skills: gameData.skills, skillsById, wvwFactOverrides: gameData.wvwFactOverrides, durationPercent }

  const mechanicBarSkillIds = profession ? professionMechanicBar(profession, skillsById, equippedSpecializationIds).map((e) => e.skill.id) : []
  const bundleCapableIds = bundleCapableSkillIds(build, skillsById, tomeChapters, mechanicBarSkillIds)
  const activeBundleId = build.activeBundleSkillId !== null && bundleCapableIds.includes(build.activeBundleSkillId) ? build.activeBundleSkillId : null
  const activeBundle = activeBundleId !== null ? resolveActiveBundle(build, skillsById, tomeChapters, build.environment) : null

  function skillTooltipFor(skillId: number) {
    const skill = skillsById.get(skillId)
    if (!skill) return null
    const facts = boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
    return skillTooltipContent(skill, facts, activeIds, variantContext)
  }

  function tomeChapterTooltip(chapter: TomeChapter) {
    const boonFacts = tomeChapterBoonSources(chapter, durationPercent)
    const boonNames = new Set(boonFacts.map((f) => f.boonOrConditionName))
    const numericLines = chapter.facts
      .filter((f) => !(isBoonName(f.label) || isConditionName(f.label)) || !boonNames.has(f.label.charAt(0).toUpperCase() + f.label.slice(1)))
      .map(formatFactLine)
    return (
      <>
        <TooltipBody title={chapter.name} description={chapter.description} />
        {factsBlock(numericLines, boonFacts)}
      </>
    )
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

      {bundleCapableIds.length > 0 && (
        <div className="legend-bar-toggle">
          <button
            type="button"
            className={activeBundleId === null ? 'legend-toggle-button active' : 'legend-toggle-button'}
            onClick={() => onBuildChange({ activeBundleSkillId: null })}
          >
            Weapon
          </button>
          {bundleCapableIds.map((id) => {
            const skill = skillsById.get(id)
            return (
              <button
                key={id}
                type="button"
                className={activeBundleId === id ? 'legend-toggle-button active' : 'legend-toggle-button'}
                onClick={() => onBuildChange({ activeBundleSkillId: id })}
              >
                {skill?.name ?? `#${id}`}
              </button>
            )
          })}
        </div>
      )}

      <div className="skill-bar">
        {activeBundle ? (
          activeBundle.slots.map((slot, i) => {
            if (slot === null) {
              return (
                <Tooltip key={i} content={<TooltipBody title="Empty" />}>
                  <button type="button" className="skill-slot-button" disabled>
                    <span className="skill-slot-placeholder">—</span>
                  </button>
                </Tooltip>
              )
            }
            if (slot.kind === 'kit') {
              return (
                <Tooltip key={i} content={skillTooltipFor(slot.skill.id) ?? <TooltipBody title="Unknown skill" />}>
                  <button type="button" className="skill-slot-button" disabled>
                    <img src={slot.skill.icon} alt={slot.skill.name} />
                  </button>
                </Tooltip>
              )
            }
            return (
              <Tooltip key={i} content={tomeChapterTooltip(slot.chapter)}>
                <button type="button" className="skill-slot-button" disabled>
                  <img src={slot.chapter.icon} alt={slot.chapter.name} />
                </button>
              </Tooltip>
            )
          })
        ) : hasAnyWeapon ? (
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
