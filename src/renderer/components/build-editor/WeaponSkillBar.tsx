import type { Build, TomeChapter } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { boonConditionFactsForSkill, tomeChapterBoonSources } from '@shared/boon-calc/sources'
import { weaponSkillIdsForPair } from '@shared/weapon-calc/weapon-skills'
import { bundleCapableSkillIds, isMechanicBarBundleId, resolveActiveBundle } from '@shared/skill-calc/bundle-skills'
import { professionMechanicBar } from '@shared/skill-calc/profession-mechanic'
import { unleashedWeaponOneId, UNTAMED_SPEC_ID } from '@shared/skill-calc/untamed-unleash'
import { formatFactLine } from '@shared/gear-calc/relic-effects-format'
import { isBoonName, isConditionName } from '@shared/boon-calc/constants'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { SkillBarIcon } from './SkillBarIcon'
import { factsBlock, skillTooltipContent, useDurationContext, type SkillVariantContext } from './SkillsEditor'

interface Props {
  build: Build
  equippedSpecializationIds: ReadonlySet<number>
  onBuildChange: (
    patch: Partial<
      Pick<Build, 'environment' | 'activeWeaponSet' | 'activeUnderwaterSet' | 'activeBundleSkillId' | 'rangerUnleashed' | 'activeAttunement'>
    >
  ) => void
  combatState: CombatState
  /** Renders the same underlying weapon-set derivation up to 4 times, split into the pieces the
   *  in-game skill bar keeps visually distinct (see `SkillsEditor`'s grid layout): `extras` is the
   *  editor-only display toggles with no live HUD equivalent (attunement/unleashed/bundle) shown
   *  above the whole bar; `env` is a single combined Land/Underwater toggle icon sitting above the
   *  weapon-swap icon; `swap` is the weapon-swap cycle icon itself, sitting immediately left of the
   *  weapon skills; `weapon` is the resulting 1-5 icon row. */
  section: 'extras' | 'env' | 'swap' | 'weapon'
}

const ATTUNEMENTS = ['Fire', 'Water', 'Air', 'Earth'] as const

/** Base Attunement skill ids (Fire/Water/Air/Earth), used purely for their icons in the editor's
 *  own attunement-toggle row below — see that row's doc comment for why it can't literally reuse
 *  `ProfessionMechanicBar`'s read-only F1-F4 rendering of these same 4 ids. */
const ATTUNEMENT_SKILL_IDS: Record<(typeof ATTUNEMENTS)[number], number> = { Fire: 5492, Water: 5493, Air: 5494, Earth: 5495 }

/**
 * The weapon-derived half of the skill bar: an ENVIRONMENT toggle (land/underwater) and, within
 * that, a toggle for which weapon-swap set is currently displayed (both sets always contribute
 * to boon/condition totals — see `Build.activeWeaponSet` — this toggle is display-only, same as
 * the Revenant legend-bar toggle it mirrors). Applies to every profession; weapon skills are
 * orthogonal to the Heal/Utility/Elite (or Legend) mechanic rendered above it.
 *
 * For an Untamed Ranger, an extra Normal/Unleashed toggle swaps slot 1 between the weapon's normal
 * autoattack and Untamed's "Unleashed" alternate (see `untamed-unleash.ts` — this does NOT replace
 * the full bar, only slot 1; both states always contribute to boon/condition totals regardless of
 * this toggle, same reasoning as every other toggle here).
 *
 * When the build has any equipped Engineer Kit, an extra toggle row lets the displayed 1-5 bar be
 * swapped to that kit's own 5 skills instead, matching the real in-game "kit replaces your weapon
 * skills while active" mechanic (Firebrand Tomes, Necromancer Shroud, and Druid's Celestial Avatar
 * toggle via their own F-bar icon in `ProfessionMechanicBar` instead — see that component's doc
 * comment). Every equipped kit/tome/Shroud/Celestial-Avatar always contributes to boon/condition
 * totals regardless of this toggle (see `Build.activeBundleSkillId`'s doc comment) — this only
 * changes what's shown.
 */
