import type { ProfessionId, TraitLineSelection, TraitLineSlots } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { UpgradePicker, type UpgradeOption } from './UpgradePicker'

interface Props {
  profession: ProfessionId
  value: TraitLineSlots
  onChange: (value: TraitLineSlots) => void
}

const LINE_INDICES = [0, 1, 2] as const
/** Adept / Master / Grandmaster, matching GW2's `Trait.tier` (1-3), indexed to `chosenTraitIds`. */
const TIERS = [1, 2, 3] as const

/**
 * Each of the 3 trait lines is its own horizontal row (gw2skills.net reference layout: Zeal /
 * Virtues / Firebrand stacked, each row reading left-to-right), not a per-line collapsible column —
 * confirmed 2026-07-30 the "collapsible" concept the prior pass borrowed from gw2skills is really
 * about the specialization *picker* (a single button that opens a small overlay of choices and
 * closes on pick), not about hiding a line's tiers. So there's no line-level expand/collapse state
 * here at all: once a spec is chosen for a line, its tiers are always shown, and the spec choice
 * itself is made via the shared `UpgradePicker` click-to-open-overlay widget (the same "selection
 * button" pattern already used for skills/runes/sigils/etc., now applied here and to weapon-type
 * selection in `EquipmentEditor`).
 */
export function TraitsEditor({ profession, value, onChange }: Props) {
  const { specializationsForProfession, specializationsById, majorTraitsForSpecialization, minorTraitsForSpecialization } =
    useGameData()

  const specs = specializationsForProfession(profession)
  const lines = value
  const eliteLineIndex = lines.findIndex((line) => line && specializationsById.get(line.specializationId)?.elite)

  function setLine(lineIndex: number, next: TraitLineSelection | null): void {
    const nextLines = [...lines] as TraitLineSlots
    nextLines[lineIndex] = next
    onChange(nextLines)
  }

  function chooseSpec(lineIndex: number, specializationId: number | null): void {
    if (specializationId === null) {
      setLine(lineIndex, null)
      return
    }
    if (lines[lineIndex]?.specializationId === specializationId) return
    setLine(lineIndex, { specializationId, chosenTraitIds: [null, null, null] })
  }

  function handleTraitChoice(lineIndex: number, tierIndex: 0 | 1 | 2, traitId: number): void {
    const line = lines[lineIndex]
    if (!line) return
    const chosenTraitIds: TraitLineSelection['chosenTraitIds'] = [...line.chosenTraitIds]
    chosenTraitIds[tierIndex] = chosenTraitIds[tierIndex] === traitId ? null : traitId
    setLine(lineIndex, { ...line, chosenTraitIds })
  }

  const usedSpecIds = new Set(lines.filter((l): l is TraitLineSelection => l !== null).map((l) => l.specializationId))

  function tiersRow(lineIndex: number, specId: number, line: TraitLineSelection) {
    return (
      <div className="trait-line-tiers-horizontal">
        {TIERS.map((tier, tierIndex) => {
          const minor = minorTraitsForSpecialization(specId).find((t) => t.tier === tier)
          const tierMajors = majorTraitsForSpecialization(specId)
            .filter((t) => t.tier === tier)
            .sort((a, b) => a.order - b.order)
          return (
            <div className="trait-tier-group" key={tier}>
              {minor && (
                <Tooltip content={<TooltipBody title={minor.name} description={minor.description} />}>
                  <div className="minor-trait">
                    <img src={minor.icon} alt={minor.name} />
                  </div>
                </Tooltip>
              )}
              <div className="major-trait-tier">
                {tierMajors.map((t) => (
                  <Tooltip key={t.id} content={<TooltipBody title={t.name} description={t.description} />}>
                    <button
                      type="button"
                      className={line.chosenTraitIds[tierIndex] === t.id ? 'major-trait selected' : 'major-trait'}
                      onClick={() => handleTraitChoice(lineIndex, tierIndex as 0 | 1 | 2, t.id)}
                    >
                      <img src={t.icon} alt={t.name} />
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="traits-editor">
      {LINE_INDICES.map((lineIndex) => {
        const line = lines[lineIndex]
        const chosenSpec = line ? specializationsById.get(line.specializationId) : undefined
        const availableSpecs = specs.filter(
          (s) =>
            s.id === line?.specializationId ||
            (!usedSpecIds.has(s.id) && !(s.elite && eliteLineIndex !== -1 && eliteLineIndex !== lineIndex))
        )
        const specOptions: UpgradeOption[] = availableSpecs.map((s) => ({ id: s.id, name: s.name, icon: s.icon }))

        return (
          <div className="trait-line" key={lineIndex}>
            <div className="trait-line-spec-select">
              <UpgradePicker
                label="Specialization"
                options={specOptions}
                chosenId={line?.specializationId ?? null}
                onChoose={(id) => chooseSpec(lineIndex, id)}
                variant="slot"
              />
              {chosenSpec && <span className="spec-line-name">{chosenSpec.name}</span>}
            </div>

            {chosenSpec && line && tiersRow(lineIndex, chosenSpec.id, line)}
          </div>
        )
      })}
    </div>
  )
}
