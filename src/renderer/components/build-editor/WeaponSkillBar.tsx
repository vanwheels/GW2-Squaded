import type { Build, TomeChapter } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { boonConditionFactsForSkill, tomeChapterBoonSources } from '@shared/boon-calc/sources'
import { weaponSkillIdsForPair } from '@shared/weapon-calc/weapon-skills'
import { bundleCapableSkillIds, CELESTIAL_AVATAR_SKILL_ID, isMechanicBarBundleId, resolveActiveBundle } from '@shared/skill-calc/bundle-skills'
import { professionMechanicBar } from '@shared/skill-calc/profession-mechanic'
import { unleashedWeaponOneId, UNTAMED_SPEC_ID } from '@shared/skill-calc/untamed-unleash'
import { formatFactLine } from '@shared/gear-calc/relic-effects-format'
import { isBoonName, isConditionName } from '@shared/boon-calc/constants'
import { WEAVER_SPEC_ID } from '@shared/weapon-calc/weapon-skills'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { SkillBarIcon } from './SkillBarIcon'
import { factsBlock, FlipSkillStack, skillTooltipContent, useDurationContext, type SkillVariantContext } from './SkillsEditor'

interface Props {
  build: Build
  equippedSpecializationIds: ReadonlySet<number>
  onBuildChange: (
    patch: Partial<Pick<Build, 'environment' | 'activeWeaponSet' | 'activeUnderwaterSet' | 'activeBundleSkillId' | 'rangerUnleashed'>>
  ) => void
  combatState: CombatState
  /** Renders the same underlying weapon-set derivation up to 4 times, split into the pieces the
   *  in-game skill bar keeps visually distinct (see `SkillsEditor`'s grid layout): `extras` is the
   *  editor-only display toggles with no live HUD equivalent (unleashed/bundle — Elementalist's
   *  *current* attunement toggle, and Weaver's *previous* attunement alongside it, both live on
   *  `ProfessionMechanicBar`'s F1-F4 row instead, see that component's doc comment) shown above the
   *  whole bar; `env` is a single combined Land/Underwater toggle icon sitting above the
   *  weapon-swap icon; `swap` is the weapon-swap cycle icon itself, sitting immediately left of the
   *  weapon skills; `weapon` is the resulting 1-5 icon row. */
  section: 'extras' | 'env' | 'swap' | 'weapon'
}

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
 * skills while active" mechanic. Rendered as the same `skill-slot-button` icon (kit's own icon,
 * tooltip on hover, accent border while active, click the active one again to revert to Weapon)
 * that Firebrand Tomes/Necromancer Shroud/Druid's Celestial Avatar use on their own F-bar icon in
 * `ProfessionMechanicBar` — but kept as this separate row rather than folded into that bar,
 * confirmed 2026-08-06: unlike those, a Kit has no fixed F-slot of its own to click. Its Toolbelt
 * skill (a DIFFERENT skill, e.g. Grenade Kit's own "Grenade Barrage") already occupies whichever
 * F-slot the equipped Heal/Utility choice maps to (see `engineerToolbeltBar`), so repurposing that
 * icon as the kit-swap click target would show the wrong icon for the wrong action. Every equipped
 * kit/tome/Shroud/Celestial-Avatar always contributes to boon/condition totals regardless of this
 * toggle (see `Build.activeBundleSkillId`'s doc comment) — this only changes what's shown.
 *
 * For a Weaver, `Build.weaverPreviousAttunement` — the second, "previous" attunement Weaver tracks
 * alongside `activeAttunement` ("current") — has no toggle of its own here at all: clicking
 * `ProfessionMechanicBar`'s F1-F4 "current"-attunement row sets it too, demoting whatever was
 * `activeAttunement` a moment ago into `weaverPreviousAttunement`, same as attuning for real. Weaver
 * tracks two attunements at once, current (main-hand, weapon skills 1-2) and previous (off-hand,
 * weapon skills 4-5), with weapon skill 3 a "Dual Attack" determined by both. See
 * `Build.weaverPreviousAttunement`'s and `weapon-calc/weapon-skills.ts`'s doc comments for the full
 * mechanic and how it's resolved; display-only like every toggle here, so `boon-calc/sources.ts`
 * unions every reachable current/previous pair into totals regardless of what's shown.
 */
export function WeaponSkillBar({ build, equippedSpecializationIds, onBuildChange, combatState, section }: Props) {
  const { showUnderwater } = useAppSettings()
  const { gameData, activeIds, legendIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)
  const { professions, skillsById, tomeChapters } = gameData
  const profession = professions.find((p) => p.id === build.profession)

  const isLand = build.environment === 'land'
  const mainKey = isLand ? (build.activeWeaponSet === 'A' ? 'weaponA1' : 'weaponB1') : build.activeUnderwaterSet === 'U1' ? 'weaponU1' : 'weaponU2'
  const offKey = isLand ? (build.activeWeaponSet === 'A' ? 'weaponA2' : 'weaponB2') : null

  const mainType = build.equipment[mainKey]?.weaponType
  const offType = offKey ? build.equipment[offKey]?.weaponType : undefined
  const mainWeapon = mainType && profession ? profession.weapons[mainType] : undefined
  // Mirror main-hand into off-hand only for an actual two-handed weapon (Staff, Greatsword, ...),
  // where the same weapon object legitimately supplies weapon skills 4-5 too. A one-handed weapon
  // (Dagger, Sword, ...) with no off-hand piece equipped must NOT fall back to mainWeapon here: its
  // `skills` list already contains its off-hand (4-5) variants alongside its main-hand (1-3) ones
  // (one weapon-type entry covers both hands), so mirroring it would auto-populate off-hand skills
  // that shouldn't appear until an off-hand item is actually equipped.
  const mainIsTwoHanded = mainWeapon?.flags.includes('TwoHand') ?? false
  const offWeapon = offType && profession ? profession.weapons[offType] : mainIsTwoHanded ? mainWeapon : undefined

  const isElementalist = build.profession === 'Elementalist'
  const isWeaver = equippedSpecializationIds.has(WEAVER_SPEC_ID)
  const baseSkillIds = profession
    ? weaponSkillIdsForPair(
        mainWeapon,
        offWeapon,
        build.environment,
        skillsById,
        equippedSpecializationIds,
        mainType ?? null,
        offType ?? null,
        isElementalist ? build.activeAttunement : null,
        isWeaver ? build.weaverPreviousAttunement : null
      )
    : []
  const hasAnyWeapon = mainWeapon !== undefined || offWeapon !== undefined
  const variantContext: SkillVariantContext = {
    skills: gameData.skills,
    skillsById,
    wvwFactOverrides: gameData.wvwFactOverrides,
    legendIds,
    legends: gameData.legends,
    durationPercent,
    characterAttributes,
    targetArmor,
    // Never matches here either — the weapon bar's own skill ids are never a Glyph's canonical id
    // — but kept accurate (rather than hardcoded `false`/empty) since this component already knows
    // the real toggle state and attunement.
    glyphFormVariants: gameData.glyphFormVariants,
    celestialAvatarActive: build.activeBundleSkillId === CELESTIAL_AVATAR_SKILL_ID,
    activeAttunement: build.activeAttunement
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
    const facts = boonConditionFactsForSkill(skill, activeIds, legendIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id], gameData.legends)
    return skillTooltipContent(skill, facts, activeIds, variantContext)
  }

  function tomeChapterTooltip(chapter: TomeChapter) {
    const boonFacts = tomeChapterBoonSources(chapter, durationPercent)
    const boonNames = new Set(boonFacts.map((f) => f.boonOrConditionName))
    const numericLines = chapter.facts
      .filter((f) => !(isBoonName(f.label) || isConditionName(f.label)) || !boonNames.has(f.label.charAt(0).toUpperCase() + f.label.slice(1)))
      .map((f) => ({ icon: null, text: formatFactLine(f) }))
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
                <div className="skill-slot-stack" key={i}>
                  <Tooltip content={skillTooltipFor(slot.skill.id) ?? <TooltipBody title="Unknown skill" />}>
                    <button type="button" className="skill-slot-button" disabled>
                      <img src={slot.skill.icon} alt={slot.skill.name} />
                    </button>
                  </Tooltip>
                  <FlipSkillStack skill={slot.skill} activeIds={activeIds} variantContext={variantContext} />
                </div>
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
              <div className="skill-slot-stack" key={i}>
                <Tooltip content={skill ? (skillTooltipFor(skill.id) ?? <TooltipBody title="Unknown skill" />) : <TooltipBody title="Empty" />}>
                  <button type="button" className="skill-slot-button" disabled>
                    {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">—</span>}
                  </button>
                </Tooltip>
                <FlipSkillStack skill={skill} activeIds={activeIds} variantContext={variantContext} />
              </div>
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
    const hasExtras = unleashedId !== null || toggleRowIds.length > 0
    if (!hasExtras) return null
    return (
      <div className="ingame-skill-bar-extras">
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
          <div className="skill-bar">
            <Tooltip content={<TooltipBody title="Weapon" />}>
              <button
                type="button"
                className={activeBundleId === null ? 'skill-slot-button active' : 'skill-slot-button'}
                onClick={() => onBuildChange({ activeBundleSkillId: null })}
              >
                <span className="skill-slot-placeholder">Weapon</span>
              </button>
            </Tooltip>
            {toggleRowIds.map((id) => {
              const skill = skillsById.get(id)
              const isActive = activeBundleId === id
              return (
                <Tooltip key={id} content={skill ? (skillTooltipFor(skill.id) ?? <TooltipBody title={skill.name} />) : <TooltipBody title={`#${id}`} />}>
                  <button
                    type="button"
                    className={isActive ? 'skill-slot-button active' : 'skill-slot-button'}
                    onClick={() => onBuildChange({ activeBundleSkillId: isActive ? null : id })}
                  >
                    {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">{`#${id}`}</span>}
                  </button>
                </Tooltip>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (section === 'env') {
    // `build` here is already `BuildEditorView`'s underwater-setting-sanitized `displayBuild` when
    // the toggle is off (forced `environment: 'land'`, see `withUnderwaterSetting`), so `isLand` is
    // already always true in that case — hiding the button too avoids a dead control that would
    // look clickable but can never actually reach the (already-hidden) underwater bar.
    if (!showUnderwater) return null
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
