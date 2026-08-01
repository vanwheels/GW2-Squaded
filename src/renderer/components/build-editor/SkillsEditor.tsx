import { useMemo, useState } from 'react'
import type { Build, RevenantSkillSelection, Skill, SkillSelection, StandardSkillSelection, WvwFactOverrides } from '@shared/types'
import { activeTraitIds, boonConditionFactsForSkill, type BoonConditionSource } from '@shared/boon-calc/sources'
import { numericFactLines } from '@shared/skill-calc/fact-numbers'
import { relatedVariantSkills } from '@shared/skill-calc/multi-effect'
import { formatBoonDuration } from '@shared/boon-calc/format'
import { boonDurationPercent, computeGearAttributeTotals, conditionDurationPercent } from '@shared/gear-calc/attribute-totals'
import { EVOKER_SPECIALIZATION_ID } from '@shared/skill-calc/familiar'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { WeaponSkillBar } from './WeaponSkillBar'
import { ProfessionMechanicBar } from './ProfessionMechanicBar'
import { PetsEditor } from './PetsEditor'
import { EvokerFamiliarSelect } from './EvokerFamiliarSelect'
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
      >
    >
  ) => void
  equippedSpecializationIds: ReadonlySet<number>
}

type SlotId = 'heal' | 'utility0' | 'utility1' | 'utility2' | 'elite'

/**
 * Laid out as a CSS grid mirroring the real HUD's bottom bar: a Land/Underwater toggle icon sits
 * above a weapon-swap cycle icon (that pair forms its own narrow left column), next to it the
 * profession-mechanic F1-F5 row sits above the weapon 1-5 skills, then a thin divider, then the
 * Heal/Utility/Elite (or Legend) skills. Every piece below is a *direct* child of
 * `.ingame-skill-bar` — each one declares its own `grid-area` (see the CSS) rather than being
 * nested in a JS-side wrapper div — so the two skill rows (`weapon`/`utility-skills`) land in the
 * same grid row and line up exactly regardless of how tall the profession-mechanic bar or the
 * legend-picker row above them is.
 */
export function SkillsEditor({ build, value, onChange, onBuildChange, equippedSpecializationIds }: Props) {
  return (
    <div className="skills-editor-root">
      {build.profession === 'Ranger' && (
        <PetsEditor build={build} onBuildChange={onBuildChange} equippedSpecializationIds={equippedSpecializationIds} />
      )}
      {build.profession === 'Elementalist' && equippedSpecializationIds.has(EVOKER_SPECIALIZATION_ID) && (
        <EvokerFamiliarSelect value={build.familiarId} onChange={(familiarId) => onBuildChange({ familiarId })} />
      )}
      <WeaponSkillBar build={build} equippedSpecializationIds={equippedSpecializationIds} onBuildChange={onBuildChange} section="extras" />
      <div className="ingame-skill-bar">
        <WeaponSkillBar build={build} equippedSpecializationIds={equippedSpecializationIds} onBuildChange={onBuildChange} section="env" />
        <ProfessionMechanicBar build={build} equippedSpecializationIds={equippedSpecializationIds} onBuildChange={onBuildChange} />
        <WeaponSkillBar build={build} equippedSpecializationIds={equippedSpecializationIds} onBuildChange={onBuildChange} section="swap" />
        <WeaponSkillBar build={build} equippedSpecializationIds={equippedSpecializationIds} onBuildChange={onBuildChange} section="weapon" />
        <div className="ingame-skill-bar-divider" />
        {value.kind === 'revenant' ? (
          <>
            <RevenantSkillsEditor
              build={build}
              value={value}
              onChange={onChange}
              equippedSpecializationIds={equippedSpecializationIds}
              section="select"
            />
            <RevenantSkillsEditor
              build={build}
              value={value}
              onChange={onChange}
              equippedSpecializationIds={equippedSpecializationIds}
              section="bar"
            />
          </>
        ) : (
          <StandardSkillsEditor
            build={build}
            value={value}
            onChange={onChange}
            equippedSpecializationIds={equippedSpecializationIds}
          />
        )}
      </div>
    </div>
  )
}

/** Shared by both editors: activeTraitIds + gear-derived boon/condition duration %, needed to
 *  compute a skill's scaled boon/condition tooltip facts the same way `BoonUptimePanel` does. */
export function useDurationContext(build: Build) {
  const gameData = useGameData()
  const activeIds = useMemo(() => activeTraitIds(build, gameData.traits), [build, gameData.traits])
  const durationPercent = useMemo(() => {
    const totals = computeGearAttributeTotals(build, gameData)
    return { boon: boonDurationPercent(totals), condition: conditionDurationPercent(totals) }
  }, [build, gameData])
  return { gameData, activeIds, durationPercent }
}

