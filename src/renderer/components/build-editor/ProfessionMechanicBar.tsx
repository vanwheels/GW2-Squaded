import type { Build } from '@shared/types'
import { boonConditionFactsForSkill } from '@shared/boon-calc/sources'
import {
  engineerToolbeltBar,
  professionMechanicBar,
  RANGER_BEASTMODE_SPEC_ID,
  soulbeastBeastmodeBar,
  type ProfessionMechanicBarEntry
} from '@shared/skill-calc/profession-mechanic'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { skillTooltipContent, useDurationContext, type SkillVariantContext } from './SkillsEditor'

interface Props {
  build: Build
  equippedSpecializationIds: ReadonlySet<number>
  onBuildChange: (patch: Partial<Pick<Build, 'activeBundleSkillId'>>) => void
}

/**
 * The profession-mechanic ("F1-F5") bar: Guardian's Virtues, Warrior's Burst Skill (plus
 * Berserker/Spellbreaker/Bladesworn's F2-F4), Engineer's Toolbelt, Druid's Celestial Avatar
 * toggle, Vindicator's Energy Meld, etc. Mostly read-only, same visual pattern as `WeaponSkillBar`'s
 * disabled buttons — see `profession-mechanic.ts` for exactly what's resolved vs. deliberately
 * excluded per profession/elite spec (Revenant's Legend-swap-duplicate ids and Ranger's
 * pet-adjacent ids are filtered out there, not here — this component renders for every profession,
 * including Revenant/Ranger, since both have *other* real F-buttons beyond what their dedicated
 * `RevenantSkillsEditor`/`PetsEditor` pickers already show).
 *
 * Firebrand's Tome entries (F1-F3) are the one exception — clickable rather than disabled,
 * confirmed 2026-07-31: clicking a Tome icon swaps `WeaponSkillBar`'s displayed 1-5 row to that
 * Tome's chapters (`Build.activeBundleSkillId`, same field the old "Weapon/Tome of X" text-toggle
 * row used), clicking the active one again reverts to Weapon, and clicking a different Tome while
 * one is active switches directly to it — replacing the separate text-toggle row entirely for
 * Tomes specifically (Engineer Kits and Druid's Celestial Avatar still use that row, see
 * `WeaponSkillBar`'s `toggleRowIds`). Scoped by `id in tomeChapters` rather than a Firebrand
 * profession check since that's already the exact, only set of ids this applies to.
 */
export function ProfessionMechanicBar({ build, equippedSpecializationIds, onBuildChange }: Props) {
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { professions, skillsById, tomeChapters } = gameData
  const profession = professions.find((p) => p.id === build.profession)
  const variantContext: SkillVariantContext = { skills: gameData.skills, skillsById, wvwFactOverrides: gameData.wvwFactOverrides, durationPercent }

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

  let entries: ProfessionMechanicBarEntry[] = professionMechanicBar(profession, skillsById, equippedSpecializationIds, mainHandWeaponType)
  if (build.profession === 'Engineer') {
    entries = [...engineerToolbeltBar(build, skillsById), ...entries]
  }
  if (build.profession === 'Ranger' && equippedSpecializationIds.has(RANGER_BEASTMODE_SPEC_ID)) {
    entries = [...soulbeastBeastmodeBar(build, skillsById, gameData.soulbeastBeastmode), ...entries]
  }

  if (entries.length === 0) return null

  return (
    <div className="skill-bar profession-mechanic-bar ingame-skill-bar-mechanic">
      {entries.map((entry) => {
        const isTome = entry.skill.id in tomeChapters
        const isActive = isTome && build.activeBundleSkillId === entry.skill.id
        return (
          <Tooltip key={entry.slot} content={skillTooltipFor(entry.skill.id) ?? <TooltipBody title="Unknown skill" />}>
            <button
              type="button"
              className={isActive ? 'skill-slot-button active' : 'skill-slot-button'}
              disabled={!isTome}
              onClick={isTome ? () => onBuildChange({ activeBundleSkillId: isActive ? null : entry.skill.id }) : undefined}
            >
              <img src={entry.skill.icon} alt={entry.skill.name} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
