import type { Build } from '@shared/types'
import {
  CURATED_RELIC_DAMAGE_BONUSES,
  detectActiveStackingSigil,
  MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES,
  type CombatState,
  type TargetArmorClass
} from '@shared/gear-calc/combat-state'
import { activeTraitIds } from '@shared/gear-calc/trait-attributes'
import { BOON_CONDITION_ICONS, DAMAGE_ICON } from '@shared/boon-calc/icons'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  build: Build
  value: CombatState
  onChange: (value: CombatState) => void
}

/** Stepper values for Might/stacking-sigil stacks — 5-stack increments rather than every value
 *  0-25, matching how stacks are actually gained/tracked in practice. */
const STACK_OPTIONS = [0, 5, 10, 15, 20, 25]

const TARGET_ARMOR_OPTIONS: TargetArmorClass[] = ['Light', 'Medium', 'Heavy']

function iconClass(active: boolean): string {
  return active ? 'combat-state-icon' : 'combat-state-icon combat-state-icon-inactive'
}

/**
 * Icon-based controls for `CombatState`, rendered inline inside `StatsPanel` to the right of the
 * stat grid. Might/stacking-sigil are steppers (icon + 5-increment dropdown); Fury/Regeneration/
 * Quickness/relic/mechanic-active are click-to-toggle icons (no dropdown, boolean on/off); target
 * armor is a 3-option dropdown (not a stepper — only Light/Medium/Heavy exist, no intermediate
 * values) — see `CombatState`'s doc comment for why each field takes the shape it does.
 */
export function CombatStatePanel({ build, value, onChange }: Props) {
  const { sigilsById, relicsById, traitsById } = useGameData()

  const stackingSigil = detectActiveStackingSigil(build)
  const sigilIcon = stackingSigil ? sigilsById.get(stackingSigil.sigilId)?.icon : undefined

  const relicHasCuratedBonus = build.relicId !== null && build.relicId in CURATED_RELIC_DAMAGE_BONUSES
  const relicIcon = relicHasCuratedBonus && build.relicId !== null ? relicsById.get(build.relicId)?.icon : undefined

  // Only surfaced when the build actually has a curated `mechanicActive`-family trait chosen
  // (Reaper's Onslaught / Fatal Frenzy / Sand Sage) — every build only ever has one profession's
  // mechanic to toggle, so this reads the specific trait's own icon/name rather than a generic
  // Shroud/Berserk/Shade icon (see `combat-state.ts`'s `MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES`).
  const activeMechanicTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES)
  const mechanicTrait = activeMechanicTraitId !== undefined ? traitsById.get(activeMechanicTraitId) : undefined

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

      <button
        type="button"
        className="combat-state-toggle-icon"
        title={value.regenerationActive ? 'Regeneration: On' : 'Regeneration: Off'}
        onClick={() => onChange({ ...value, regenerationActive: !value.regenerationActive })}
      >
        <img className={iconClass(value.regenerationActive)} src={BOON_CONDITION_ICONS.Regeneration} alt="Regeneration" />
      </button>

      <button
        type="button"
        className="combat-state-toggle-icon"
        title={value.quicknessActive ? 'Quickness: On' : 'Quickness: Off'}
        onClick={() => onChange({ ...value, quicknessActive: !value.quicknessActive })}
      >
        <img className={iconClass(value.quicknessActive)} src={BOON_CONDITION_ICONS.Quickness} alt="Quickness" />
      </button>

      {mechanicTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={value.mechanicActive ? `${mechanicTrait.name}: Active` : `${mechanicTrait.name}: Inactive`}
          onClick={() => onChange({ ...value, mechanicActive: !value.mechanicActive })}
        >
          <img className={iconClass(value.mechanicActive)} src={mechanicTrait.icon} alt={mechanicTrait.name} />
        </button>
      )}

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

      <div className="combat-state-row">
        <img className="combat-state-icon" src={DAMAGE_ICON} alt="" title="Target armor (Damage row)" />
        <select
          aria-label="Target armor class"
          value={value.targetArmorClass}
          onChange={(e) => onChange({ ...value, targetArmorClass: e.target.value as TargetArmorClass })}
        >
          {TARGET_ARMOR_OPTIONS.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
      </div>

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
