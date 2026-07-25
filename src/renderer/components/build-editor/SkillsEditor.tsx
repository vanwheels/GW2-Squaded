import { useState } from 'react'
import type { ProfessionId, Skill, SkillSelection } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  profession: ProfessionId
  value: SkillSelection
  onChange: (value: SkillSelection) => void
  equippedSpecializationIds: ReadonlySet<number>
}

type SlotId = 'heal' | 'utility0' | 'utility1' | 'utility2' | 'elite'

export function SkillsEditor({ profession, value, onChange, equippedSpecializationIds }: Props) {
  const { skillsById, skillsForProfessionAndSlot } = useGameData()
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null)

  const healOptions = skillsForProfessionAndSlot(profession, 'Heal', equippedSpecializationIds)
  const utilityOptions = skillsForProfessionAndSlot(profession, 'Utility', equippedSpecializationIds)
  const eliteOptions = skillsForProfessionAndSlot(profession, 'Elite', equippedSpecializationIds)

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
            <button
              type="button"
              key={slot}
              className={openSlot === slot ? 'skill-slot-button open' : 'skill-slot-button'}
              title={chosen ? `${chosen.name} — ${chosen.description}` : label}
              onClick={() => setOpenSlot(openSlot === slot ? null : slot)}
            >
              {chosen ? <img src={chosen.icon} alt={chosen.name} /> : <span className="skill-slot-placeholder">{label}</span>}
            </button>
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
                  <button
                    type="button"
                    key={s.id}
                    className={chosenId === s.id ? 'skill-option-button chosen' : 'skill-option-button'}
                    title={s.description}
                    onClick={() => {
                      select(s.id)
                      setOpenSlot(null)
                    }}
                  >
                    <img src={s.icon} alt={s.name} />
                    <span className="skill-option-name">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}
    </div>
  )
}
