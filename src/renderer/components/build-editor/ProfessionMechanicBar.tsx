import { useRef } from 'react'
import type { Build } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { boonConditionFactsForSkill } from '@shared/boon-calc/sources'
import {
  ALLIANCE_TACTICS_SKILL_ID,
  CATALYST_SPEC_ID,
  catalystJadeSphereBar,
  CONDUIT_SPEC_ID,
  conduitReleasePotentialBar,
  engineerToolbeltBar,
  evokerFamiliarBar,
  professionMechanicBar,
  RANGER_BEASTMODE_SPEC_ID,
  soulbeastBeastmodeBar,
  SPECTER_SPEC_ID,
  type ProfessionMechanicBarEntry
} from '@shared/skill-calc/profession-mechanic'
import { EVOKER_SPECIALIZATION_ID } from '@shared/skill-calc/familiar'
import { isMechanicBarBundleId } from '@shared/skill-calc/bundle-skills'
import { THIEF_STOLEN_SKILL_IDS, thiefStolenSkillBar } from '@shared/skill-calc/thief-stolen-skill'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { FloatingPanel } from '@renderer/components/common/FloatingPanel'
import { usePickerOpen } from '@renderer/state/picker-registry'
import { skillTooltipContent, useDurationContext, type SkillVariantContext } from './SkillsEditor'

interface Props {
  build: Build
  equippedSpecializationIds: ReadonlySet<number>
  onBuildChange: (
    patch: Partial<Pick<Build, 'activeBundleSkillId' | 'familiarId' | 'thiefStolenSkillId' | 'vindicatorAspectFlipped'>>
  ) => void
  combatState: CombatState
}

const THIEF_STOLEN_SKILL_SLOT = 'Profession_2'

/**
 * The profession-mechanic ("F1-F5") bar: Guardian's Virtues, Warrior's Burst Skill (plus
 * Berserker/Spellbreaker/Bladesworn's F2-F4), Engineer's Toolbelt, Druid's Celestial Avatar
 * toggle, Vindicator's Energy Meld, etc. Mostly read-only, same visual pattern as `WeaponSkillBar`'s
 * disabled buttons — see `profession-mechanic.ts` for exactly what's resolved vs. deliberately
 * excluded per profession/elite spec (Revenant's Legend-swap-duplicate ids and Ranger's
 * pet-adjacent ids are filtered out there, not here — this component renders for every profession,
 * including Revenant/Ranger, since both have *other* real F-buttons beyond what their dedicated
 * `RevenantSkillsEditor`/`PetsEditor` pickers already show). Revenant Conduit's F2 "Release
 * Potential" is prepended separately via `conduitReleasePotentialBar` — unlike every other entry
 * here, its icon depends on the build's currently-*active* Legend (`activeLegendIndex`), which the
 * generic per-spec resolver has no way to read; see that function's doc comment.
 *
 * Firebrand's Tome entries (F1-F3), Necromancer's Shroud entry (F1), Druid's Celestial Avatar
 * entry (F5), and Bladesworn's "Unsheathe Gunsaber" entry (F1) are the exception — clickable
 * rather than disabled, confirmed 2026-07-31: clicking the icon swaps `WeaponSkillBar`'s displayed
 * 1-5 row to that bundle's skills (`Build.activeBundleSkillId`, same field the old "Weapon/Tome of
 * X"/"Weapon/Celestial Avatar" text-toggle row used), clicking the active one again reverts to
 * Weapon, and clicking a different one while one is active switches directly to it — replacing the
 * separate text-toggle row entirely for Tomes/Shroud/Celestial-Avatar/Gunsaber specifically
 * (Engineer Kits still use that row, see `WeaponSkillBar`'s `toggleRowIds`). Scoped via
 * `isMechanicBarBundleId` rather than a per-profession check since that's already the exact, only
 * set of ids this applies to.
 *
 * Elementalist Catalyst's F5 "Deploy Jade Sphere" (`catalystJadeSphereBar`) and Tempest's F1-F4
 * Overload icons (handled inside `professionMechanicBar` itself) are read-only like the general
 * case, just with a different icon than the generic per-spec resolver would pick — see
 * `profession-mechanic.ts`'s doc comments on `CATALYST_SPEC_ID`/`TEMPEST_SPEC_ID`. Evoker's F5
 * "Familiar" (`evokerFamiliarBar`) is a third clickable case, alongside Tomes/Shroud/Celestial
 * Avatar/Gunsaber above but with its own click behavior (`cycleFamiliar` below) rather than
 * `activeBundleSkillId`: since there are 4 familiars and only one F5 button to click (unlike
 * Firebrand's 3 separate, simultaneously-visible Tome icons), clicking cycles `Build.familiarId`
 * to the next familiar in `gameData.familiars` order — replacing the standalone
 * `EvokerFamiliarSelect` picker row entirely (confirmed 2026-08-01; `Build.familiarId` itself is
 * unchanged, still also feeding the Heal-skill icon variant, see that field's own doc comment).
 *
 * Thief's F2 is a fourth, distinct case: unlike every button above, there's no way to derive
 * "the current Stolen Skill" from the build at all (see `thief-stolen-skill.ts`), so clicking the
 * F2 icon opens an inline picker (same visual pattern as Heal/Utility/Elite's own picker in
 * `SkillsEditor` — flat icon grid, no category columns, since these ids carry no `categories`)
 * instead of toggling `activeBundleSkillId` or cycling a fixed set. Only rendered when Thief is
 * equipped and Specter isn't — Specter's own F2 "Enter Shadow Shroud" already occupies that slot
 * through the generic resolver and behaves like any other Shroud (clickable bundle toggle, not a
 * picker).
 *
 * Vindicator's F3 "Alliance Tactics" (`ALLIANCE_TACTICS_SKILL_ID`) is a fifth clickable case:
 * clicking it flips `Build.vindicatorAspectFlipped`, which `SkillsEditor`'s `RevenantSkillsEditor`
 * reads to swap Legend7's displayed heal/utility/elite bar between its two Aspects — same "click
 * toggles a boolean, both states always contribute to totals" shape as `rangerUnleashed`'s toggle,
 * not `activeBundleSkillId` (there's nothing to set `activeBundleSkillId` to here — Legend7's
 * heal/utility/elite bar isn't the weapon bar). See `vindicator-aspect.ts`.
 */
