import { useMemo, useRef, useState } from 'react'
import type { Build, RevenantSkillSelection, Skill, SkillSelection, StandardSkillSelection, WvwFactOverride, WvwFactOverrides } from '@shared/types'
import {
  activeTraitIds,
  auraFactsForSkill,
  BOON_STRIP_CORRUPT_MATCHERS,
  boonConditionFactsForSkill,
  CONTROL_MATCHERS,
  comboFactsForSkill,
  MISCELLANEOUS_MATCHERS,
  NAMED_FACT_TARGET_COUNT_TABLES,
  namedFactsForSkill,
  type BoonConditionSource,
  type ComboSource,
  type NamedFactSource
} from '@shared/boon-calc/sources'
import { skillFactLines } from '@shared/skill-calc/skill-fact-lines'
import type { FactLine } from '@shared/skill-calc/fact-numbers'
import { flipTargetSkills, relatedVariantSkills } from '@shared/skill-calc/multi-effect'
import { VINDICATOR_SPEC_ID, vindicatorAspectSkillId } from '@shared/skill-calc/vindicator-aspect'
import { CELESTIAL_AVATAR_SKILL_ID } from '@shared/skill-calc/bundle-skills'
import { skillPickerCategory } from '@shared/skill-calc/skill-category-overrides'
import { glyphFormDisplayIcon, glyphFormFactSourceSkill } from '@shared/skill-calc/glyph-forms'
import type { GlyphFormVariantMap } from '@shared/types'
import { isRacialSkill } from '@shared/skill-calc/racial-skills'
import { formatBoonDuration, formatTargetCount } from '@shared/boon-calc/format'
import { AURA_ICONS, BOON_CONDITION_ICONS, BOON_STRIP_CORRUPT_ICONS, COMBO_ICONS, CONTROL_ICONS, MISCELLANEOUS_ICONS } from '@shared/boon-calc/icons'
import { boonDurationPercent, computeGearAttributeTotals, conditionDurationPercent } from '@shared/gear-calc/attribute-totals'
import { computeCharacterStats } from '@shared/gear-calc/derived-stats'
import { DEFAULT_COMBAT_STATE, TARGET_ARMOR_VALUES, type CombatState } from '@shared/gear-calc/combat-state'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { useGameData } from '@renderer/state/game-data-store'
import { usePickerOpen } from '@renderer/state/picker-registry'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { FloatingPanel } from '@renderer/components/common/FloatingPanel'
import { WeaponSkillBar } from './WeaponSkillBar'
import { ProfessionMechanicBar } from './ProfessionMechanicBar'
import { PetsEditor } from './PetsEditor'
import { SkillBarIcon } from './SkillBarIcon'

interface Props {
  build: Build
  value: SkillSelection
  onChange: (value: SkillSelection) => void
  onBuildChange: (
    patch: Partial<
      Pick<
        Build,
        | 'environment'
        | 'activeWeaponSet'
        | 'activeUnderwaterSet'
        | 'equippedPetIds'
        | 'activePetIndex'
        | 'activeBundleSkillId'
        | 'rangerUnleashed'
        | 'familiarId'
        | 'thiefStolenSkillId'
        | 'vindicatorAspectFlipped'
      >
    >
  ) => void
  equippedSpecializationIds: ReadonlySet<number>
  /** Threaded down to every skill tooltip in this bar so their real Damage/Healing numbers (see
   *  `skillFactLines`) match `StatsPanel`'s displayed Power/Healing Power and the target-armor
   *  assumption, instead of silently ignoring combat-state toggles. */
  combatState?: CombatState
}

type SlotId = 'heal' | 'utility0' | 'utility1' | 'utility2' | 'elite'