export function WeaponSkillBar({ build, equippedSpecializationIds, onBuildChange, combatState, section }: Props) {
  const { gameData, activeIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)
  const { professions, skillsById, tomeChapters } = gameData
  const profession = professions.find((p) => p.id === build.profession)

  const isLand = build.environment === 'land'
  const mainKey = isLand ? (build.activeWeaponSet === 'A' ? 'weaponA1' : 'weaponB1') : build.activeUnderwaterSet === 'U1' ? 'weaponU1' : 'weaponU2'
  const offKey = isLand ? (build.activeWeaponSet === 'A' ? 'weaponA2' : 'weaponB2') : null

  const mainType = build.equipment[mainKey]?.weaponType
  const offType = offKey ? build.equipment[offKey]?.weaponType : undefined
  const mainWeapon = mainType && profession ? profession.weapons[mainType] : undefined
  const offWeapon = offType && profession ? profession.weapons[offType] : mainWeapon

  const isElementalist = build.profession === 'Elementalist'
  const baseSkillIds = profession
    ? weaponSkillIdsForPair(
        mainWeapon,
        offWeapon,
        build.environment,
        skillsById,
        equippedSpecializationIds,
        mainType ?? null,
        offType ?? null,
        isElementalist ? build.activeAttunement : null
      )
    : []
  const hasAnyWeapon = mainWeapon !== undefined || offWeapon !== undefined
  const variantContext: SkillVariantContext = {
    skills: gameData.skills,
    skillsById,
    wvwFactOverrides: gameData.wvwFactOverrides,
    durationPercent,
    characterAttributes,
    targetArmor
  }

  const isUntamed = equippedSpecializationIds.has(UNTAMED_SPEC_ID)
  const unleashedId = isUntamed && mainType && mainWeapon ? unleashedWeaponOneId(mainType, mainWeapon, build.environment, skillsById) : null
  const skillIds =
    unleashedId !== null && build.rangerUnleashed ? [unleashedId, ...baseSkillIds.slice(1)] : baseSkillIds

  const mechanicBarSkillIds = profession
    ? professionMechanicBar(profession, skillsById, equippedSpecializationIds, build.environment).map((e) => e.skill.id)
    : []
  const bundleCapableIds = bundleCapableSkillIds(build, skillsById, tomeChapters, mechanicBarSkillIds)
  const activeBundleId = build.activeBundleSkillId !== null && bundleCapableIds.includes(build.activeBundleSkillId) ? build.activeBundleSkillId : null
  const activeBundle = activeBundleId !== null ? resolveActiveBundle(build, skillsById, tomeChapters, build.environment) : null
  // Firebrand Tomes/Necromancer Shroud toggle via their own F-bar icon in `ProfessionMechanicBar`
  // now, not this row (see that component's doc comment) — Engineer Kits and Druid's Celestial
  // Avatar still do.
  const toggleRowIds = bundleCapableIds.filter((id) => !isMechanicBarBundleId(id, tomeChapters))

  function skillTooltipFor(skillId: number) {
    const skill = skillsById.get(skillId)
    if (!skill) return null
    const facts = boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
    return skillTooltipContent(skill, facts, activeIds, variantContext)
  }

  function tomeChapterTooltip(chapter: TomeChapter) {
    const boonFacts = tomeChapterBoonSources(chapter, durationPercent)
    const boonNames = new Set(boonFacts.map((f) => f.boonOrConditionName))
    const numericLines = chapter.facts
      .filter((f) => !(isBoonName(f.label) || isConditionName(f.label)) || !boonNames.has(f.label.charAt(0).toUpperCase() + f.label.slice(1)))
      .map(formatFactLine)
    return (
      <>
        <TooltipBody title={chapter.name} description={chapter.description} />
        {factsBlock(numericLines, boonFacts)}
      </>
    )
  }

  if (section === 'weapon') {
    return (
      <div className="ingame-skill-bar-weapon skill-bar">
        {activeBundle ? (
          activeBundle.slots.map((slot, i) => {
            if (slot === null) {
              return (
                <Tooltip key={i} content={<TooltipBody title="Empty" />}>
                  <button type="button" className="skill-slot-button" disabled>
                    <span className="skill-slot-placeholder">—</span>
                  </button>
                </Tooltip>
              )
            }
            if (slot.kind === 'kit') {
              return (
                <Tooltip key={i} content={skillTooltipFor(slot.skill.id) ?? <TooltipBody title="Unknown skill" />}>
                  <button type="button" className="skill-slot-button" disabled>
                    <img src={slot.skill.icon} alt={slot.skill.name} />
                  </button>
                </Tooltip>
              )
            }
            return (
              <Tooltip key={i} content={tomeChapterTooltip(slot.chapter)}>
                <button type="button" className="skill-slot-button" disabled>
                  <img src={slot.chapter.icon} alt={slot.chapter.name} />
                </button>
              </Tooltip>
            )
          })
        ) : hasAnyWeapon ? (
          skillIds.map((skillId, i) => {
            const skill = skillId !== null ? skillsById.get(skillId) : undefined
            return (
              <Tooltip
                key={i}
                content={skill ? (skillTooltipFor(skill.id) ?? <TooltipBody title="Unknown skill" />) : <TooltipBody title="Empty" />}
              >
                <button type="button" className="skill-slot-button" disabled>
                  {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">—</span>}
                </button>
              </Tooltip>
            )
          })
        ) : (
          <div className="skill-picker-header weapon-bar-empty-placeholder">
            Choose a weapon in the Equipment panel to see its skill bar
          </div>
        )}
      </div>
    )
  }

  if (section === 'extras') {
    const hasExtras = isElementalist || unleashedId !== null || toggleRowIds.length > 0
    if (!hasExtras) return null
    return (
      <div className="ingame-skill-bar-extras">
        {isElementalist && (
          <div className="skill-bar">
            {ATTUNEMENTS.map((attunement) => {
              const skill = skillsById.get(ATTUNEMENT_SKILL_IDS[attunement])
              const isActive = build.activeAttunement === attunement
              return (
                <Tooltip
                  key={attunement}
                  content={skill ? (skillTooltipFor(skill.id) ?? <TooltipBody title={attunement} />) : <TooltipBody title={attunement} />}
                >
                  <button
                    type="button"
                    className={isActive ? 'skill-slot-button active' : 'skill-slot-button'}
                    onClick={() => onBuildChange({ activeAttunement: attunement })}
                  >
                    {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">{attunement}</span>}
                  </button>
                </Tooltip>
              )
            })}
          </div>
        )}

        {unleashedId !== null && (
          <div className="ingame-skill-bar-swap">
            <button
              type="button"
              className="skill-bar-icon-button"
              title={build.rangerUnleashed ? 'Switch to Normal' : 'Switch to Unleashed'}
              onClick={() => onBuildChange({ rangerUnleashed: !build.rangerUnleashed })}
            >
              <SkillBarIcon kind="cycle" />
            </button>
          </div>
        )}

        {toggleRowIds.length > 0 && (
          <div className="legend-bar-toggle">
            <button
              type="button"
              className={activeBundleId === null ? 'legend-toggle-button active' : 'legend-toggle-button'}
              onClick={() => onBuildChange({ activeBundleSkillId: null })}
            >
              Weapon
            </button>
            {toggleRowIds.map((id) => {
              const skill = skillsById.get(id)
              return (
                <button
                  key={id}
                  type="button"
                  className={activeBundleId === id ? 'legend-toggle-button active' : 'legend-toggle-button'}
                  onClick={() => onBuildChange({ activeBundleSkillId: id })}
                >
                  {skill?.name ?? `#${id}`}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (section === 'env') {
    return (
      <div className="ingame-skill-bar-env">
        <button
          type="button"
          className={isLand ? 'skill-bar-icon-button env-land active' : 'skill-bar-icon-button env-water active'}
          title={isLand ? 'Switch to Underwater' : 'Switch to Land'}
          onClick={() => onBuildChange({ environment: isLand ? 'underwater' : 'land' })}
        >
          <SkillBarIcon kind={isLand ? 'land' : 'water'} />
        </button>
      </div>
    )
  }

  function cycleWeaponSet(): void {
    if (isLand) onBuildChange({ activeWeaponSet: build.activeWeaponSet === 'A' ? 'B' : 'A' })
    else onBuildChange({ activeUnderwaterSet: build.activeUnderwaterSet === 'U1' ? 'U2' : 'U1' })
  }

  return (
    <div className="ingame-skill-bar-swap">
      <button
        type="button"
        className="skill-bar-icon-button"
        title={isLand ? 'Swap to the other weapon set' : 'Swap to the other underwater set'}
        onClick={cycleWeaponSet}
      >
        <SkillBarIcon kind="cycle" />
      </button>
    </div>
  )
}
