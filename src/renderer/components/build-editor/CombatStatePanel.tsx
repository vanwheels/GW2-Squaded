import type { Build } from '@shared/types'
import { CURATED_RELIC_DAMAGE_BONUSES, detectActiveStackingSigil, type CombatState } from '@shared/gear-calc/combat-state'

interface Props {
  build: Build
  value: CombatState
  onChange: (value: CombatState) => void
}

/**
 * Ephemeral "what-if" combat inputs feeding `StatsPanel` — Might/stacking-sigil steppers and
 * Fury/relic toggles. Deliberately not part of `Build` (see `CombatState`'s doc comment); state
 * lives in `BuildEditorView` and resets whenever the editor unmounts (navigating back to the
 * builds list), same as opening a different build.
 */
export function CombatStatePanel({ build, value, onChange }: Props) {
  const stackingSigil = detectActiveStackingSigil(build)
  const relicHasCuratedBonus = build.relicId !== null && build.relicId in CURATED_RELIC_DAMAGE_BONUSES

  return (
    <div className="combat-state-panel">
      <h3>Combat State</h3>
      <div className="combat-state-row">
        <label htmlFor="combat-state-might">Might</label>
        <input
          id="combat-state-might"
          type="number"
          min={0}
          max={25}
          value={value.mightStacks}
          onChange={(e) => onChange({ ...value, mightStacks: Math.min(25, Math.max(0, Number(e.target.value))) })}
        />
      </div>
      <div className="combat-state-row">
        <button
          type="button"
          className={value.furyActive ? 'combat-state-toggle active' : 'combat-state-toggle'}
          onClick={() => onChange({ ...value, furyActive: !value.furyActive })}
        >
          Fury {value.furyActive ? 'On' : 'Off'}
        </button>
      </div>
      {stackingSigil && (
        <div className="combat-state-row">
          <label htmlFor="combat-state-sigil">{stackingSigil.name.replace('Superior Sigil of ', '')}</label>
          <input
            id="combat-state-sigil"
            type="number"
            min={0}
            max={25}
            value={value.stackingSigilStacks}
            onChange={(e) =>
              onChange({ ...value, stackingSigilStacks: Math.min(25, Math.max(0, Number(e.target.value))) })
            }
          />
        </div>
      )}
      {relicHasCuratedBonus && (
        <div className="combat-state-row">
          <button
            type="button"
            className={value.relicActive ? 'combat-state-toggle active' : 'combat-state-toggle'}
            onClick={() => onChange({ ...value, relicActive: !value.relicActive })}
          >
            Relic {value.relicActive ? 'Active' : 'Inactive'}
          </button>
        </div>
      )}
    </div>
  )
}
