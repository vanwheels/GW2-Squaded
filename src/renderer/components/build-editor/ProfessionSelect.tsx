import type { ProfessionId } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

interface Props {
  value: ProfessionId
  onChange: (profession: ProfessionId) => void
}

export function ProfessionSelect({ value, onChange }: Props) {
  const { professions } = useGameData()

  return (
    <div className="field">
      <span>Profession</span>
      <div className="profession-picker-row">
        {professions.map((p) => (
          <Tooltip key={p.id} content={<TooltipBody title={p.name} />}>
            <button
              type="button"
              className={p.id === value ? 'spec-icon-button chosen' : 'spec-icon-button'}
              style={{ backgroundImage: `url(${p.icon})` }}
              onClick={() => onChange(p.id)}
            />
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