/**
 * Laid out as a CSS grid mirroring the real HUD's bottom bar: a Land/Underwater toggle icon sits
 * above a weapon-swap cycle icon (that pair forms its own narrow left column), next to it the
 * profession-mechanic F1-F5 row sits above the weapon 1-5 skills, then a thin divider, then the
 * Heal/Utility/Elite (or Legend) skills. The Boons/Conditions icon rows that used to sit here moved
 * to `BoonConditionSummaryPanel` (see COMPLETED.md) — this bar is weapon/mechanic/heal-utility-elite
 * only now. Every piece below is a *direct* child of `.ingame-skill-bar` — each one declares its own
 * `grid-area` (see the CSS) rather than being nested in a JS-side wrapper div — so the two skill
 * rows (`weapon`/`utility-skills`) land in the same grid row and line up exactly regardless of how
 * tall the profession-mechanic bar or the legend-picker row above them is.
 */
export function SkillsEditor({ build, value, onChange, onBuildChange, equippedSpecializationIds, combatState = DEFAULT_COMBAT_STATE }: Props) {
  return (
    <div className="skills-editor-root">
      {build.profession === 'Ranger' && (
        <PetsEditor build={build} onBuildChange={onBuildChange} equippedSpecializationIds={equippedSpecializationIds} combatState={combatState} />
      )}
      <WeaponSkillBar
        build={build}
        equippedSpecializationIds={equippedSpecializationIds}
        onBuildChange={onBuildChange}
        section="extras"
        combatState={combatState}
      />
      <div className="ingame-skill-bar">
        <WeaponSkillBar
          build={build}
          equippedSpecializationIds={equippedSpecializationIds}
          onBuildChange={onBuildChange}
          section="env"
          combatState={combatState}
        />
        <ProfessionMechanicBar
          build={build}
          equippedSpecializationIds={equippedSpecializationIds}
          onBuildChange={onBuildChange}
          combatState={combatState}
        />
        <WeaponSkillBar
          build={build}
          equippedSpecializationIds={equippedSpecializationIds}
          onBuildChange={onBuildChange}
          section="swap"
          combatState={combatState}
        />
        <WeaponSkillBar
          build={build}
          equippedSpecializationIds={equippedSpecializationIds}
          onBuildChange={onBuildChange}
          section="weapon"
          combatState={combatState}
        />
        <div className="ingame-skill-bar-divider" />
        {value.kind === 'revenant' ? (
          <>
            <RevenantSkillsEditor
              build={build}
              value={value}
              onChange={onChange}
              equippedSpecializationIds={equippedSpecializationIds}
              combatState={combatState}
              section="select"
            />
            <RevenantSkillsEditor
              build={build}
              value={value}
              onChange={onChange}
              equippedSpecializationIds={equippedSpecializationIds}
              combatState={combatState}
              section="bar"
            />
          </>
        ) : (
          <StandardSkillsEditor
            build={build}
            value={value}
            onChange={onChange}
            equippedSpecializationIds={equippedSpecializationIds}
            combatState={combatState}
          />
        )}
      </div>
    </div>
  )
}

/** Shared by both editors: activeTraitIds + gear-derived boon/condition duration %, needed to
 *  compute a skill's scaled boon/condition tooltip facts the same way `BoonUptimePanel` does, plus
 *  the current Power/Healing Power/target-armor a skill tooltip's real Damage/Healing lines (see
 *  `skillFactLines`) scale against — same `computeCharacterStats` call `StatsPanel` uses, so both
 *  agree. */
export function useDurationContext(build: Build, combatState: CombatState = DEFAULT_COMBAT_STATE) {
  const gameData = useGameData()
  const activeIds = useMemo(() => activeTraitIds(build, gameData.traits), [build, gameData.traits])
  const durationPercent = useMemo(() => {
    const totals = computeGearAttributeTotals(build, gameData)
    return { boon: boonDurationPercent(totals), condition: conditionDurationPercent(totals) }
  }, [build, gameData])
  const characterAttributes = useMemo(() => computeCharacterStats(build, gameData, combatState).attributes, [build, gameData, combatState])
  const targetArmor = TARGET_ARMOR_VALUES[combatState.targetArmorClass]
  return { gameData, activeIds, durationPercent, characterAttributes, targetArmor }
}

const BOON_CONDITION_ICONS_BY_NAME: Record<string, string> = BOON_CONDITION_ICONS
const AURA_ICONS_BY_NAME: Record<string, string> = AURA_ICONS
/** Control/Miscellaneous/Strip-Corrupt-Cleanse names never collide (confirmed by each matcher
 *  table's own doc comment in sources.ts — 3 disjoint, hand-verified label sets), so one merged
 *  icon lookup covers every `NamedFactSource.name` a skill tooltip can produce. */
