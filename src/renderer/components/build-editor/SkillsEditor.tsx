import { useMemo, useState } from 'react'
import type { Build, RevenantSkillSelection, Skill, SkillSelection, StandardSkillSelection } from '@shared/types'
import { activeTraitIds, boonConditionFactsForSkill, type BoonConditionSource } from '@shared/boon-calc/sources'
import { formatBoonDuration } from '@shared/boon-calc/format'
import { boonDurationPercent, computeGearAttributeTotals, conditionDurationPercent } from '@shared/gear-calc/attribute-totals'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { WeaponSkillBar } from './WeaponSkillBar'

interface Props {
  build: Build
  value: SkillSelection
  onChange: (value: SkillSelection) => void
  onBuildChange: (patch: Partial<Pick<Build, 'environment' | 'activeWeaponSet' | 'activeUnderwaterSet'>>) => void
  equippedSpecializationIds: ReadonlySet<number>
}

type SlotId = 'heal' | 'utility0' | 'utility1' | 'utility2' | 'elite'

export function SkillsEditor({ build, value, onChange, onBuildChange, equippedSpecializationIds }: Props) {
  return (
    <div className="skills-editor-root">
      {value.kind === 'revenant' ? (
        <RevenantSkillsEditor
          build={build}
          value={value}
          onChange={onChange}
          equippedSpecializationIds={equippedSpecializationIds}
        />
      ) : (
        <StandardSkillsEditor
          build={build}
          value={value}
          onChange={onChange}
          equippedSpecializationIds={equippedSpecializationIds}
        />
      )}
      <WeaponSkillBar build={build} onBuildChange={onBuildChange} />
    </div>
  )
}

/** Shared by both editors: activeTraitIds + gear-derived boon/condition duration %, needed to
 *  compute a skill's scaled boon/condition tooltip facts the same way `BoonUptimePanel` does. */
export function useDurationContext(build: Build) {
  const gameData = useGameData()
  const activeIds = useMemo(() => activeTraitIds(build, gameData.traits), [build, gameData.traits])
  const durationPercent = useMemo(() => {
    const totals = computeGearAttributeTotals(build, gameData.itemStats)
    return { boon: boonDurationPercent(totals), condition: conditionDurationPercent(totals) }
  }, [build, gameData.itemStats])
  return { gameData, activeIds, durationPercent }
}

