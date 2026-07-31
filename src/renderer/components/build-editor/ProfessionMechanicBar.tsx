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
}

/**
 * The profession-mechanic ("F1-F5") bar: Guardian's Virtues, Warrior's Burst Skill (plus
 * Berserker/Spellbreaker/Bladesworn's F2-F4), Engineer's Toolbelt, Druid's Celestial Avatar
 * toggle, Vindicator's Energy Meld, etc. Read-only, same visual pattern as `WeaponSkillBar`'s
 * disabled buttons — see `profession-mechanic.ts` for exactly what's resolved vs. deliberately
 * excluded per profession/elite spec (Revenant's Legend-swap-duplicate ids and Ranger's
 * pet-adjacent ids are filtered out there, not here — this component renders for every profession,
 * including Revenant/Ranger, since both have *other* real F-buttons beyond what their dedicated
 * `RevenantSkillsEditor`/`PetsEditor` pickers already show).
 */
export function ProfessionMechanicBar({ build, equippedSpecializationIds }: Props) {
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { professions, skillsById } = gameData
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
    <div className="skill-bar profession-mechanic-bar">
      {entries.map((entry) => (
        <Tooltip key={entry.slot} content={skillTooltipFor(entry.skill.id) ?? <TooltipBody title="Unknown skill" />}>
          <button type="button" className="skill-slot-button" disabled>
            <img src={entry.skill.icon} alt={entry.skill.name} />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
