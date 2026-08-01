import type { Build } from '@shared/types'
import { CURATED_RELIC_DAMAGE_BONUSES, detectActiveStackingSigil, type CombatState } from '@shared/gear-calc/combat-state'
import { BOON_CONDITION_ICONS } from '@shared/boon-calc/icons'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  build: Build
  value: CombatState
  onChange: (value: CombatState) => void
}

/** Stepper values for Might/stacking-sigil stacks — 5-stack increments rather than every value
 *  0-25, matching how stacks are actually gained/tracked in practice. */
const STACK_OPTIONS = [0, 5, 10, 15, 20, 25]

function iconClass(active: boolean): string {
  return active ? 'combat-state-icon' : 'combat-state-icon combat-state-icon-inactive'
}

/**
 * Icon-based controls for `CombatState`, rendered inline inside `StatsPanel` to the right of the
 * stat grid. Might/stacking-sigil are steppers (icon + 5-increment dropdown); Fury/relic are
 * click-to-toggle icons (no dropdown, boolean on/off) — see `CombatState`'s doc comment for why
 * each field takes the shape it does.
 */
export function CombatStatePanel({ build, value, onChange }: Props) {
  const { sigilsById, relicsById } = useGameData()

  const stackingSigil = detectActiveStackingSigil(build)
  const sigilIcon = stackingSigil ? sigilsById.get(stackingSigil.sigilId)?.icon : undefined

  const relicHasCuratedBonus = build.relicId !== null && build.relicId in CURATED_RELIC_DAMAGE_BONUSES
  const relicIcon = relicHasCuratedBonus && build.relicId !== null ? relicsById.get(build.relicId)?.icon : undefined

  return (
    <div className="combat-state-controls">
      <div className="combat-state-row">
        <img className={iconClass(value.mightStacks > 0)} src={BOON_CONDITION_ICONS.Might} alt="" title="Might" />
        <select
          aria-label="Might stacks"
          value={value.mightStacks}
          onChange={(e) => onChange({ ...value, mightStacks: Number(e.target.value) })}
        >
          {STACK_OPTIONS.map((n) => (
            <option key={n} value={n}>
              ×{n}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="combat-state-toggle-icon"
        title={value.furyActive ? 'Fury: On' : 'Fury: Off'}
        onClick={() => onChange({ ...value, furyActive: !value.furyActive })}
      >
        <img className={iconClass(value.furyActive)} src={BOON_CONDITION_ICONS.Fury} alt="Fury" />
      </button>

      {stackingSigil && sigilIcon && (
        <div className="combat-state-row">
          <img className={iconClass(value.stackingSigilStacks > 0)} src={sigilIcon} alt="" title={stackingSigil.name} />
          <select
            aria-label={`${stackingSigil.name} stacks`}
            value={value.stackingSigilStacks}
            onChange={(e) => onChange({ ...value, stackingSigilStacks: Number(e.target.value) })}
          >
            {STACK_OPTIONS.map((n) => (
              <option key={n} value={n}>
                ×{n}
              </option>
            ))}
          </select>
        </div>
      )}

      {relicHasCuratedBonus && relicIcon && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={value.relicActive ? 'Relic: Active' : 'Relic: Inactive'}
          onClick={() => onChange({ ...value, relicActive: !value.relicActive })}
        >
          <img className={iconClass(value.relicActive)} src={relicIcon} alt="Relic" />
        </button>
      )}
    </div>
  )
}
