import type { ProfessionId, TraitLineSelection, TraitLineSlots } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

interface Props {
  profession: ProfessionId
  value: TraitLineSlots
  onChange: (value: TraitLineSlots) => void
}

const LINE_INDICES = [0, 1, 2] as const
/** Adept / Master / Grandmaster, matching GW2's `Trait.tier` (1-3), indexed to `chosenTraitIds`. */
const TIERS = [1, 2, 3] as const
/** Grid rows: 1 = spec-icon picker, 2 = chosen spec name, 3-5 = tiers 1-3 — one row per tier
 *  spanning all 3 columns so CSS Grid sizes each row to its tallest cell, keeping every line's
 *  tiers aligned regardless of which specializations (with differing trait counts) are chosen. */
const TIER_ROW_START = 3

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

  function handleSpecClick(lineIndex: number, specializationId: number): void {
    const line = lines[lineIndex]
    setLine(
      lineIndex,
      line?.specializationId === specializationId ? null : { specializationId, chosenTraitIds: [null, null, null] }
    )
  }

  function handleTraitChoice(lineIndex: number, tierIndex: 0 | 1 | 2, traitId: number): void {
    const line = lines[lineIndex]
    if (!line) return
    const chosenTraitIds: TraitLineSelection['chosenTraitIds'] = [...line.chosenTraitIds]
    chosenTraitIds[tierIndex] = chosenTraitIds[tierIndex] === traitId ? null : traitId
    setLine(lineIndex, { ...line, chosenTraitIds })
  }

  const usedSpecIds = new Set(lines.filter((l): l is TraitLineSelection => l !== null).map((l) => l.specializationId))

  return (
    <div className="traits-editor">
      {LINE_INDICES.map((lineIndex) => {
        const line = lines[lineIndex]
        const availableSpecs = specs.filter(
          (s) =>
            s.id === line?.specializationId ||
            (!usedSpecIds.has(s.id) && !(s.elite && eliteLineIndex !== -1 && eliteLineIndex !== lineIndex))
        )

        return (
          <div className="spec-picker-row" style={{ gridColumn: lineIndex + 1, gridRow: 1 }} key={`picker-${lineIndex}`}>
            {availableSpecs.map((s) => (
              <Tooltip key={s.id} content={<TooltipBody title={s.name} />}>
                <button
                  type="button"
                  className={s.id === line?.specializationId ? 'spec-icon-button chosen' : 'spec-icon-button'}
                  style={{ backgroundImage: `url(${s.icon})` }}
                  onClick={() => handleSpecClick(lineIndex, s.id)}
                />
              </Tooltip>
            ))}
          </div>
        )
      })}

      {LINE_INDICES.map((lineIndex) => {
        const line = lines[lineIndex]
        const chosenSpec = line ? specializationsById.get(line.specializationId) : undefined
        return (
          <div className="spec-line-name" style={{ gridColumn: lineIndex + 1, gridRow: 2 }} key={`name-${lineIndex}`}>
            {chosenSpec?.name}
          </div>
        )
      })}

      {TIERS.map((tier, tierIndex) =>
        LINE_INDICES.map((lineIndex) => {
          const line = lines[lineIndex]
          const chosenSpec = line ? specializationsById.get(line.specializationId) : undefined
          if (!chosenSpec) return <div key={`${tier}-${lineIndex}`} style={{ gridColumn: lineIndex + 1, gridRow: TIER_ROW_START + tierIndex }} />
          const minors = minorTraitsForSpecialization(chosenSpec.id)
          const majors = majorTraitsForSpecialization(chosenSpec.id)
          const minor = minors.find((t) => t.tier === tier)
          const tierMajors = majors.filter((t) => t.tier === tier).sort((a, b) => a.order - b.order)

          return (
            <div
              className="trait-tier-group"
              style={{ gridColumn: lineIndex + 1, gridRow: TIER_ROW_START + tierIndex }}
              key={`${tier}-${lineIndex}`}
            >
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
                      className={line?.chosenTraitIds[tierIndex] === t.id ? 'major-trait selected' : 'major-trait'}
                      onClick={() => handleTraitChoice(lineIndex, tierIndex as 0 | 1 | 2, t.id)}
                    >
                      <img src={t.icon} alt={t.name} />
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
