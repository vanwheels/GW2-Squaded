import type { ProfessionId } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

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
 */
export function ProfessionTagPicker({ selectedTags, onToggleTag }: Props) {
  const { professions, specializations: allSpecializations } = useGameData()

  const eliteSpecsByProfession = new Map<ProfessionId, typeof allSpecializations>()
  for (const s of allSpecializations) {
    if (!s.elite) continue
    const list = eliteSpecsByProfession.get(s.profession) ?? []
    list.push(s)
    eliteSpecsByProfession.set(s.profession, list)
  }
  for (const list of eliteSpecsByProfession.values()) list.sort((a, b) => a.id - b.id)

  return (
    <div className="field">
      <span>Profession</span>
      <div className="profession-picker-row">
        {professions.map((p) => (
          <Tooltip key={p.id} content={<TooltipBody title={p.name} />}>
            <button
              type="button"
              className={selectedTags.has(p.name) ? 'spec-icon-button chosen' : 'spec-icon-button'}
              style={{ backgroundImage: `url(${p.icon})` }}
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
                style={{ backgroundImage: `url(${s.icon})` }}
                onClick={() => onToggleTag(s.name)}
              />
            </Tooltip>
          ))
        )}
      </div>
    </div>
  )
}
