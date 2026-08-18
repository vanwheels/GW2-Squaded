import { useRef } from 'react'
import type { ProfessionId } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { FloatingPanel } from '@renderer/components/common/FloatingPanel'
import { usePickerOpen } from '@renderer/state/picker-registry'

interface Props {
  selectedTags: Set<string>
  onToggleTag: (tag: string) => void
}

/**
 * Filter-by-profession/elite-spec picker for BuildsView/BuildsSidebar — visually identical to
 * `ProfessionSpecPicker` (same profession row + elite-spec grid, same `.spec-icon-button`/`.chosen`
 * styling) per user request, but toggle-multi-select instead of single-select: a build's editor
 * picker chooses exactly one profession/spec, while this filters by any number of them at once
 * (OR'd together, see `useTagFilter`). Operates directly on the profession/elite-spec name strings
 * `shared/tags/auto-tags.ts` already produces, so no separate tag vocabulary is needed.
 *
 * Collapsed behind a click-to-open popover (2026-08-18, same `FloatingPanel`/`usePickerOpen`
 * mechanism as the gear-upgrade pickers) rather than always-expanded inline — the full row+grid ate
 * a fixed chunk of vertical space above every builds/squads list regardless of whether the filter
 * was in use. The trigger sits in `TagFilterBar`'s row next to the search box and tag dropdown; a
 * dot badge (matches `.nav-item-badge`) marks it when a profession/elite-spec filter is active so
 * collapsing it doesn't hide that a filter is silently narrowing the list.
 */
export function ProfessionTagPicker({ selectedTags, onToggleTag }: Props) {
  const { professions, specializations: allSpecializations } = useGameData()
  const { open, openThis, close } = usePickerOpen()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const eliteSpecsByProfession = new Map<ProfessionId, typeof allSpecializations>()
  for (const s of allSpecializations) {
    if (!s.elite) continue
    const list = eliteSpecsByProfession.get(s.profession) ?? []
    list.push(s)
    eliteSpecsByProfession.set(s.profession, list)
  }
  for (const list of eliteSpecsByProfession.values()) list.sort((a, b) => a.id - b.id)

  const professionNames = new Set(professions.map((p) => p.name))
  const specNames = new Set(allSpecializations.map((s) => s.name))
  const active = [...selectedTags].some((tag) => professionNames.has(tag) || specNames.has(tag))

  return (
    <div className="profession-tag-picker">
      <button
        ref={buttonRef}
        type="button"
        className={active ? 'profession-filter-toggle active' : 'profession-filter-toggle'}
        onClick={() => (open ? close() : openThis())}
      >
        Profession
        {active && <span className="nav-item-badge" />}
      </button>
      <FloatingPanel open={open} anchorRef={buttonRef} onClose={close} className="skill-picker">
        <div className="skill-picker-header">Profession</div>
        <div className="profession-picker-row">
          {professions.map((p) => (
            <Tooltip key={p.id} content={<TooltipBody title={p.name} />}>
              <button
                type="button"
                className={selectedTags.has(p.name) ? 'spec-icon-button chosen' : 'spec-icon-button'}
                style={{ backgroundImage: `url(${p.tangoIcon})` }}
                onClick={() => onToggleTag(p.name)}
              />
            </Tooltip>
          ))}
        </div>
        <div className="elite-spec-picker-grid" style={{ gridTemplateColumns: `repeat(${professions.length}, 36px)` }}>
          {professions.flatMap((p, colIndex) =>
            (eliteSpecsByProfession.get(p.id) ?? []).map((s, rowIndex) => (
              <Tooltip
                key={s.id}
                content={<TooltipBody title={s.name} />}
                style={{ gridColumn: colIndex + 1, gridRow: rowIndex + 1 }}
              >
                <button
                  type="button"
                  className={selectedTags.has(s.name) ? 'spec-icon-button chosen' : 'spec-icon-button'}
                  style={{ backgroundImage: `url(${s.tangoIcon})` }}
                  onClick={() => onToggleTag(s.name)}
                />
              </Tooltip>
            ))
          )}
        </div>
      </FloatingPanel>
    </div>
  )
}
