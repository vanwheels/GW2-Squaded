import type { ProfessionId, TraitLineSelection } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  profession: ProfessionId
  value: TraitLineSelection[]
  onChange: (value: TraitLineSelection[]) => void
}

const LINE_INDICES = [0, 1, 2] as const

function toLines(value: TraitLineSelection[]): (TraitLineSelection | null)[] {
  return LINE_INDICES.map((i) => value[i] ?? null)
}

function fromLines(lines: (TraitLineSelection | null)[]): TraitLineSelection[] {
  return lines.filter((line): line is TraitLineSelection => line !== null)
}

export function TraitsEditor({ profession, value, onChange }: Props) {
  const { specializationsForProfession, specializationsById, majorTraitsForSpecialization, minorTraitsForSpecialization } =
    useGameData()

  const specs = specializationsForProfession(profession)
  const lines = toLines(value)
  const eliteLineIndex = lines.findIndex((line) => line && specializationsById.get(line.specializationId)?.elite)

  function setLine(lineIndex: number, next: TraitLineSelection | null): void {
    const nextLines = [...lines]
    nextLines[lineIndex] = next
    onChange(fromLines(nextLines))
  }

  function handleSpecChange(lineIndex: number, specializationId: number | null): void {
    setLine(lineIndex, specializationId === null ? null : { specializationId, chosenTraitIds: [null, null, null] })
  }

  function handleTraitChoice(lineIndex: number, tierIndex: 0 | 1 | 2, traitId: number): void {
    const line = lines[lineIndex]
    if (!line) return
    const chosenTraitIds: TraitLineSelection['chosenTraitIds'] = [...line.chosenTraitIds]
    chosenTraitIds[tierIndex] = traitId
    setLine(lineIndex, { ...line, chosenTraitIds })
  }

  const usedSpecIds = new Set(lines.filter((l): l is TraitLineSelection => l !== null).map((l) => l.specializationId))

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

        return (
          <div className="trait-line" key={lineIndex}>
            <label className="field">
              <span>Line {lineIndex + 1}</span>
              <select
                value={line?.specializationId ?? ''}
                onChange={(e) => handleSpecChange(lineIndex, e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— None —</option>
                {availableSpecs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.elite ? ' (Elite)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {chosenSpec && (
              <>
                <div className="minor-traits">
                  {minorTraitsForSpecialization(chosenSpec.id).map((t) => (
                    <span key={t.id} className="minor-trait" title={t.description}>
                      {t.name}
                    </span>
                  ))}
                </div>
                <div className="major-trait-tiers">
                  {[0, 1, 2].map((tierIndex) => {
                    const tierTraits = majorTraitsForSpecialization(chosenSpec.id).filter((t) => t.order === tierIndex)
                    return (
                      <div className="major-trait-tier" key={tierIndex}>
                        {tierTraits.map((t) => (
                          <label
                            key={t.id}
                            className={line?.chosenTraitIds[tierIndex] === t.id ? 'trait-choice selected' : 'trait-choice'}
                            title={t.description}
                          >
                            <input
                              type="radio"
                              name={`trait-line-${lineIndex}-tier-${tierIndex}`}
                              checked={line?.chosenTraitIds[tierIndex] === t.id}
                              onChange={() => handleTraitChoice(lineIndex, tierIndex as 0 | 1 | 2, t.id)}
                            />
                            {t.name}
                          </label>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