export function skillTooltipContent(skill: Skill, facts: BoonConditionSource[]) {
  return (
    <>
      <TooltipBody title={skill.name} description={skill.description} />
      {facts.length > 0 && (
        <ul className="tooltip-boon-facts">
          {facts.map((f, i) => (
            <li key={i}>
              <span>{f.boonOrConditionName}</span>
              <span className="boon-source-duration">
                {formatBoonDuration(f.scaledDurationSeconds)}s
                {f.applyCount > 1 ? ` × ${f.applyCount}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

interface StandardProps {
  build: Build
  value: StandardSkillSelection
  onChange: (value: SkillSelection) => void
  equippedSpecializationIds: ReadonlySet<number>
}

function StandardSkillsEditor({ build, value, onChange, equippedSpecializationIds }: StandardProps) {
  const profession = build.profession
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { skillsById, skillsForProfessionAndSlot } = gameData
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null)

  const healOptions = skillsForProfessionAndSlot(profession, 'Heal', equippedSpecializationIds)
  const utilityOptions = skillsForProfessionAndSlot(profession, 'Utility', equippedSpecializationIds)
  const eliteOptions = skillsForProfessionAndSlot(profession, 'Elite', equippedSpecializationIds)

  function skillFacts(skill: Skill): BoonConditionSource[] {
    return boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
  }

  function setUtility(slotIndex: 0 | 1 | 2, skillId: number | null): void {
    const utility: StandardSkillSelection['utility'] = [...value.utility]
    utility[slotIndex] = skillId
    onChange({ ...value, utility })
  }

  function slotConfig(slot: SlotId): { label: string; chosenId: number | null; options: Skill[]; select: (id: number | null) => void } {
    switch (slot) {
      case 'heal':
        return { label: 'Heal', chosenId: value.heal, options: healOptions, select: (id) => onChange({ ...value, heal: id }) }
      case 'elite':
        return { label: 'Elite', chosenId: value.elite, options: eliteOptions, select: (id) => onChange({ ...value, elite: id }) }
      default: {
        const slotIndex = Number(slot.slice(-1)) as 0 | 1 | 2
        const chosenElsewhere = value.utility.filter((_, i) => i !== slotIndex)
        return {
          label: `Utility ${slotIndex + 1}`,
          chosenId: value.utility[slotIndex],
          options: utilityOptions.filter((s) => !chosenElsewhere.includes(s.id)),
          select: (id) => setUtility(slotIndex, id)
        }
      }
    }
  }

  const slots: SlotId[] = ['heal', 'utility0', 'utility1', 'utility2', 'elite']

  return (
    <div className="skills-editor">
      <div className="skill-bar">
        {slots.map((slot) => {
          const { label, chosenId } = slotConfig(slot)
          const chosen = chosenId !== null ? skillsById.get(chosenId) : undefined
          return (
            <Tooltip
              key={slot}
              content={chosen ? skillTooltipContent(chosen, skillFacts(chosen)) : <TooltipBody title={label} />}
            >
              <button
                type="button"
                className={openSlot === slot ? 'skill-slot-button open' : 'skill-slot-button'}
                onClick={() => setOpenSlot(openSlot === slot ? null : slot)}
              >
                {chosen ? <img src={chosen.icon} alt={chosen.name} /> : <span className="skill-slot-placeholder">{label}</span>}
              </button>
            </Tooltip>
          )
        })}
      </div>

      {openSlot &&
        (() => {
          const { label, chosenId, options, select } = slotConfig(openSlot)
          return (
            <div className="skill-picker">
              <div className="skill-picker-header">{label}</div>
              <div className="skill-picker-grid">
                <button
                  type="button"
                  className={chosenId === null ? 'skill-option-button chosen' : 'skill-option-button'}
                  onClick={() => {
                    select(null)
                    setOpenSlot(null)
                  }}
                >
                  <span className="skill-option-none">—</span>
                  <span className="skill-option-name">None</span>
                </button>
                {options.map((s) => (
                  <Tooltip key={s.id} content={skillTooltipContent(s, skillFacts(s))}>
                    <button
                      type="button"
                      className={chosenId === s.id ? 'skill-option-button chosen' : 'skill-option-button'}
                      onClick={() => {
                        select(s.id)
                        setOpenSlot(null)
                      }}
                    >
                      <img src={s.icon} alt={s.name} />
                      <span className="skill-option-name">{s.name}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )
        })()}
    </div>
  )
}

interface RevenantProps {
  build: Build
  value: RevenantSkillSelection
  onChange: (value: SkillSelection) => void
  equippedSpecializationIds: ReadonlySet<number>
}

/**
 * Revenant equips 2 Legends at once (each a *fixed* heal/3 utility/elite kit — not picked
 * skill-by-skill) and swaps between them in combat. The editor mirrors that: 2 legend slots up
 * top (each opens a picker of legends available given the equipped specializations), and below
 * them the currently-active legend's fixed skill bar (read-only icons with boon/condition
 * tooltips, same as the standard skill bar) plus a toggle to switch which legend's bar is shown.
 */
function RevenantSkillsEditor({ build, value, onChange, equippedSpecializationIds }: RevenantProps) {
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { skillsById, legendsById, legendsForSpecializations } = gameData
  const [openLegendSlot, setOpenLegendSlot] = useState<0 | 1 | null>(null)

  const availableLegends = legendsForSpecializations(equippedSpecializationIds)

  function skillTooltipFor(skillId: number) {
    const skill = skillsById.get(skillId)
    if (!skill) return null
    const facts = boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
    return skillTooltipContent(skill, facts)
  }

  function chooseLegend(slotIndex: 0 | 1, legendId: string | null): void {
    const legends: [string | null, string | null] = [...value.legends]
    legends[slotIndex] = legendId
    onChange({ ...value, legends })
    setOpenLegendSlot(null)
  }

  const activeLegendId = value.legends[value.activeLegendIndex]
  const activeLegend = activeLegendId !== null ? legendsById.get(activeLegendId) : undefined

  return (
    <div className="skills-editor">
      <div className="legend-select-row">
        {([0, 1] as const).map((slotIndex) => {
          const legendId = value.legends[slotIndex]
          const legend = legendId !== null ? legendsById.get(legendId) : undefined
          const chosenElsewhere = value.legends[slotIndex === 0 ? 1 : 0]
          return (
            <div key={slotIndex} className="legend-slot">
              <div className="legend-slot-label">Legend {slotIndex + 1}</div>
              <Tooltip content={legend ? <TooltipBody title={legend.name} /> : <TooltipBody title="No legend chosen" />}>
                <button
                  type="button"
                  className={openLegendSlot === slotIndex ? 'skill-slot-button open' : 'skill-slot-button'}
                  onClick={() => setOpenLegendSlot(openLegendSlot === slotIndex ? null : slotIndex)}
                >
                  {legend ? <img src={legend.icon} alt={legend.name} /> : <span className="skill-slot-placeholder">Legend</span>}
                </button>
              </Tooltip>
              {openLegendSlot === slotIndex && (
                <div className="skill-picker">
                  <div className="skill-picker-header">Legend {slotIndex + 1}</div>
                  <div className="skill-picker-grid">
                    <button type="button" className="skill-option-button" onClick={() => chooseLegend(slotIndex, null)}>
                      <span className="skill-option-none">—</span>
                      <span className="skill-option-name">None</span>
                    </button>
                    {availableLegends
                      .filter((l) => l.id !== chosenElsewhere)
                      .map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          className={legendId === l.id ? 'skill-option-button chosen' : 'skill-option-button'}
                          onClick={() => chooseLegend(slotIndex, l.id)}
                        >
                          <img src={l.icon} alt={l.name} />
                          <span className="skill-option-name">{l.name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="legend-bar-toggle">
        {([0, 1] as const).map((i) => {
          const legendId = value.legends[i]
          const legend = legendId !== null ? legendsById.get(legendId) : undefined
          return (
            <button
              key={i}
              type="button"
              className={value.activeLegendIndex === i ? 'legend-toggle-button active' : 'legend-toggle-button'}
              onClick={() => onChange({ ...value, activeLegendIndex: i })}
            >
              {legend ? legend.name : `Legend ${i + 1}`}
            </button>
          )
        })}
      </div>

      <div className="skill-bar">
        {activeLegend ? (
          [activeLegend.heal, ...activeLegend.utilities, activeLegend.elite].map((skillId) => {
            const skill = skillsById.get(skillId)
            return (
              <Tooltip key={skillId} content={skillTooltipFor(skillId) ?? <TooltipBody title="Unknown skill" />}>
                <button type="button" className="skill-slot-button" disabled>
                  {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">?</span>}
                </button>
              </Tooltip>
            )
          })
        ) : (
          <div className="skill-picker-header">Choose a legend above to see its skill bar</div>
        )}
      </div>
    </div>
  )
}