export function factsBlock(numericLines: string[], boonFacts: BoonConditionSource[]) {
  return (
    <>
      {numericLines.length > 0 && (
        <ul className="tooltip-numeric-facts">
          {numericLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {boonFacts.length > 0 && (
        <ul className="tooltip-boon-facts">
          {boonFacts.map((f, i) => (
            <li key={i}>
              <span>{f.boonOrConditionName}</span>
              <span className="boon-source-duration">
                {formatBoonDuration(f.scaledDurationSeconds)}s
                {f.applyCount > 1 ? ` × ${f.applyCount}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export interface SkillVariantContext {
  skills: Skill[]
  skillsById: Map<number, Skill>
  wvwFactOverrides: WvwFactOverrides
  durationPercent: { boon: number; condition: number }
}

/**
 * `variantContext` surfaces a skill's collapsed-away attunement variants (e.g. every Elementalist
 * Glyph's per-attunement effect) and activation-chain targets (e.g. a Mantra's charged cast) below
 * its own facts — see `multi-effect.ts`'s doc comment for why these are only shown here, on an
 * already-equipped skill, rather than as extra picker entries.
 */
export function skillTooltipContent(skill: Skill, facts: BoonConditionSource[], activeIds: Set<number>, variantContext: SkillVariantContext) {
  const numericLines = numericFactLines(skill.facts, skill.traitedFacts, activeIds)
  const variants = relatedVariantSkills(skill, variantContext.skills, variantContext.skillsById)
  return (
    <>
      <TooltipBody title={skill.name} description={skill.description} />
      {factsBlock(numericLines, facts)}
      {variants.map((v) => {
        const vNumeric = numericFactLines(v.skill.facts, v.skill.traitedFacts, activeIds)
        const vBoon = boonConditionFactsForSkill(
          v.skill,
          activeIds,
          variantContext.durationPercent,
          variantContext.wvwFactOverrides.skill[v.skill.id]
        )
        return (
          <div className="tooltip-skill-variant" key={v.skill.id}>
            <TooltipBody title={v.label} description={v.skill.description !== skill.description ? v.skill.description : undefined} />
            {factsBlock(vNumeric, vBoon)}
          </div>
        )
      })}
    </>
  )
}

/**
 * Groups a Heal/Utility/Elite skill list by its GW2-native `categories[0]` (e.g. "Meditation",
 * "Signet") — matches gw2skills' picker, which sorts skills into columns by the profession
 * mechanic they belong to instead of one long flat grid. A skill with no category (a real chunk of
 * them, e.g. Guardian's "Shelter") falls into an uncategorized bucket, always shown last so the
 * meaningful groupings stay up front.
 */
function groupSkillsByCategory(skills: Skill[]): { category: string | null; skills: Skill[] }[] {
  const order: (string | null)[] = []
  const bySkillCategory = new Map<string | null, Skill[]>()
  for (const skill of skills) {
    const category = skill.categories[0] ?? null
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
}

function StandardSkillsEditor({ build, value, onChange, equippedSpecializationIds }: StandardProps) {
  const profession = build.profession
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { skillsById, skillsForProfessionAndSlot } = gameData
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null)

  const healOptions = skillsForProfessionAndSlot(profession, 'Heal', equippedSpecializationIds, build.familiarId)
  const utilityOptions = skillsForProfessionAndSlot(profession, 'Utility', equippedSpecializationIds)
  const eliteOptions = skillsForProfessionAndSlot(profession, 'Elite', equippedSpecializationIds)

  function skillFacts(skill: Skill): BoonConditionSource[] {
    return boonConditionFactsForSkill(skill, activeIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id])
  }

  const variantContext: SkillVariantContext = { skills: gameData.skills, skillsById, wvwFactOverrides: gameData.wvwFactOverrides, durationPercent }

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
            <Tooltip
              key={slot}
              content={chosen ? skillTooltipContent(chosen, skillFacts(chosen), activeIds, variantContext) : <TooltipBody title={label} />}
            >
              <button
                type="button"
                className={openSlot === slot ? 'skill-slot-button open' : 'skill-slot-button'}
                onClick={() => setOpenSlot(openSlot === slot ? null : slot)}
              >
                {chosen ? <img src={chosen.icon} alt={chosen.name} /> : <span className="skill-slot-placeholder">{label}</span>}
              </button>
            </Tooltip>
          )
        })}
      </div>

      {openSlot &&
        (() => {
          const { label, chosenId, options, select } = slotConfig(openSlot)
          function choose(id: number | null): void {
            select(id)
            setOpenSlot(null)
          }
          return (
            <div className="skill-picker">
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
            </div>
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
function RevenantSkillsEditor({ build, value, onChange, equippedSpecializationIds, section }: RevenantProps) {
  const { gameData, activeIds, durationPercent } = useDurationContext(build)
  const { skillsById, legendsById, legendsForSpecializations } = gameData
  const [openLegendSlot, setOpenLegendSlot] = useState<0 | 1 | null>(null)

  const availableLegends = legendsForSpecializations(equippedSpecializationIds)
  const variantContext: SkillVariantContext = { skills: gameData.skills, skillsById, wvwFactOverrides: gameData.wvwFactOverrides, durationPercent }

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
    setOpenLegendSlot(null)
  }

  if (section === 'bar') {
    const activeLegendId = value.legends[value.activeLegendIndex]
    const activeLegend = activeLegendId !== null ? legendsById.get(activeLegendId) : undefined
    return (
      <div className="ingame-skill-bar-utility-skills skill-bar">
        {activeLegend ? (
          [activeLegend.heal, ...activeLegend.utilities, activeLegend.elite].map((skillId) => {
            const skill = skillsById.get(skillId)
            return (
              <Tooltip key={skillId} content={skillTooltipFor(skillId) ?? <TooltipBody title="Unknown skill" />}>
                <button type="button" className="skill-slot-button" disabled>
                  {skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">?</span>}
                </button>
              </Tooltip>
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
            type="button"
            className={openLegendSlot === slotIndex ? 'skill-slot-button open' : 'skill-slot-button'}
            onClick={() => setOpenLegendSlot(openLegendSlot === slotIndex ? null : slotIndex)}
          >
            {legend ? <img src={legend.icon} alt={legend.name} /> : <span className="skill-slot-placeholder">Legend</span>}
          </button>
        </Tooltip>
        {openLegendSlot === slotIndex && (
          <div className="skill-picker">
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
          </div>
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