const NAMED_FACT_ICONS_BY_NAME: Record<string, string> = { ...CONTROL_ICONS, ...MISCELLANEOUS_ICONS, ...BOON_STRIP_CORRUPT_ICONS }

/** Optional extra fact categories `factsBlock` renders below the boon/condition list — everything
 *  `computeAuraSources`/`computeNamedFactSources`/`computeComboSources` cover for a whole build,
 *  now available per-skill too (see `auraFactsForSkill`/`namedFactsForSkill`/`comboFactsForSkill`).
 *  Optional/defaulted so every pre-existing `factsBlock` call site (trait tooltips, which don't
 *  compute any of these) keeps compiling unchanged. */
export interface SkillNamedFacts {
  auraFacts?: BoonConditionSource[]
  namedFactSources?: NamedFactSource[]
  comboFacts?: ComboSource[]
}

export function factsBlock(numericLines: FactLine[], boonFacts: BoonConditionSource[], namedFacts: SkillNamedFacts = {}) {
  const { auraFacts = [], namedFactSources = [], comboFacts = [] } = namedFacts
  return (
    <>
      {numericLines.length > 0 && (
        <ul className="tooltip-numeric-facts">
          {numericLines.map((line, i) => (
            <li key={i}>
              {line.icon && <img className="tooltip-fact-icon" src={line.icon} alt="" />}
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
      )}
      {boonFacts.length > 0 && (
        <ul className="tooltip-boon-facts">
          {boonFacts.map((f, i) => (
            <li key={i}>
              <span className="tooltip-fact-label">
                {BOON_CONDITION_ICONS_BY_NAME[f.boonOrConditionName] && (
                  <img className="tooltip-fact-icon" src={BOON_CONDITION_ICONS_BY_NAME[f.boonOrConditionName]} alt="" />
                )}
                <span>{f.boonOrConditionName}</span>
                {f.category === 'boon' && f.targetCount !== null && (
                  <span className="boon-source-target">{formatTargetCount(f.targetCount)}</span>
                )}
              </span>
              <span className="boon-source-duration">
                {formatBoonDuration(f.scaledDurationSeconds)}s
                {f.applyCount > 1 ? ` × ${f.applyCount}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {auraFacts.length > 0 && (
        <ul className="tooltip-boon-facts">
          {auraFacts.map((f, i) => (
            <li key={i}>
              <span className="tooltip-fact-label">
                {AURA_ICONS_BY_NAME[f.boonOrConditionName] && (
                  <img className="tooltip-fact-icon" src={AURA_ICONS_BY_NAME[f.boonOrConditionName]} alt="" />
                )}
                <span>{f.boonOrConditionName}</span>
              </span>
              <span className="boon-source-duration">
                {formatBoonDuration(f.scaledDurationSeconds)}s
                {f.applyCount > 1 ? ` × ${f.applyCount}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {namedFactSources.length > 0 && (
        <ul className="tooltip-boon-facts">
          {namedFactSources.map((f, i) => (
            <li key={i}>
              <span className="tooltip-fact-label">
                {NAMED_FACT_ICONS_BY_NAME[f.name] && <img className="tooltip-fact-icon" src={NAMED_FACT_ICONS_BY_NAME[f.name]} alt="" />}
                <span>{f.name}</span>
                {f.targetCount !== null && <span className="boon-source-target">{formatTargetCount(f.targetCount)}</span>}
              </span>
              {f.detail && <span className="boon-source-duration">{f.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {comboFacts.length > 0 && (
        <ul className="tooltip-boon-facts">
          {comboFacts.map((f, i) => (
            <li key={i}>
              <span className="tooltip-fact-label">
                <img className="tooltip-fact-icon" src={COMBO_ICONS[f.kind]} alt="" />
                <span>Combo {f.kind === 'field' ? 'Field' : 'Finisher'}</span>
              </span>
              <span className="boon-source-duration">{f.fieldType ?? f.finisherType}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Every non-boon/condition category a single skill's tooltip should show — Auras plus the 3
 *  `computeNamedFactSources` matcher tables (Control/Miscellaneous/Strip-Corrupt-Cleanse) plus
 *  Combo Field/Finisher, all bundled into one `SkillNamedFacts` for `factsBlock`. Shared by
 *  `skillTooltipContent` (base skill + each variant) and `ProfessionMechanicBar`'s own inline
 *  tooltip builder, which deliberately doesn't call `skillTooltipContent` itself (see that
 *  component's doc comment) but still needs the same fact categories. */
export function skillNamedFacts(skill: Skill, activeIds: Set<number>, wvwOverride: Record<string, WvwFactOverride> | undefined): SkillNamedFacts {
  return {
    auraFacts: auraFactsForSkill(skill, activeIds, wvwOverride),
    namedFactSources: [
      ...namedFactsForSkill(skill, activeIds, CONTROL_MATCHERS),
      ...namedFactsForSkill(skill, activeIds, MISCELLANEOUS_MATCHERS),
      ...namedFactsForSkill(skill, activeIds, BOON_STRIP_CORRUPT_MATCHERS, NAMED_FACT_TARGET_COUNT_TABLES)
    ],
    comboFacts: comboFactsForSkill(skill, activeIds)
  }
}

export interface SkillVariantContext {
  skills: Skill[]
  skillsById: Map<number, Skill>
  wvwFactOverrides: WvwFactOverrides
  durationPercent: { boon: number; condition: number }
  /** Current Power/Healing Power (`useDurationContext`'s `characterAttributes`) and assumed target
   *  armor a skill's real Damage/Healing tooltip lines scale against — see `skillFactLines`. */
  characterAttributes: { power: number; healingPower: number }
  targetArmor: number
  /** Wiki-sourced Druid Glyph normal/celestial form data plus whether the build's Celestial Avatar
   *  toggle is currently on — see `glyph-forms.ts`'s `glyphFormFactSourceSkill`. Harmless for every
   *  non-Ranger build: `glyphFormVariants` never matches a non-Glyph skill id. */
  glyphFormVariants: GlyphFormVariantMap
  celestialAvatarActive: boolean
}

/**
 * `variantContext` surfaces a skill's collapsed-away attunement variants (e.g. every Elementalist
 * Glyph's per-attunement effect) and activation-chain targets (e.g. a Mantra's charged cast) below
 * its own facts — see `multi-effect.ts`'s doc comment for why these are only shown here, on an
 * already-equipped skill, rather than as extra picker entries.
 *
 * A Druid Glyph is different: its 2 forms are a swap, not a stack (see `glyph-forms.ts`), so
 * rather than appending a `tooltip-skill-variant` block, the *whole* tooltip (description +
 * facts) is sourced from whichever form's own skill id matches the build's current Celestial
 * Avatar toggle state — `skill` itself (the canonical id every Glyph collapses to in the picker,
 * see `skill-variants.ts` signal 5) carries only a generic, low-fact-count description, never the
 * real per-form numbers.
 */
export function skillTooltipContent(skill: Skill, facts: BoonConditionSource[], activeIds: Set<number>, variantContext: SkillVariantContext) {
  const { power, healingPower } = variantContext.characterAttributes
  const glyphFormSkill = glyphFormFactSourceSkill(skill, variantContext.celestialAvatarActive, variantContext.glyphFormVariants, variantContext.skillsById)
  const factSourceSkill = glyphFormSkill ?? skill
  const numericLines = skillFactLines(factSourceSkill, activeIds, power, healingPower, variantContext.targetArmor)
  const effectiveFacts = glyphFormSkill
    ? boonConditionFactsForSkill(glyphFormSkill, activeIds, variantContext.durationPercent, variantContext.wvwFactOverrides.skill[glyphFormSkill.id])
    : facts
  const effectiveNamedFacts = skillNamedFacts(factSourceSkill, activeIds, variantContext.wvwFactOverrides.skill[factSourceSkill.id])
  const variants = relatedVariantSkills(skill, variantContext.skills)
  return (
    <>
      <TooltipBody title={skill.name} description={factSourceSkill.description} />
      {factsBlock(numericLines, effectiveFacts, effectiveNamedFacts)}
      {variants.map((v) => {
        const vNumeric = skillFactLines(v.skill, activeIds, power, healingPower, variantContext.targetArmor)
        const vBoon = boonConditionFactsForSkill(
          v.skill,
          activeIds,
          variantContext.durationPercent,
          variantContext.wvwFactOverrides.skill[v.skill.id]
        )
        const vNamedFacts = skillNamedFacts(v.skill, activeIds, variantContext.wvwFactOverrides.skill[v.skill.id])
        return (
          <div className="tooltip-skill-variant" key={v.skill.id}>
            <TooltipBody title={v.label} description={v.skill.description !== skill.description ? v.skill.description : undefined} />
            {factsBlock(vNumeric, vBoon, vNamedFacts)}
          </div>
        )
      })}
    </>
  )
}

/**
 * Renders a skill's `flipSkill` chain (see `multi-effect.ts`'s `flipTargetSkills`) as its own
 * column of small stacked icons below the base skill's normal slot — gw2skills.net's convention:
 * always visible together (not a toggle), each with its own independent tooltip carrying that
 * target's real facts (the same `skillTooltipContent`/`boonConditionFactsForSkill` path the base
 * skill uses), rather than nested text inside one shared tooltip. Renders nothing for a skill with
 * no flip target (the overwhelming majority) or an empty slot.
 */
export function FlipSkillStack({
  skill,
  activeIds,
  variantContext
}: {
  skill: Skill | undefined
  activeIds: Set<number>
  variantContext: SkillVariantContext
}) {
  if (!skill) return null
  const flips = flipTargetSkills(skill, variantContext.skillsById)
  if (flips.length === 0) return null
  return (
    <div className="skill-slot-flip-stack">
      {flips.map((f) => {
        const facts = boonConditionFactsForSkill(f.skill, activeIds, variantContext.durationPercent, variantContext.wvwFactOverrides.skill[f.skill.id])
        return (
          <Tooltip key={f.skill.id} content={skillTooltipContent(f.skill, facts, activeIds, variantContext)}>
            <span className="skill-slot-flip-icon">
              <img src={f.skill.icon} alt={f.label} />
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}

/**
 * Groups a Heal/Utility/Elite skill list by its GW2-native `categories[0]` (e.g. "Meditation",
 * "Signet") — matches gw2skills' picker, which sorts skills into columns by the profession
 * mechanic they belong to instead of one long flat grid. A skill with no category (a real chunk of
 * them, e.g. Guardian's "Shelter") falls into an uncategorized bucket, always shown last so the
 * meaningful groupings stay up front. `skillPickerCategory` applies a small curated override table
 * first, for the handful of skills the API itself returns with an empty `categories` array despite
 * clearly belonging to a named mechanic family (Troubadour's Tales, Mirage's Mirror/Retreat) — see
 * that function's doc comment.
 */
function groupSkillsByCategory(skills: Skill[]): { category: string | null; skills: Skill[] }[] {
  const order: (string | null)[] = []
  const bySkillCategory = new Map<string | null, Skill[]>()
  for (const skill of skills) {
    const category = skillPickerCategory(skill)
    if (!bySkillCategory.has(category)) {
      bySkillCategory.set(category, [])
      order.push(category)
    }
    bySkillCategory.get(category)!.push(skill)
  }
  order.sort((a, b) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
  return order.map((category) => ({ category, skills: bySkillCategory.get(category)! }))
}

interface StandardProps {
  build: Build
  value: StandardSkillSelection
  onChange: (value: SkillSelection) => void
  equippedSpecializationIds: ReadonlySet<number>
  combatState: CombatState
}

function StandardSkillsEditor({ build, value, onChange, equippedSpecializationIds, combatState }: StandardProps) {
  const profession = build.profession
  const { gameData, activeIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)
  const { skillsById, skillsForProfessionAndSlot } = gameData
  const { showRacialSkills } = useAppSettings()
  const { open, openThis, close } = usePickerOpen()
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null)
  const slotButtonRefs = useRef<Partial<Record<SlotId, HTMLButtonElement | null>>>({})

  // Racial skills are filtered from the *option list* only — an already-equipped racial skill
  // (chosen before the setting was turned off) still resolves fine via `skillsById` and renders
  // normally, same as `showUnderwater` never strips a saved build's data.
  const filterRacial = (options: Skill[]): Skill[] => (showRacialSkills ? options : options.filter((s) => !isRacialSkill(s)))
  const healOptions = filterRacial(
    skillsForProfessionAndSlot(profession, 'Heal', equippedSpecializationIds, build.familiarId, activeIds)
  )
  const utilityOptions = filterRacial(
    skillsForProfessionAndSlot(profession, 'Utility', equippedSpecializationIds, null, activeIds)
  )
  const eliteOptions = filterRacial(
    skillsForProfessionAndSlot(profession, 'Elite', equippedSpecializationIds, null, activeIds)
  )

  function skillFacts(skill: Skill): BoonConditionSource[] {
    return boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
  }

  const variantContext: SkillVariantContext = {
    skills: gameData.skills,
    skillsById,
    wvwFactOverrides: gameData.wvwFactOverrides,
    durationPercent,
    characterAttributes,
    targetArmor,
    glyphFormVariants: gameData.glyphFormVariants,
    celestialAvatarActive: build.activeBundleSkillId === CELESTIAL_AVATAR_SKILL_ID
  }

  function setUtility(slotIndex: 0 | 1 | 2, skillId: number | null): void {
    const utility: StandardSkillSelection['utility'] = [...value.utility]
    utility[slotIndex] = skillId
    onChange({ ...value, utility })
  }

  function slotConfig(slot: SlotId): { label: string; chosenId: number | null; options: Skill[]; select: (id: number | null) => void } {
    switch (slot) {
      case 'heal':
        return { label: 'Heal', chosenId: value.heal, options: healOptions, select: (id) => onChange({ ...value, heal: id }) }
      case 'elite':
        return { label: 'Elite', chosenId: value.elite, options: eliteOptions, select: (id) => onChange({ ...value, elite: id }) }
      default: {
        const slotIndex = Number(slot.slice(-1)) as 0 | 1 | 2
        const chosenElsewhere = value.utility.filter((_, i) => i !== slotIndex)
        return {
          label: `Utility ${slotIndex + 1}`,
          chosenId: value.utility[slotIndex],
          options: utilityOptions.filter((s) => !chosenElsewhere.includes(s.id)),
          select: (id) => setUtility(slotIndex, id)
        }
      }
    }
  }

  const slots: SlotId[] = ['heal', 'utility0', 'utility1', 'utility2', 'elite']

  return (
    <div className="skills-editor ingame-skill-bar-utility-skills">
      <div className="skill-bar">
        {slots.map((slot) => {
          const { label, chosenId } = slotConfig(slot)
          const chosen = chosenId !== null ? skillsById.get(chosenId) : undefined
          return (
            <div className="skill-slot-stack" key={slot}>
              <Tooltip content={chosen ? skillTooltipContent(chosen, skillFacts(chosen), activeIds, variantContext) : <TooltipBody title={label} />}>
                <button
                  ref={(el) => {
                    slotButtonRefs.current[slot] = el
                  }}
                  type="button"
                  className={open && openSlot === slot ? 'skill-slot-button open' : 'skill-slot-button'}
                  onClick={() => {
                    if (open && openSlot === slot) {
                      close()
                    } else {
                      setOpenSlot(slot)
                      openThis()
                    }
                  }}
                >
                  {chosen ? (
                    <img
                      src={glyphFormDisplayIcon(chosen, variantContext.celestialAvatarActive, variantContext.glyphFormVariants, skillsById)}
                      alt={chosen.name}
                    />
                  ) : (
                    <span className="skill-slot-placeholder">{label}</span>
                  )}
                </button>
              </Tooltip>
              <FlipSkillStack skill={chosen} activeIds={activeIds} variantContext={variantContext} />
            </div>
          )
        })}
      </div>

      {openSlot &&
        (() => {
          const { label, chosenId, options, select } = slotConfig(openSlot)
          function choose(id: number | null): void {
            select(id)
            close()
            setOpenSlot(null)
          }
          return (
            <FloatingPanel
              open={open}
              anchorRef={{ current: slotButtonRefs.current[openSlot] ?? null }}
              onClose={close}
              className="skill-picker"
            >
              <div className="skill-picker-header">{label}</div>
              <div className="skill-picker-columns">
                <div className="skill-category-column">
                  <div className="skill-category-header">&nbsp;</div>
                  <Tooltip content={<TooltipBody title="None" />}>
                    <button
                      type="button"
                      className={chosenId === null ? 'skill-icon-button chosen' : 'skill-icon-button'}
                      onClick={() => choose(null)}
                    >
                      <span className="skill-option-none">—</span>
                    </button>
                  </Tooltip>
                </div>
                {groupSkillsByCategory(options).map(({ category, skills: skillsInCategory }) => (
                  <div className="skill-category-column" key={category ?? '(none)'}>
                    <div className="skill-category-header">{category ?? 'Other'}</div>
                    {skillsInCategory.map((s) => (
                      <Tooltip key={s.id} content={skillTooltipContent(s, skillFacts(s), activeIds, variantContext)}>
                        <button
                          type="button"
                          className={chosenId === s.id ? 'skill-icon-button chosen' : 'skill-icon-button'}
                          onClick={() => choose(s.id)}
                        >
                          <img src={s.icon} alt={s.name} />
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </div>
            </FloatingPanel>
          )
        })()}
    </div>
  )
}

interface RevenantProps {
  build: Build
  value: RevenantSkillSelection
  onChange: (value: SkillSelection) => void
  equippedSpecializationIds: ReadonlySet<number>
  combatState: CombatState
  /** Split the same way `WeaponSkillBar` is (see its doc comment): `select` is the Legend 1/Legend
   *  2 pickers plus the cycle icon between them that swaps which legend is active, `bar` is just
   *  the resulting read-only skill row — so `SkillsEditor` can align `bar` with the weapon skills
   *  row regardless of how tall the picker row above it is. */
  section: 'select' | 'bar'
}

/**
 * Revenant equips 2 Legends at once (each a *fixed* heal/3 utility/elite kit — not picked
 * skill-by-skill) and swaps between them in combat. The editor mirrors that: 2 legend slots
 * (each opens a picker of legends available given the equipped specializations) with a cycle icon
 * between them to swap which one is active, and the currently-active legend's fixed skill bar
 * (read-only icons with boon/condition tooltips, same as the standard skill bar).
 */
function RevenantSkillsEditor({ build, value, onChange, equippedSpecializationIds, combatState, section }: RevenantProps) {
  const { gameData, activeIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)
  const { skillsById, legendsById, legendsForSpecializations } = gameData
  const { open, openThis, close } = usePickerOpen()
  const [openLegendSlot, setOpenLegendSlot] = useState<0 | 1 | null>(null)
  const legendButtonRefs = useRef<[HTMLButtonElement | null, HTMLButtonElement | null]>([null, null])

  const availableLegends = legendsForSpecializations(equippedSpecializationIds)
  const variantContext: SkillVariantContext = {
    skills: gameData.skills,
    skillsById,
    wvwFactOverrides: gameData.wvwFactOverrides,
    durationPercent,
    characterAttributes,
    targetArmor,
    // Revenant never equips a Druid Glyph — `glyphFormFactSourceSkill` simply never matches any
    // Legend skill id, so this is a harmless empty/false pair, not a meaningful Revenant toggle.
    glyphFormVariants: gameData.glyphFormVariants,
    celestialAvatarActive: false
  }

  function skillTooltipFor(skillId: number) {
    const skill = skillsById.get(skillId)
    if (!skill) return null
    const facts = boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
    return skillTooltipContent(skill, facts, activeIds, variantContext)
  }

  function chooseLegend(slotIndex: 0 | 1, legendId: string | null): void {
    const legends: [string | null, string | null] = [...value.legends]
    legends[slotIndex] = legendId
    onChange({ ...value, legends })
    close()
    setOpenLegendSlot(null)
  }

  if (section === 'bar') {
    const activeLegendId = value.legends[value.activeLegendIndex]
    const activeLegend = activeLegendId !== null ? legendsById.get(activeLegendId) : undefined
    // Legend7 (Legendary Alliance) only: swap each slot's base ("Aspect of the Archemorus") id for
    // its "Aspect of Saint Viktor" counterpart when toggled — see `vindicator-aspect.ts`. Every
    // other Legend ignores `vindicatorAspectFlipped` entirely (ids resolve unchanged).
    const aspectFlipped = activeLegend?.specializationId === VINDICATOR_SPEC_ID && build.vindicatorAspectFlipped
    return (
      <div className="ingame-skill-bar-utility-skills skill-bar">
        {activeLegend ? (
          [activeLegend.heal, ...activeLegend.utilities, activeLegend.elite].map((baseSkillId) => {
            const skillId = vindicatorAspectSkillId(baseSkillId, aspectFlipped, skillsById)
            const skill = skillsById.get(skillId)
            return (
              <div className="skill-slot-stack" key={baseSkillId}>
                <Tooltip content={skillTooltipFor(skillId) ?? <TooltipBody title="Unknown skill" />}>
                  <button type="button" className="skill-slot-button" disabled>
                    {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">?</span>}
                  </button>
                </Tooltip>
                <FlipSkillStack skill={skill} activeIds={activeIds} variantContext={variantContext} />
              </div>
            )
          })
        ) : (
          <div className="skill-picker-header">Choose a legend above to see its skill bar</div>
        )}
      </div>
    )
  }

  function legendSlot(slotIndex: 0 | 1) {
    const legendId = value.legends[slotIndex]
    const legend = legendId !== null ? legendsById.get(legendId) : undefined
    const chosenElsewhere = value.legends[slotIndex === 0 ? 1 : 0]
    return (
      <div key={slotIndex} className="legend-slot">
        <div className="legend-slot-label">Legend {slotIndex + 1}</div>
        <Tooltip content={legend ? <TooltipBody title={legend.name} /> : <TooltipBody title="No legend chosen" />}>
          <button
            ref={(el) => {
              legendButtonRefs.current[slotIndex] = el
            }}
            type="button"
            className={open && openLegendSlot === slotIndex ? 'skill-slot-button open' : 'skill-slot-button'}
            onClick={() => {
              if (open && openLegendSlot === slotIndex) {
                close()
              } else {
                setOpenLegendSlot(slotIndex)
                openThis()
              }
            }}
          >
            {legend ? <img src={legend.icon} alt={legend.name} /> : <span className="skill-slot-placeholder">Legend</span>}
          </button>
        </Tooltip>
        {openLegendSlot === slotIndex && (
          <FloatingPanel open={open} anchorRef={{ current: legendButtonRefs.current[slotIndex] }} onClose={close} className="skill-picker">
            <div className="skill-picker-header">Legend {slotIndex + 1}</div>
            <div className="skill-picker-grid">
              <button type="button" className="skill-option-button" onClick={() => chooseLegend(slotIndex, null)}>
                <span className="skill-option-none">—</span>
                <span className="skill-option-name">None</span>
              </button>
              {availableLegends
                .filter((l) => l.id !== chosenElsewhere)
                .map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={legendId === l.id ? 'skill-option-button chosen' : 'skill-option-button'}
                    onClick={() => chooseLegend(slotIndex, l.id)}
                  >
                    <img src={l.icon} alt={l.name} />
                    <span className="skill-option-name">{l.name}</span>
                  </button>
                ))}
            </div>
          </FloatingPanel>
        )}
      </div>
    )
  }

  return (
    <div className="legend-select-row ingame-skill-bar-utility-top">
      {legendSlot(0)}
      <button
        type="button"
        className="skill-bar-icon-button"
        title="Swap active legend"
        onClick={() => onChange({ ...value, activeLegendIndex: value.activeLegendIndex === 0 ? 1 : 0 })}
      >
        <SkillBarIcon kind="cycle" />
      </button>
      {legendSlot(1)}
    </div>
  )
}
