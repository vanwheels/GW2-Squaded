import type { Build } from '@shared/types'
import {
  CURATED_RELIC_DAMAGE_BONUSES,
  DEATH_MAGIC_SPECIALIZATION_ID,
  DEATHS_CARAPACE_MAX_STACKS,
  DEATHS_CARAPACE_TOUGHNESS_PER_STACK,
  detectActiveStackingSigil,
  FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES,
  HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES,
  HEALTH_THRESHOLD_CONSUMABLE_BONUSES,
  kallaFervorPercentPerStack,
  KALLA_FERVOR_MAX_STACKS,
  MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES,
  RENEGADE_SPECIALIZATION_ID,
  REVEALED_ATTRIBUTE_TRAIT_BONUSES,
  type CombatState,
  type HealthTier,
  type TargetArmorClass
} from '@shared/gear-calc/combat-state'
import { activeTraitIds } from '@shared/gear-calc/trait-attributes'
import { BOON_CONDITION_ICONS, DAMAGE_ICON, DEATHS_CARAPACE_ICON, KALLA_FERVOR_ICON, REVEALED_ICON } from '@shared/boon-calc/icons'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  build: Build
  value: CombatState
  onChange: (value: CombatState) => void
}

/** Stepper values for Might/stacking-sigil stacks — 5-stack increments rather than every value
 *  0-25, matching how stacks are actually gained/tracked in practice. */
const STACK_OPTIONS = [0, 5, 10, 15, 20, 25]

/** Kalla's Fervor stacks every value 0-5 (its own real max, unlike Might/stacking-sigils'
 *  0-25-by-5s above) — few enough values that every-integer options read fine as a dropdown. */
const KALLA_FERVOR_STACK_OPTIONS = Array.from({ length: KALLA_FERVOR_MAX_STACKS + 1 }, (_, n) => n)

/** Death's Carapace's own max (30) back to 5-increment options, same reasoning as `STACK_OPTIONS`
 *  above (too many values for every-integer to read well, unlike Kalla's Fervor's small 0-5 range). */
const DEATHS_CARAPACE_STACK_OPTIONS = Array.from({ length: DEATHS_CARAPACE_MAX_STACKS / 5 + 1 }, (_, n) => n * 5)

const TARGET_ARMOR_OPTIONS: TargetArmorClass[] = ['Light', 'Medium', 'Heavy']

/** Dropdown labels for `HealthTier` — see `CombatState.healthTier`'s doc comment for why this is a
 *  3-way tier rather than a raw percent slider. */
const HEALTH_TIER_OPTIONS: { value: HealthTier; label: string }[] = [
  { value: 'above75', label: 'Above 75%' },
  { value: 'between50and75', label: '50%–75%' },
  { value: 'below50', label: 'Below 50%' }
]

function iconClass(active: boolean): string {
  return active ? 'combat-state-icon' : 'combat-state-icon combat-state-icon-inactive'
}

/**
 * Icon-based controls for `CombatState`, rendered by `BuildEditorView` as its own compact
 * horizontal strip below the Stats/Boons row (2026-08-19) — previously squeezed into a narrow
 * vertical column to the right of `StatsPanel`'s stat grid, which left little room to breathe as
 * more curated fields (Death's Carapace, health tiers, etc.) were added over time. Deliberately
 * still lives inside `.build-editor-capture` (unlike Profession/Weapon-type, which moved out into
 * `.editor-profession-weapon-bar`) — these are simulation assumptions (25 might? Fury on?
 * targeting Medium armor?) that explain the shown Stats numbers, not editing chrome, so they need
 * to stay visible in the screenshot. Might/stacking-sigil/Death's Carapace are steppers (icon +
 * 5-increment dropdown); Kalla's Fervor is a stepper too but every-integer (its own max is only
 * 5); Fury/Regeneration/Quickness/relic/mechanic-active are click-to-toggle icons (no dropdown,
 * boolean on/off); target armor is a 3-option dropdown (not a stepper — only Light/Medium/Heavy
 * exist, no intermediate values) — see `CombatState`'s doc comment for why each field takes the
 * shape it does.
 */
