import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ProfessionId, Specialization, Trait, TraitLineSelection, TraitLineSlots } from '@shared/types'
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

/** GW2's own trait-line connector color (light cyan-blue) — deliberately distinct from --accent
 *  (used for "selected" borders) so the two don't visually compete. */
const CONNECTOR_COLOR = '#5ab7ff'

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Measures the minor-trait / selected-major-trait DOM nodes and derives one continuous zigzag path
 * through them — minor(tier1) -> major(tier1, if chosen) -> minor(tier2) -> major(tier2, if
 * chosen) -> minor(tier3) -> major(tier3, if chosen) — the same single-path shape the real trait UI
 * draws (starting at the first minor, not the specialization icon). Uses real DOM positions rather
 * than fixed pixel math so it keeps working if icon sizes/gaps ever change, and recomputes on a
 * ResizeObserver so it stays correct across window/column resizes, not just selection changes.
 */
function useTraitConnector(
  wrapperRef: RefObject<HTMLDivElement>,
  minorRefs: RefObject<(HTMLDivElement | null)[]>,
  majorRefs: RefObject<Map<number, HTMLButtonElement>>,
  chosenTraitIds: readonly (number | null)[],
  active: boolean
): Segment[] {
  const [segments, setSegments] = useState<Segment[]>([])
  const chosenKey = chosenTraitIds.join(',')

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !active) {
      setSegments([])
      return
    }

    function recompute(): void {
      const wrapperEl = wrapperRef.current
      if (!wrapperEl) return
      const rect = wrapperEl.getBoundingClientRect()
      const centerOf = (el: HTMLElement): { x: number; y: number } => {
        const r = el.getBoundingClientRect()
        return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top }
      }

      const chain: { x: number; y: number }[] = []
      ;(minorRefs.current ?? []).forEach((minorEl, tierIndex) => {
        if (!minorEl) return
        chain.push(centerOf(minorEl))
        const traitId = chosenTraitIds[tierIndex]
        const majorEl = traitId !== null && traitId !== undefined ? majorRefs.current?.get(traitId) : undefined
        if (majorEl) chain.push(centerOf(majorEl))
      })

      const next: Segment[] = []
      for (let i = 0; i < chain.length - 1; i++) {
        const a = chain[i]
        const b = chain[i + 1]
        next.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
      }

      setSegments(next)
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(wrapper)
    return () => observer.disconnect()
    // chosenKey stands in for chosenTraitIds (array identity changes every render otherwise)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, chosenKey])

  return segments
}

interface TraitLineRowProps {
  line: TraitLineSelection | null
  chosenSpec: Specialization | undefined
  specOptions: UpgradeOption[]
  onChooseSpec: (specializationId: number | null) => void
  onTraitChoice: (tierIndex: 0 | 1 | 2, traitId: number) => void
  minorTraitsForSpecialization: (specializationId: number) => Trait[]
  majorTraitsForSpecialization: (specializationId: number) => Trait[]
}

function TraitLineRow({
  line,
  chosenSpec,
  specOptions,
  onChooseSpec,
  onTraitChoice,
  minorTraitsForSpecialization,
  majorTraitsForSpecialization
}: TraitLineRowProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const minorRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const majorRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const chosenTraitIds = line?.chosenTraitIds ?? [null, null, null]
  const segments = useTraitConnector(wrapperRef, minorRefs, majorRefs, chosenTraitIds, Boolean(chosenSpec && line))

  return (
    <div className="trait-line" ref={wrapperRef}>
      {segments.length > 0 && (
        <svg className="trait-connector-svg">
          {segments.map((s, i) => (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={CONNECTOR_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
      <div className="trait-line-spec-select">
        <UpgradePicker
          label="Specialization"
          options={specOptions}
          chosenId={line?.specializationId ?? null}
          onChoose={onChooseSpec}
          variant="slot"
        />
        {chosenSpec && <span className="spec-line-name">{chosenSpec.name}</span>}
      </div>

      {chosenSpec && line && (
        <div className="trait-line-tiers-horizontal">
          {TIERS.map((tier, tierIndex) => {
            const minor = minorTraitsForSpecialization(chosenSpec.id).find((t) => t.tier === tier)
            const tierMajors = majorTraitsForSpecialization(chosenSpec.id)
              .filter((t) => t.tier === tier)
              .sort((a, b) => a.order - b.order)
            return (
              <div className="trait-tier-group" key={tier}>
                {minor && (
                  <Tooltip content={<TooltipBody title={minor.name} description={minor.description} />}>
                    <div
                      className="minor-trait"
                      ref={(el) => {
                        minorRefs.current[tierIndex] = el
                      }}
                    >
                      <img src={minor.icon} alt={minor.name} />
                    </div>
                  </Tooltip>
                )}
                <div className="major-trait-tier">
                  {tierMajors.map((t) => (
                    <Tooltip key={t.id} content={<TooltipBody title={t.name} description={t.description} />}>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) majorRefs.current.set(t.id, el)
                          else majorRefs.current.delete(t.id)
                        }}
                        className={chosenTraitIds[tierIndex] === t.id ? 'major-trait selected' : 'major-trait'}
                        onClick={() => onTraitChoice(tierIndex as 0 | 1 | 2, t.id)}
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
      )}
    </div>
  )
}

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
          <TraitLineRow
            key={lineIndex}
            line={line}
            chosenSpec={chosenSpec}
            specOptions={specOptions}
            onChooseSpec={(specializationId) => chooseSpec(lineIndex, specializationId)}
            onTraitChoice={(tierIndex, traitId) => handleTraitChoice(lineIndex, tierIndex, traitId)}
            minorTraitsForSpecialization={minorTraitsForSpecialization}
            majorTraitsForSpecialization={majorTraitsForSpecialization}
          />
        )
      })}
    </div>
  )
}
