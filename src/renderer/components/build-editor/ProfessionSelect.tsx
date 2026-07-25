import type { ProfessionId } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  value: ProfessionId
  onChange: (profession: ProfessionId) => void
}

export function ProfessionSelect({ value, onChange }: Props) {
  const { professions } = useGameData()

  return (
    <label className="field">
      <span>Profession</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {professions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
