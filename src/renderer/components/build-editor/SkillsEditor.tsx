import type { ProfessionId, SkillSelection } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  profession: ProfessionId
  value: SkillSelection
  onChange: (value: SkillSelection) => void
}

export function SkillsEditor({ profession, value, onChange }: Props) {
  const { skillsForProfessionAndSlot } = useGameData()

  const healOptions = skillsForProfessionAndSlot(profession, 'Heal')
  const utilityOptions = skillsForProfessionAndSlot(profession, 'Utility')
  const eliteOptions = skillsForProfessionAndSlot(profession, 'Elite')

  function setUtility(slotIndex: 0 | 1 | 2, skillId: number | null): void {
    const utility: SkillSelection['utility'] = [...value.utility]
    utility[slotIndex] = skillId
    onChange({ ...value, utility })
  }

  return (
    <div className="skills-editor">
      <label className="field">
        <span>Heal</span>
        <select
          value={value.heal ?? ''}
          onChange={(e) => onChange({ ...value, heal: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">— None —</option>
          {healOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {([0, 1, 2] as const).map((slotIndex) => {
        const chosenElsewhere = value.utility.filter((_, i) => i !== slotIndex)
        const options = utilityOptions.filter((s) => !chosenElsewhere.includes(s.id))
        return (
          <label className="field" key={slotIndex}>
            <span>Utility {slotIndex + 1}</span>
            <select
              value={value.utility[slotIndex] ?? ''}
              onChange={(e) => setUtility(slotIndex, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— None —</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )
      })}

      <label className="field">
        <span>Elite</span>
        <select
          value={value.elite ?? ''}
          onChange={(e) => onChange({ ...value, elite: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">— None —</option>
          {eliteOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
