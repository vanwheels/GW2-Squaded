import type { Build } from '@shared/types'
import {
  AEGIS_DAMAGE_TRAIT_BONUSES,
  CELESTIAL_AVATAR_OUTGOING_HEALING_TRAIT_BONUSES,
  CURATED_RELIC_CONDITION_DAMAGE_BONUSES,
  CURATED_RELIC_DAMAGE_BONUSES,
  CURATED_RELIC_MOVEMENT_SPEED_BONUSES,
  CURATED_RELIC_OUTGOING_HEALING_BONUSES,
  DEATH_MAGIC_SPECIALIZATION_ID,
  DEATHS_CARAPACE_MAX_STACKS,
  DEATHS_CARAPACE_TOUGHNESS_PER_STACK,
  detectActiveStackingSigil,
  FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES,
  hasSigilOfTheNightEquipped,
  HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES,
  HEALTH_THRESHOLD_CONSUMABLE_BONUSES,
  HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES,
  HIGH_HEALTH_DAMAGE_TRAIT_BONUSES,
  INVOKING_HARMONY_HEALING_PERCENT,
  INVOKING_HARMONY_TRAIT_ID,
  kallaFervorPercentPerStack,
  KALLA_FERVOR_MAX_STACKS,
  MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES,
  NOT_FULL_ENDURANCE_DAMAGE_TRAIT_BONUSES,
  PER_BOON_DAMAGE_TRAIT_BONUSES,
  RENEGADE_SPECIALIZATION_ID,
  RESOLUTION_DAMAGE_TRAIT_BONUSES,
  REVEALED_ATTRIBUTE_TRAIT_BONUSES,
  RISING_MOMENTUM_MOVEMENT_SPEED_PERCENT_PER_UPKEEP_POINT,
  RISING_MOMENTUM_TRAIT_ID,
  SIGIL_OF_THE_NIGHT_ADDITIONAL_NIGHT_DAMAGE_PERCENT,
  SIGIL_OF_THE_NIGHT_ID,
  STABILITY_DAMAGE_TRAIT_BONUSES,
  SWIFTNESS_DAMAGE_TRAIT_BONUSES,
  SWIFTNESS_OR_SUPERSPEED_DAMAGE_TRAIT_BONUSES,
  VIGOR_CONDITION_DAMAGE_TRAIT_BONUSES,
  VIGOR_DAMAGE_TRAIT_BONUSES,
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
 * Icon-based controls for `CombatState`, rendered by `BuildEditorView` in its own toolbar cell
 * (2026-08-19) — a `.build-editor-top-cell` aligned, via the shared `.build-editor-grid`, directly
 * above the Stats+Skills column, alongside sibling cells for Profession/Weapon-type above Traits/
 * Equipment. Previously a narrow vertical column squeezed to the right of `StatsPanel`'s stat
 * grid, then briefly (same day) a full-width strip below the Stats/Boons row — moved up to the
 * toolbar row once that row itself became part of the capture region, since these are simulation
 * assumptions (25 might? Fury on? targeting Medium armor?) that explain the shown Stats numbers,
 * not editing chrome, and belong with the build's other top-line identity (profession, weapon
 * type) rather than buried inside a column. Might/stacking-sigil/Death's Carapace are steppers
 * (icon + 5-increment dropdown); Kalla's Fervor is a stepper too but every-integer (its own max is
 * only 5); Fury/Regeneration/Quickness/relic/mechanic-active are click-to-toggle icons (no
 * dropdown, boolean on/off); target armor is a 3-option dropdown (not a stepper — only Light/
 * Medium/Heavy exist, no intermediate values); Rising Momentum's upkeep-points is a raw number
 * input rather than a dropdown, since (unlike every other stepper here) it has no fixed real max
 * — see `CombatState`'s doc comment for why each field takes the shape it does.
 */
