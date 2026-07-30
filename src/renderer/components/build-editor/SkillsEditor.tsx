import { useMemo, useState } from 'react'
import type { Build, Skill, SkillSelection } from '@shared/types'
import { activeTraitIds, boonConditionFactsForSkill, type BoonConditionSource } from '@shared/boon-calc/sources'
import { formatBoonDuration } from '@shared/boon-calc/format'
import { boonDurationPercent, computeGearAttributeTotals, conditionDurationPercent } from '@shared/gear-calc/attribute-totals'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

interface Props {
  build: Build
  value: SkillSelection
  onChange: (value: SkillSelection) => void
  equippedSpecializationIds: ReadonlySet<number>
}

type SlotId = 'heal' | 'utility0' | 'utility1' | 'utility2' | 'elite'

export function SkillsEditor({ build, value, onChange, equippedSpecializationIds }: Props) {
  const profession = build.profession
  const gameData = useGameData()
  const { skillsById, skillsForProfessionAndSlot } = gameData
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null)

  const healOptions = skillsForProfessionAndSlot(profession, 'Heal', equippedSpecializationIds)
  const utilityOptions = skillsForProfessionAndSlot(profession, 'Utility', equippedSpecializationIds)
  const eliteOptions = skillsForProfessionAndSlot(profession, 'Elite', equippedSpecializationIds)

  const activeIds = useMemo(() => activeTraitIds(build, gameData.traits), [build, gameData.traits])
  const durationPercent = useMemo(() => {
    const totals = computeGearAttributeTotals(build, gameData.itemStats)
    return { boon: boonDurationPercent(totals), condition: conditionDurationPercent(totals) }
  }, [build, gameData.itemStats])

  function skillFacts(skill: Skill): BoonConditionSource[] {
    return boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
  }

  function skillTooltip(skill: Skill) {
    const facts = skillFacts(skill)
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

  function setUtility(slotIndex: 0 | 1 | 2, skillId: number | null): void {
    const utility: SkillSelection['utility'] = [...value.utility]
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
            <Tooltip key={slot} content={chosen ? skillTooltip(chosen) : <TooltipBody title={label} />}>
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
                  <Tooltip key={s.id} content={skillTooltip(s)}>
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
