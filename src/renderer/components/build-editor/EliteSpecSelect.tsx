import type { ProfessionId, TraitLineSlots } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

interface Props {
  profession: ProfessionId
  value: TraitLineSlots
  onChange: (value: TraitLineSlots) => void
}

/** The elite spec line is always the 3rd trait line, by GW2 convention. */
const ELITE_LINE_INDEX = 2

export function EliteSpecSelect({ profession, value, onChange }: Props) {
  const { specializationsForProfession } = useGameData()
  const eliteSpecs = specializationsForProfession(profession).filter((s) => s.elite)
  const current = value[ELITE_LINE_INDEX]

  function choose(specializationId: number | null): void {
    const next = [...value] as TraitLineSlots
    next[ELITE_LINE_INDEX] =
      specializationId === null ? null : { specializationId, chosenTraitIds: [null, null, null] }
    onChange(next)
  }

  return (
    <div className="field">
      <span>Elite Specialization</span>
      <div className="profession-picker-row">
        <Tooltip content={<TooltipBody title="Core" description="No elite specialization" />}>
          <button
            type="button"
            className={current == null ? 'spec-icon-button core-spec-button chosen' : 'spec-icon-button core-spec-button'}
            onClick={() => choose(null)}
          >
            Core
          </button>
        </Tooltip>
        {eliteSpecs.map((s) => (
          <Tooltip key={s.id} content={<TooltipBody title={s.name} />}>
            <button
              type="button"
              className={current?.specializationId === s.id ? 'spec-icon-button chosen' : 'spec-icon-button'}
              style={{ backgroundImage: `url(${s.icon})` }}
              onClick={() => choose(s.id)}
            />
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
