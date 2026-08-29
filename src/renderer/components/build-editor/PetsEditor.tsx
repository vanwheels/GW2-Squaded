import { useRef, useState } from 'react'
import type { Build } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { boonConditionFactsForSkill } from '@shared/boon-calc/sources'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { FloatingPanel } from '@renderer/components/common/FloatingPanel'
import { usePickerOpen } from '@renderer/state/picker-registry'
import { RANGER_BEASTMODE_SPEC_ID } from '@shared/skill-calc/profession-mechanic'
import { SkillBarIcon } from './SkillBarIcon'
import { skillTooltipContent, useDurationContext, type SkillVariantContext } from './SkillsEditor'

interface Props {
  build: Build
  onBuildChange: (patch: Partial<Pick<Build, 'equippedPetIds' | 'activePetIndex'>>) => void
  equippedSpecializationIds: ReadonlySet<number>
  combatState: CombatState
}

/**
 * Ranger's "equipped pet" concept — 2 pet slots + an active-pet toggle showing that pet's one real
 * skill, mirroring `RevenantSkillsEditor`'s legend picker almost exactly (see that component's doc
 * comment). Unlike a Legend, a pet isn't a full heal/utility/elite kit — just the single skill
 * `/v2/pets` exposes — and pets aren't spec-gated at all, so there's no `availableLegends`-style
 * filtering here. Soulbeast is the one spec where the active pet's own F2 skill is NOT shown here:
 * merging with the pet (Beastmode, rendered by `ProfessionMechanicBar`/`soulbeastBeastmodeBar`)
 * replaces its standalone skill bar entirely in-game.
 */
export function PetsEditor({ build, onBuildChange, equippedSpecializationIds, combatState }: Props) {
  const { gameData, activeIds, legendIds, durationPercent, characterAttributes, targetArmor } = useDurationContext(build, combatState)
  const { skillsById, petsById, pets } = gameData
  const { open, openThis, close } = usePickerOpen()
  const [openPetSlot, setOpenPetSlot] = useState<0 | 1 | null>(null)
  const [search, setSearch] = useState('')
  const petButtonRefs = useRef<[HTMLButtonElement | null, HTMLButtonElement | null]>([null, null])
  const query = search.trim().toLowerCase()
  const filteredPets = query ? pets.filter((p) => p.name.toLowerCase().includes(query)) : pets

  const variantContext: SkillVariantContext = {
    skills: gameData.skills,
    skillsById,
    wvwFactOverrides: gameData.wvwFactOverrides,
    rechargeWvwOverrides: gameData.rechargeWvwOverrides,
    resourceCosts: gameData.resourceCosts,
    legendIds,
    legends: gameData.legends,
    durationPercent,
    characterAttributes,
    targetArmor,
    // A pet's own skill is never a Druid/Elementalist Glyph or Evoker Meditation — same "harmless,
    // never matched" reasoning as RevenantSkillsEditor's own variantContext.
    glyphFormVariants: gameData.glyphFormVariants,
    celestialAvatarActive: false,
    activeAttunement: build.activeAttunement,
    familiarElement: null
  }

  function skillTooltipFor(skillId: number) {
    const skill = skillsById.get(skillId)
    if (!skill) return null
    const facts = boonConditionFactsForSkill(skill, activeIds, legendIds, durationPercent, gameData.wvwFactOverrides.skill[skill.id], gameData.legends)
    return skillTooltipContent(skill, facts, activeIds, variantContext)
  }

  function choosePet(slotIndex: 0 | 1, petId: number | null): void {
    const equippedPetIds: [number | null, number | null] = [...build.equippedPetIds]
    equippedPetIds[slotIndex] = petId
    onBuildChange({ equippedPetIds })
    close()
    setOpenPetSlot(null)
    setSearch('')
  }

  function toggleSlot(slotIndex: 0 | 1): void {
    if (open && openPetSlot === slotIndex) {
      close()
    } else {
      setOpenPetSlot(slotIndex)
      openThis()
    }
    setSearch('')
  }

  const activePetId = build.equippedPetIds[build.activePetIndex]
  const activePet = activePetId !== null ? petsById.get(activePetId) : undefined

  function petSlot(slotIndex: 0 | 1) {
    const petId = build.equippedPetIds[slotIndex]
    const pet = petId !== null ? petsById.get(petId) : undefined
    const chosenElsewhere = build.equippedPetIds[slotIndex === 0 ? 1 : 0]
    return (
      <div key={slotIndex} className="legend-slot">
        <div className="legend-slot-label">Pet {slotIndex + 1}</div>
        <Tooltip content={pet ? <TooltipBody title={pet.name} /> : <TooltipBody title="No pet chosen" />}>
          <button
            ref={(el) => {
              petButtonRefs.current[slotIndex] = el
            }}
            type="button"
            className={open && openPetSlot === slotIndex ? 'skill-slot-button open' : 'skill-slot-button'}
            onClick={() => toggleSlot(slotIndex)}
          >
            {pet ? <img src={pet.icon} alt={pet.name} /> : <span className="skill-slot-placeholder">Pet</span>}
          </button>
        </Tooltip>
        {openPetSlot === slotIndex && (
          <FloatingPanel open={open} anchorRef={{ current: petButtonRefs.current[slotIndex] }} onClose={close} className="skill-picker">
            <div className="skill-picker-header">Pet {slotIndex + 1}</div>
            <input
              type="text"
              className="upgrade-picker-search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="skill-picker-grid">
              <button type="button" className="skill-option-button" onClick={() => choosePet(slotIndex, null)}>
                <span className="skill-option-none">—</span>
                <span className="skill-option-name">None</span>
              </button>
              {filteredPets
                .filter((p) => p.id !== chosenElsewhere)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={petId === p.id ? 'skill-option-button chosen' : 'skill-option-button'}
                    onClick={() => choosePet(slotIndex, p.id)}
                  >
                    <img src={p.icon} alt={p.name} />
                    <span className="skill-option-name">{p.name}</span>
                  </button>
                ))}
            </div>
          </FloatingPanel>
        )}
      </div>
    )
  }

  return (
    <div className="skills-editor">
      <div className="legend-select-row">
        {petSlot(0)}
        <button
          type="button"
          className="skill-bar-icon-button"
          title="Swap active pet"
          onClick={() => onBuildChange({ activePetIndex: build.activePetIndex === 0 ? 1 : 0 })}
        >
          <SkillBarIcon kind="cycle" />
        </button>
        {petSlot(1)}
      </div>

      {!equippedSpecializationIds.has(RANGER_BEASTMODE_SPEC_ID) && (
        <div className="skill-bar">
          {activePet ? (
            <Tooltip content={skillTooltipFor(activePet.skillId) ?? <TooltipBody title="Unknown skill" />}>
              <button type="button" className="skill-slot-button" disabled>
                {(() => {
                  const skill = skillsById.get(activePet.skillId)
                  return skill ? <img src={skill.icon} alt={skill.name} /> : <span className="skill-slot-placeholder">?</span>
                })()}
              </button>
            </Tooltip>
          ) : (
            <div className="skill-picker-header">Choose a pet above to see its skill</div>
          )}
        </div>
      )}
    </div>
  )
}