export function CombatStatePanel({ build, value, onChange }: Props) {
  const { sigilsById, relicsById, traitsById, foodById, utilityById } = useGameData()

  const stackingSigil = detectActiveStackingSigil(build)
  const sigilIcon = stackingSigil ? sigilsById.get(stackingSigil.sigilId)?.icon : undefined

  // Gated on membership in EITHER curated relic table — one shared toggle covers both damage-%
  // and movement-speed-% relic bonuses (see `combat-state.ts`'s `CURATED_RELIC_MOVEMENT_SPEED_
  // BONUSES` doc comment for why they reuse the same `relicActive` field).
  const relicHasCuratedBonus =
    build.relicId !== null &&
    (build.relicId in CURATED_RELIC_DAMAGE_BONUSES ||
      build.relicId in CURATED_RELIC_CONDITION_DAMAGE_BONUSES ||
      build.relicId in CURATED_RELIC_MOVEMENT_SPEED_BONUSES ||
      build.relicId in CURATED_RELIC_OUTGOING_HEALING_BONUSES)
  const relicIcon = relicHasCuratedBonus && build.relicId !== null ? relicsById.get(build.relicId)?.icon : undefined

  // Only surfaced when Sigil of the Night is actually equipped on the active weapon set — same
  // reasoning as `stackingSigil` above, reads the sigil's own icon.
  const hasSigilOfTheNight = hasSigilOfTheNightEquipped(build)
  const nightSigilIcon = hasSigilOfTheNight ? sigilsById.get(SIGIL_OF_THE_NIGHT_ID)?.icon : undefined

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
  // Divided / Last Rites / Keen Observer / Unscathed Contender) — same reasoning as `mechanicTrait`
  // above, reads the specific trait's own icon/name since (unlike Revealed) each candidate has a
  // genuinely different icon (see `combat-state.ts`'s `HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES`/
  // `HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES`/`HIGH_HEALTH_DAMAGE_TRAIT_BONUSES`). Also fixes a
  // pre-existing gap found while adding the damage-% table: Keen Observer's own crit-chance bonus
  // was never checked here, so its tier selector never actually surfaced.
  const activeHealthTraitId = [...activeTraitIds(build, traitsById)].find(
    (id) => id in HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES || id in HIGH_HEALTH_CRIT_CHANCE_TRAIT_BONUSES || id in HIGH_HEALTH_DAMAGE_TRAIT_BONUSES
  )
  const healthTrait = activeHealthTraitId !== undefined ? traitsById.get(activeHealthTraitId) : undefined
  // A curated health-threshold-gated consumable (the "Writ of X"/"Thesis on X" WvW family) also
  // needs the tier selector surfaced, same reasoning as `healthTrait` above but reading
  // `build.foodId`/`build.utilityId` instead of traits — see `HEALTH_THRESHOLD_CONSUMABLE_BONUSES`.
  const healthConsumableId = [build.foodId, build.utilityId].find((id) => id !== null && id in HEALTH_THRESHOLD_CONSUMABLE_BONUSES)
  const healthConsumable = healthConsumableId != null ? (foodById.get(healthConsumableId) ?? utilityById.get(healthConsumableId)) : undefined

  // Only surfaced when the build actually has a curated `FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES`
  // OR `NOT_FULL_ENDURANCE_DAMAGE_TRAIT_BONUSES` trait chosen (Renegade's Brutal Momentum / Engineer's
  // Takedown Round — opposite gates on the same `fullEnduranceActive` field) — same reasoning as
  // `mechanicTrait` above, reads the specific trait's own icon/name.
  const activeFullEnduranceTraitId = [...activeTraitIds(build, traitsById)].find(
    (id) => id in FULL_ENDURANCE_CRIT_CHANCE_TRAIT_BONUSES || id in NOT_FULL_ENDURANCE_DAMAGE_TRAIT_BONUSES
  )
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

  // Only surfaced when Rising Momentum is actually chosen — same reasoning as `mechanicTrait`/
  // `healthTrait` above, reads the trait's own icon/name since it's the only candidate so far.
  const hasRisingMomentum = activeTraitIds(build, traitsById).has(RISING_MOMENTUM_TRAIT_ID)
  const risingMomentumTrait = hasRisingMomentum ? traitsById.get(RISING_MOMENTUM_TRAIT_ID) : undefined

  // Only surfaced when Lingering Light (Ranger/Druid) is actually chosen — same reasoning as
  // `mechanicTrait` above, reads the trait's own icon/name since it's the only candidate so far.
  const celestialAvatarTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in CELESTIAL_AVATAR_OUTGOING_HEALING_TRAIT_BONUSES)
  const celestialAvatarTrait = celestialAvatarTraitId !== undefined ? traitsById.get(celestialAvatarTraitId) : undefined

  // Only surfaced when Invoking Harmony (Revenant/Salvation) is actually chosen — same reasoning as
  // `mechanicTrait` above.
  const hasInvokingHarmony = activeTraitIds(build, traitsById).has(INVOKING_HARMONY_TRAIT_ID)
  const invokingHarmonyTrait = hasInvokingHarmony ? traitsById.get(INVOKING_HARMONY_TRAIT_ID) : undefined

  // Only surfaced when the build actually has a curated `RESOLUTION_DAMAGE_TRAIT_BONUSES` trait
  // chosen (currently just Guardian's Retribution) — same reasoning as `mechanicTrait` above.
  const resolutionTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in RESOLUTION_DAMAGE_TRAIT_BONUSES)
  const resolutionTrait = resolutionTraitId !== undefined ? traitsById.get(resolutionTraitId) : undefined

  // Only surfaced when the build actually has a curated `PER_BOON_DAMAGE_TRAIT_BONUSES` trait
  // chosen (currently just Guardian's Inspired Virtue) — same reasoning as `risingMomentumTrait`
  // above (a raw number input, not a stepper — see `CombatState.activeBoonCount`'s doc comment).
  const perBoonDamageTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in PER_BOON_DAMAGE_TRAIT_BONUSES)
  const perBoonDamageTrait = perBoonDamageTraitId !== undefined ? traitsById.get(perBoonDamageTraitId) : undefined
  const perBoonDamagePercent = perBoonDamageTraitId !== undefined ? PER_BOON_DAMAGE_TRAIT_BONUSES[perBoonDamageTraitId] : 0

  // Only surfaced when the build actually has a curated `SWIFTNESS_DAMAGE_TRAIT_BONUSES` trait
  // chosen (currently just Warrior's Sprint) — same reasoning as `resolutionTraitId` above.
  const swiftnessTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in SWIFTNESS_DAMAGE_TRAIT_BONUSES)
  const swiftnessTrait = swiftnessTraitId !== undefined ? traitsById.get(swiftnessTraitId) : undefined

  // Only surfaced when the build actually has a curated `STABILITY_DAMAGE_TRAIT_BONUSES` trait
  // chosen (currently just Stalwart Strength) — same reasoning as `resolutionTraitId` above.
  const stabilityTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in STABILITY_DAMAGE_TRAIT_BONUSES)
  const stabilityTrait = stabilityTraitId !== undefined ? traitsById.get(stabilityTraitId) : undefined

  // Only surfaced when the build actually has a curated `AEGIS_DAMAGE_TRAIT_BONUSES` trait chosen
  // (currently just Unscathed Contender) — same reasoning as `resolutionTraitId` above.
  const aegisTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in AEGIS_DAMAGE_TRAIT_BONUSES)
  const aegisTrait = aegisTraitId !== undefined ? traitsById.get(aegisTraitId) : undefined

  // Only surfaced when the build actually has a curated `VIGOR_DAMAGE_TRAIT_BONUSES` trait chosen
  // (Engineer's Excessive Energy or Mesmer's Nomad's Endurance) — same reasoning as
  // `resolutionTraitId` above.
  const vigorTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in VIGOR_DAMAGE_TRAIT_BONUSES)
  const vigorTrait = vigorTraitId !== undefined ? traitsById.get(vigorTraitId) : undefined

  // Only surfaced when the build actually has a curated `SWIFTNESS_OR_SUPERSPEED_DAMAGE_TRAIT_
  // BONUSES` trait chosen (currently just Ranger's Bird of Prey) — same reasoning as
  // `resolutionTraitId` above. This toggle is `superspeedActive` specifically (not `swiftnessActive`,
  // which already has its own icon above) so the two boon states stay independently togglable even
  // though this table's own gate is an OR of both.
  const superspeedTraitId = [...activeTraitIds(build, traitsById)].find((id) => id in SWIFTNESS_OR_SUPERSPEED_DAMAGE_TRAIT_BONUSES)
  const superspeedTrait = superspeedTraitId !== undefined ? traitsById.get(superspeedTraitId) : undefined

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

      {risingMomentumTrait && (
        <div className="combat-state-row">
          <img
            className={iconClass(value.upkeepPoints > 0)}
            src={risingMomentumTrait.icon}
            alt=""
            title={`Rising Momentum: +${RISING_MOMENTUM_MOVEMENT_SPEED_PERCENT_PER_UPKEEP_POINT}% Movement Speed per point of upkeep in use`}
          />
          <input
            type="number"
            min={0}
            step={1}
            aria-label="Current points of upkeep in use"
            value={value.upkeepPoints}
            onChange={(e) => onChange({ ...value, upkeepPoints: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      )}

      {perBoonDamageTrait && (
        <div className="combat-state-row">
          <img
            className={iconClass(value.activeBoonCount > 0)}
            src={perBoonDamageTrait.icon}
            alt=""
            title={`${perBoonDamageTrait.name}: +${perBoonDamagePercent}% Outgoing Damage per active boon`}
          />
          <input
            type="number"
            min={0}
            step={1}
            aria-label="Current number of active boons"
            value={value.activeBoonCount}
            onChange={(e) => onChange({ ...value, activeBoonCount: Math.max(0, Number(e.target.value) || 0) })}
          />
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

      {celestialAvatarTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={value.celestialAvatarActive ? `${celestialAvatarTrait.name}: In Celestial Avatar Form` : `${celestialAvatarTrait.name}: Not in Celestial Avatar Form`}
          onClick={() => onChange({ ...value, celestialAvatarActive: !value.celestialAvatarActive })}
        >
          <img className={iconClass(value.celestialAvatarActive)} src={celestialAvatarTrait.icon} alt={celestialAvatarTrait.name} />
        </button>
      )}

      {invokingHarmonyTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.invokingHarmonyActive
              ? `${invokingHarmonyTrait.name}: Active (+${INVOKING_HARMONY_HEALING_PERCENT}% Outgoing Healing)`
              : `${invokingHarmonyTrait.name}: Inactive`
          }
          onClick={() => onChange({ ...value, invokingHarmonyActive: !value.invokingHarmonyActive })}
        >
          <img className={iconClass(value.invokingHarmonyActive)} src={invokingHarmonyTrait.icon} alt={invokingHarmonyTrait.name} />
        </button>
      )}

      {resolutionTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.resolutionActive
              ? `${resolutionTrait.name}: Active (+${RESOLUTION_DAMAGE_TRAIT_BONUSES[resolutionTraitId!]}% Outgoing Damage)`
              : `${resolutionTrait.name}: Inactive`
          }
          onClick={() => onChange({ ...value, resolutionActive: !value.resolutionActive })}
        >
          <img className={iconClass(value.resolutionActive)} src={resolutionTrait.icon} alt={resolutionTrait.name} />
        </button>
      )}

      {swiftnessTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.swiftnessActive
              ? `${swiftnessTrait.name}: Active (+${SWIFTNESS_DAMAGE_TRAIT_BONUSES[swiftnessTraitId!]}% Outgoing Damage)`
              : `${swiftnessTrait.name}: Inactive`
          }
          onClick={() => onChange({ ...value, swiftnessActive: !value.swiftnessActive })}
        >
          <img className={iconClass(value.swiftnessActive)} src={swiftnessTrait.icon} alt={swiftnessTrait.name} />
        </button>
      )}

      {stabilityTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.stabilityActive
              ? `${stabilityTrait.name}: Active (+${STABILITY_DAMAGE_TRAIT_BONUSES[stabilityTraitId!]}% Outgoing Damage)`
              : `${stabilityTrait.name}: Inactive`
          }
          onClick={() => onChange({ ...value, stabilityActive: !value.stabilityActive })}
        >
          <img className={iconClass(value.stabilityActive)} src={stabilityTrait.icon} alt={stabilityTrait.name} />
        </button>
      )}

      {aegisTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.aegisActive ? `${aegisTrait.name}: Active (+${AEGIS_DAMAGE_TRAIT_BONUSES[aegisTraitId!]}% Outgoing Damage)` : `${aegisTrait.name}: Inactive`
          }
          onClick={() => onChange({ ...value, aegisActive: !value.aegisActive })}
        >
          <img className={iconClass(value.aegisActive)} src={aegisTrait.icon} alt={aegisTrait.name} />
        </button>
      )}

      {vigorTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.vigorActive
              ? `${vigorTrait.name}: Active (+${VIGOR_DAMAGE_TRAIT_BONUSES[vigorTraitId!]}% Outgoing Damage${
                  vigorTraitId! in VIGOR_CONDITION_DAMAGE_TRAIT_BONUSES
                    ? `, +${VIGOR_CONDITION_DAMAGE_TRAIT_BONUSES[vigorTraitId!]}% Outgoing Condition Damage`
                    : ''
                })`
              : `${vigorTrait.name}: Inactive`
          }
          onClick={() => onChange({ ...value, vigorActive: !value.vigorActive })}
        >
          <img className={iconClass(value.vigorActive)} src={vigorTrait.icon} alt={vigorTrait.name} />
        </button>
      )}

      {superspeedTrait && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.superspeedActive
              ? `${superspeedTrait.name}: Active (+${SWIFTNESS_OR_SUPERSPEED_DAMAGE_TRAIT_BONUSES[superspeedTraitId!]}% Outgoing Damage)`
              : `${superspeedTrait.name}: Inactive`
          }
          onClick={() => onChange({ ...value, superspeedActive: !value.superspeedActive })}
        >
          <img className={iconClass(value.superspeedActive)} src={superspeedTrait.icon} alt={superspeedTrait.name} />
        </button>
      )}

      {hasSigilOfTheNight && nightSigilIcon && (
        <button
          type="button"
          className="combat-state-toggle-icon"
          title={
            value.nightActive
              ? `Sigil of the Night: Night (+${SIGIL_OF_THE_NIGHT_ADDITIONAL_NIGHT_DAMAGE_PERCENT}% additional Outgoing Damage)`
              : 'Sigil of the Night: Day'
          }
          onClick={() => onChange({ ...value, nightActive: !value.nightActive })}
        >
          <img className={iconClass(value.nightActive)} src={nightSigilIcon} alt="Sigil of the Night" />
        </button>
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