export function ProfessionMechanicBar({ build, equippedSpecializationIds, onBuildChange, combatState }: Props) {
  const { gameData, activeIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)
  const { professions, skillsById, tomeChapters, familiars } = gameData
  const profession = professions.find((p) => p.id === build.profession)
  const variantContext: SkillVariantContext = {
    skills: gameData.skills,
    skillsById,
    wvwFactOverrides: gameData.wvwFactOverrides,
    durationPercent,
    characterAttributes,
    targetArmor
  }
  const { open: stolenSkillPickerOpen, openThis: openStolenSkillPicker, close: closeStolenSkillPicker } = usePickerOpen()
  const stolenSkillButtonRef = useRef<HTMLButtonElement>(null)

  function cycleFamiliar(): void {
    const currentIndex = familiars.findIndex((f) => f.id === build.familiarId)
    const next = familiars[(currentIndex + 1) % familiars.length]
    onBuildChange({ familiarId: next.id })
  }

  function toggleStolenSkillPicker(): void {
    if (stolenSkillPickerOpen) closeStolenSkillPicker()
    else openStolenSkillPicker()
  }

  function chooseStolenSkill(id: number | null): void {
    onBuildChange({ thiefStolenSkillId: id })
    closeStolenSkillPicker()
  }

  function skillTooltipFor(skillId: number) {
    const skill = skillsById.get(skillId)
    if (!skill) return null
    const facts = boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
    return skillTooltipContent(skill, facts, activeIds, variantContext)
  }

  if (!profession) return null

  const isLand = build.environment === 'land'
  const mainKey = isLand ? (build.activeWeaponSet === 'A' ? 'weaponA1' : 'weaponB1') : build.activeUnderwaterSet === 'U1' ? 'weaponU1' : 'weaponU2'
  const mainHandWeaponType = build.equipment[mainKey]?.weaponType ?? null

  let entries: ProfessionMechanicBarEntry[] = professionMechanicBar(
    profession,
    skillsById,
    equippedSpecializationIds,
    build.environment,
    mainHandWeaponType
  )
  if (build.profession === 'Engineer') {
    entries = [...engineerToolbeltBar(build, skillsById), ...entries]
  }
  if (build.profession === 'Ranger' && equippedSpecializationIds.has(RANGER_BEASTMODE_SPEC_ID)) {
    entries = [...soulbeastBeastmodeBar(build, skillsById, gameData.soulbeastBeastmode), ...entries]
  }
  if (build.profession === 'Revenant' && equippedSpecializationIds.has(CONDUIT_SPEC_ID)) {
    entries = [...conduitReleasePotentialBar(build, skillsById), ...entries]
  }
  if (build.profession === 'Elementalist' && equippedSpecializationIds.has(CATALYST_SPEC_ID)) {
    entries = [...entries, ...catalystJadeSphereBar(build, profession, skillsById)]
  }
  const isEvoker = build.profession === 'Elementalist' && equippedSpecializationIds.has(EVOKER_SPECIALIZATION_ID)
  if (isEvoker) {
    entries = [...entries, ...evokerFamiliarBar(build, skillsById, familiars)]
  }
  const showStolenSkillPicker = build.profession === 'Thief' && !equippedSpecializationIds.has(SPECTER_SPEC_ID)
  if (showStolenSkillPicker) {
    entries = [...entries, ...thiefStolenSkillBar(build, skillsById)].sort((a, b) => a.slot.localeCompare(b.slot))
  }

  if (entries.length === 0 && !showStolenSkillPicker) return null

  return (
    <div className="skill-bar profession-mechanic-bar ingame-skill-bar-mechanic">
      {entries.map((entry) => {
        const isBundle = isMechanicBarBundleId(entry.skill.id, tomeChapters)
        const isFamiliarSlot = isEvoker && entry.slot === 'Profession_5'
        const isStolenSkillSlot = showStolenSkillPicker && entry.slot === THIEF_STOLEN_SKILL_SLOT
        const isAllianceTacticsSlot = entry.skill.id === ALLIANCE_TACTICS_SKILL_ID
        const isActive =
          (isBundle && build.activeBundleSkillId === entry.skill.id) ||
          (isStolenSkillSlot && stolenSkillPickerOpen) ||
          (isAllianceTacticsSlot && build.vindicatorAspectFlipped)
        const onClick = isStolenSkillSlot
          ? toggleStolenSkillPicker
          : isBundle
            ? () => onBuildChange({ activeBundleSkillId: isActive ? null : entry.skill.id })
            : isFamiliarSlot
              ? cycleFamiliar
              : isAllianceTacticsSlot
                ? () => onBuildChange({ vindicatorAspectFlipped: !build.vindicatorAspectFlipped })
                : undefined
        return (
          <Tooltip key={entry.slot} content={skillTooltipFor(entry.skill.id) ?? <TooltipBody title="Unknown skill" />}>
            <button
              ref={isStolenSkillSlot ? stolenSkillButtonRef : undefined}
              type="button"
              className={isActive ? 'skill-slot-button active' : 'skill-slot-button'}
              disabled={!onClick}
              onClick={onClick}
            >
              <img src={entry.skill.icon} alt={entry.skill.name} />
            </button>
          </Tooltip>
        )
      })}
      {showStolenSkillPicker && !entries.some((e) => e.slot === THIEF_STOLEN_SKILL_SLOT) && (
        <Tooltip content={<TooltipBody title="Stolen Skill" />}>
          <button
            ref={stolenSkillButtonRef}
            type="button"
            className={stolenSkillPickerOpen ? 'skill-slot-button open' : 'skill-slot-button'}
            onClick={toggleStolenSkillPicker}
          >
            <span className="skill-slot-placeholder">Stolen Skill</span>
          </button>
        </Tooltip>
      )}
      {showStolenSkillPicker && (
        <FloatingPanel
          open={stolenSkillPickerOpen}
          anchorRef={stolenSkillButtonRef}
          onClose={closeStolenSkillPicker}
          className="skill-picker"
        >
          <div className="skill-picker-header">Stolen Skill</div>
          <div className="skill-picker-columns">
            <div className="skill-category-column">
              <div className="skill-category-header">&nbsp;</div>
              <Tooltip content={<TooltipBody title="None" />}>
                <button
                  type="button"
                  className={build.thiefStolenSkillId === null ? 'skill-icon-button chosen' : 'skill-icon-button'}
                  onClick={() => chooseStolenSkill(null)}
                >
                  <span className="skill-option-none">—</span>
                </button>
              </Tooltip>
            </div>
            <div className="skill-category-column">
              <div className="skill-category-header">Stolen Skill</div>
              {THIEF_STOLEN_SKILL_IDS.map((id) => {
                const skill = skillsById.get(id)
                if (!skill) return null
                return (
                  <Tooltip key={id} content={skillTooltipFor(id) ?? <TooltipBody title={skill.name} />}>
                    <button
                      type="button"
                      className={build.thiefStolenSkillId === id ? 'skill-icon-button chosen' : 'skill-icon-button'}
                      onClick={() => chooseStolenSkill(id)}
                    >
                      <img src={skill.icon} alt={skill.name} />
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </FloatingPanel>
      )}
    </div>
  )
}
