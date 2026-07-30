import { useState } from 'react'
import type { ProfessionId, Trait, TraitLineSelection, TraitLineSlots } from '@shared/types'
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

/**
 * Each of the 3 trait lines is its own independent column that collapses/expands on its own
 * (confirmed 2026-07-30 — gw2skills-style condensed row + expand, not an accordion where opening
 * one closes the others). Collapsed is the default, decluttering the always-expanded 3-column tier
 * grid the user called out as "messy"; picking a spec for a line auto-expands just that line so
 * there's no extra click needed to reach the major-trait picker on a fresh pick.
 */
export function TraitsEditor({ profession, value, onChange }: Props) {
  const { specializationsForProfession, specializationsById, majorTraitsForSpecialization, minorTraitsForSpecialization } =
    useGameData()
  const [expandedLines, setExpandedLines] = useState<[boolean, boolean, boolean]>([false, false, false])

  const specs = specializationsForProfession(profession)
  const lines = value
  const eliteLineIndex = lines.findIndex((line) => line && specializationsById.get(line.specializationId)?.elite)

  function setLine(lineIndex: number, next: TraitLineSelection | null): void {
    const nextLines = [...lines] as TraitLineSlots
    nextLines[lineIndex] = next
    onChange(nextLines)
  }

  function setExpanded(lineIndex: number, expanded: boolean): void {
    const next = [...expandedLines] as [boolean, boolean, boolean]
    next[lineIndex] = expanded
    setExpandedLines(next)
  }

  function handleSpecClick(lineIndex: number, specializationId: number): void {
    const line = lines[lineIndex]
    const deselecting = line?.specializationId === specializationId
    setLine(lineIndex, deselecting ? null : { specializationId, chosenTraitIds: [null, null, null] })
    if (!deselecting) setExpanded(lineIndex, true)
  }

  function handleTraitChoice(lineIndex: number, tierIndex: 0 | 1 | 2, traitId: number): void {
    const line = lines[lineIndex]
    if (!line) return
    const chosenTraitIds: TraitLineSelection['chosenTraitIds'] = [...line.chosenTraitIds]
    chosenTraitIds[tierIndex] = chosenTraitIds[tierIndex] === traitId ? null : traitId
    setLine(lineIndex, { ...line, chosenTraitIds })
  }

  const usedSpecIds = new Set(lines.filter((l): l is TraitLineSelection => l !== null).map((l) => l.specializationId))

  function condensedSummary(lineIndex: number, specId: number, line: TraitLineSelection) {
    const minors = minorTraitsForSpecialization(specId).sort((a, b) => a.tier - b.tier)
    const majors = majorTraitsForSpecialization(specId)
    const chosenMajors: (Trait | undefined)[] = TIERS.map((tier, tierIndex) =>
      majors.find((t) => t.tier === tier && t.id === line.chosenTraitIds[tierIndex])
    )
    return (
      <div className="trait-line-summary" key={`summary-${lineIndex}`}>
        <div className="trait-summary-row">
          {minors.map((m) => (
            <Tooltip key={m.id} content={<TooltipBody title={m.name} description={m.description} />}>
              <div className="minor-trait summary-icon">
                <img src={m.icon} alt={m.name} />
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="trait-summary-row">
          {chosenMajors.map((t, tierIndex) =>
            t ? (
              <Tooltip key={t.id} content={<TooltipBody title={t.name} description={t.description} />}>
                <div className="major-trait selected summary-icon">
                  <img src={t.icon} alt={t.name} />
                </div>
              </Tooltip>
            ) : (
              <div className="major-trait summary-icon empty" key={`empty-${tierIndex}`} />
            )
          )}
        </div>
      </div>
    )
  }

  function expandedTiers(lineIndex: number, specId: number, line: TraitLineSelection) {
    return (
      <div className="trait-line-tiers" key={`tiers-${lineIndex}`}>
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
        const isExpanded = expandedLines[lineIndex]

        return (
          <div className="trait-line" key={lineIndex}>
            <div className="spec-picker-row">
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

            {chosenSpec && line && (
              <>
                <div className="trait-line-header">
                  <span className="spec-line-name">{chosenSpec.name}</span>
                  <button
                    type="button"
                    className="trait-line-expand-toggle"
                    onClick={() => setExpanded(lineIndex, !isExpanded)}
                    aria-label={isExpanded ? 'Collapse trait line' : 'Expand trait line'}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                </div>
                {isExpanded ? expandedTiers(lineIndex, chosenSpec.id, line) : condensedSummary(lineIndex, chosenSpec.id, line)}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
