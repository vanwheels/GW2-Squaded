import type { ProfessionId, TraitLineSelection } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'

interface Props {
  profession: ProfessionId
  value: TraitLineSelection[]
  onChange: (value: TraitLineSelection[]) => void
}

const LINE_INDICES = [0, 1, 2] as const
/** Adept / Master / Grandmaster, matching GW2's `Trait.tier` (1-3), indexed to `chosenTraitIds`. */
const TIERS = [1, 2, 3] as const

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
        const chosenSpec = line ? specializationsById.get(line.specializationId) : undefined
        const availableSpecs = specs.filter(
          (s) =>
            s.id === line?.specializationId ||
            (!usedSpecIds.has(s.id) && !(s.elite && eliteLineIndex !== -1 && eliteLineIndex !== lineIndex))
        )
        const minors = chosenSpec ? minorTraitsForSpecialization(chosenSpec.id) : []
        const majors = chosenSpec ? majorTraitsForSpecialization(chosenSpec.id) : []

        return (
          <div className="trait-line" key={lineIndex}>
            <div className="spec-picker-row">
              {availableSpecs.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={s.id === line?.specializationId ? 'spec-icon-button chosen' : 'spec-icon-button'}
                  style={{ backgroundImage: `url(${s.icon})` }}
                  title={s.name}
                  onClick={() => handleSpecClick(lineIndex, s.id)}
                />
              ))}
            </div>
            {chosenSpec && <div className="spec-line-name">{chosenSpec.name}</div>}

            {chosenSpec && (
              <div className="trait-progression">
                {TIERS.map((tier, tierIndex) => {
                  const minor = minors.find((t) => t.tier === tier)
                  const tierMajors = majors.filter((t) => t.tier === tier).sort((a, b) => a.order - b.order)
                  return (
                    <div className="trait-tier-group" key={tier}>
                      {minor && (
                        <div className="minor-trait" title={`${minor.name} — ${minor.description}`}>
                          <img src={minor.icon} alt={minor.name} />
                        </div>
                      )}
                      <div className="major-trait-tier">
                        {tierMajors.map((t) => (
                          <button
                            type="button"
                            key={t.id}
                            className={line?.chosenTraitIds[tierIndex] === t.id ? 'major-trait selected' : 'major-trait'}
                            title={`${t.name} — ${t.description}`}
                            onClick={() => handleTraitChoice(lineIndex, tierIndex as 0 | 1 | 2, t.id)}
                          >
                            <img src={t.icon} alt={t.name} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