export function CombatStatePanel({ build, value, onChange }: Props) {
  const { sigilsById, relicsById, traitsById, foodById, utilityById } = useGameData()

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

  // Only surfaced when the build actually has a curated Revealed-gated trait chosen (currently just
  // Revealed Training) — same reasoning as `mechanicTrait` above, but uses the shared Revealed debuff
  // icon rather than the trait's own icon since this family only ever has one profession's worth of
  // candidates so far (see `combat-state.ts`'s `REVEALED_ATTRIBUTE_TRAIT_BONUSES`).
  const hasRevealedGatedTrait = [...activeTraitIds(build, traitsById)].some((id) => id in REVEALED_ATTRIBUTE_TRAIT_BONUSES)

  // Only surfaced when the build actually has a curated health-threshold-gated trait chosen (Empire
  // Divided / Last Rites) — same reasoning as `mechanicTrait` above, reads the specific trait's own
  // icon/name since (unlike Revealed) each candidate has a genuinely different icon (see
  // `combat-state.ts`'s `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES`).
  const activeHealthTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES)
  const healthTrait = activeHealthTraitId !== undefined ? traitsById.get(activeHealthTraitId) : undefined
  // A curated health-threshold-gated consumable (the "Writ of X"/"Thesis on X" WvW family) also
  // needs the tier selector surfaced, same reasoning as `healthTrait` above but reading
  // `build.foodId`/`build.utilityId` instead of traits — see `HEALTH_THRESHOLD_CONSUMABLE_BONUSES`.
  const healthConsumableId = [build.foodId, build.utilityId].find((id) => id !== null && id in HEALTH_THRESHOLD_CONSUMABLE_BONUSES)
  const healthConsumable = healthConsumableId != null ? (foodById.get(healthConsumableId) ?? utilityById.get(healthConsumableId)) : undefined

  // Only surfaced when the build actually has a curated `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES`
  // trait chosen (currently just Renegade's Brutal Momentum) — same reasoning as `mechanicTrait`
  // above, reads the specific trait's own icon/name.
  const activeFullEnduranceTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES)
  const fullEnduranceTrait = activeFullEnduranceTraitId !== undefined ? traitsById.get(activeFullEnduranceTraitId) : undefined

  // Only surfaced when the Renegade elite spec is actually equipped — Kalla's Fervor is exclusive
  // to that spec (see `combat-state.ts`'s `KALLA_FERVOR_*_PERCENT_PER_STACK`).
  const hasRenegade = build.specializations.some((s) => s?.specializationId === RENEGADE_SPECIALIZATION_ID)
  // Reflects Lasting Legacy's upgrade (2%/2%/2% -> 3%/3%/3% per stack) in the stepper's own label,
  // so the per-stack rate actually being used is visible without opening the Stats panel — see
  // `kallaFervorPercentPerStack`'s doc comment.
  const kallaFervorPerStack = kallaFervorPercentPerStack(build, traitsById)

  // Only surfaced when Death Magic is actually equipped — Death's Carapace can't exist without it
  // (see `combat-state.ts`'s `DEATH_MAGIC_SPECIALIZATION_ID`).
  const hasDeathMagic = build.specializations.some((s) => s?.specializationId === DEATH_MAGIC_SPECIALIZATION_ID)

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

      {hasRenegade && (
        <div className="combat-state-row">
          <img
            className={iconClass(value.kallaFervorStacks > 0)}
            src={KALLA_FERVOR_ICON}
            alt=""
            title={
              kallaFervorPerStack.improved
                ? `Kalla's Fervor (Improved by Lasting Legacy): +${kallaFervorPerStack.strikeDamage}% Damage / +${kallaFervorPerStack.conditionDamage}% Condition Damage / +${kallaFervorPerStack.lifeSteal}% Life Steal per stack`
                : `Kalla's Fervor: +${kallaFervorPerStack.strikeDamage}% Damage / +${kallaFervorPerStack.conditionDamage}% Condition Damage / +${kallaFervorPerStack.lifeSteal}% Life Steal per stack`
            }
          />
          <select
            aria-label="Kalla's Fervor stacks"
            value={value.kallaFervorStacks}
            onChange={(e) => onChange({ ...value, kallaFervorStacks: Number(e.target.value) })}
          >
            {KALLA_FERVOR_STACK_OPTIONS.map((n) => (
              <option key={n} value={n}>
                ×{n}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasDeathMagic && (
        <div className="combat-state-row">
          <img
            className={iconClass(value.deathsCarapaceStacks > 0)}
            src={DEATHS_CARAPACE_ICON}
            alt=""
            title={`Death's Carapace: +${DEATHS_CARAPACE_TOUGHNESS_PER_STACK} Toughness per stack`}
          />
          <select
            aria-label="Death's Carapace stacks"
            value={value.deathsCarapaceStacks}
            onChange={(e) => onChange({ ...value, deathsCarapaceStacks: Number(e.target.value) })}
          >
            {DEATHS_CARAPACE_STACK_OPTIONS.map((n) => (
              <option key={n} value={n}>
                ×{n}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {hasRevealedGatedTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={value.revealedActive ? 'Revealed: On' : 'Revealed: Off'}
          onClick={() => onChange({ ...value, revealedActive: !value.revealedActive })}
        >
          <img className={iconClass(value.revealedActive)} src={REVEALED_ICON} alt="Revealed" />
        </button>
      )}

      {fullEnduranceTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={value.fullEnduranceActive ? `${fullEnduranceTrait.name}: Full Endurance` : `${fullEnduranceTrait.name}: Not Full Endurance`}
          onClick={() => onChange({ ...value, fullEnduranceActive: !value.fullEnduranceActive })}
        >
          <img className={iconClass(value.fullEnduranceActive)} src={fullEnduranceTrait.icon} alt={fullEnduranceTrait.name} />
        </button>
      )}

      {(healthTrait || healthConsumable) && (
        <div className="combat-state-row">
          <img
            className="combat-state-icon"
            src={(healthTrait ?? healthConsumable)!.icon}
            alt=""
            title={(healthTrait ?? healthConsumable)!.name}
          />
          <select
            aria-label="Health tier"
            value={value.healthTier}
            onChange={(e) => onChange({ ...value, healthTier: e.target.value as HealthTier })}
          >
            {HEALTH_TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
