import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

interface Props {
  value: string | null
  onChange: (familiarId: string | null) => void
}

/**
 * Elementalist Evoker's familiar picker — single-pick icon row, same shape as `EliteSpecSelect`.
 * Only affects which of Heal skill "Rejuvenate"'s 4 identical-effect ids is bound (icon-only
 * difference, see `Familiar`'s doc comment in game-data.ts) — the familiar's own active/passive
 * combat effects aren't modeled.
 */
export function EvokerFamiliarSelect({ value, onChange }: Props) {
  const { familiars } = useGameData()

  return (
    <div className="field">
      <span>Familiar</span>
      <div className="profession-picker-row">
        <Tooltip content={<TooltipBody title="None" description="No familiar chosen" />}>
          <button
            type="button"
            className={value === null ? 'spec-icon-button core-spec-button chosen' : 'spec-icon-button core-spec-button'}
            onClick={() => onChange(null)}
          >
            None
          </button>
        </Tooltip>
        {familiars.map((f) => (
          <Tooltip key={f.id} content={<TooltipBody title={f.name} description={f.element} />}>
            <button
              type="button"
              className={value === f.id ? 'spec-icon-button chosen' : 'spec-icon-button'}
              style={{ backgroundImage: `url(${f.icon})` }}
              onClick={() => onChange(f.id)}
            />
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
