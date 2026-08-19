import type { TagFilterState } from '@renderer/state/use-tag-filter'

interface Props {
  /** Tags to offer, e.g. every `tags` value in use across the current records. */
  allTags: string[]
  tagStates: Map<string, TagFilterState>
  onToggleTag: (tag: string) => void
  onClearTag: (tag: string) => void
}

/** Filter-by-custom-tag control: a dropdown of every tag currently in use (excluding ones already
 *  active), plus the active ones shown as removable chips below it. The dropdown always adds a
 *  tag as `include`; an active chip's label re-cycles it to `exclude` (click-cycle, same handler
 *  as `ProfessionTagPicker`'s icon buttons) while its `×` clears it outright in one click. */
export function TagChipDropdown({ allTags, tagStates, onToggleTag, onClearTag }: Props) {
  const activeTags = allTags.filter((tag) => tagStates.has(tag))
  const availableTags = allTags.filter((tag) => !tagStates.has(tag))

  return (
    <div className="tag-filter-dropdown">
      {availableTags.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onToggleTag(e.target.value)
          }}
        >
          <option value="">+ Filter by tag…</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      )}
      {activeTags.length > 0 && (
        <div className="tag-filter-chips">
          {activeTags.map((tag) => {
            const excluded = tagStates.get(tag) === 'exclude'
            return (
              <span key={tag} className={excluded ? 'tag-chip tag-chip-excluded' : 'tag-chip'}>
                <button
                  type="button"
                  className="tag-chip-label"
                  onClick={() => onToggleTag(tag)}
                  title={excluded ? 'Excluding — click to clear' : 'Including — click to exclude instead'}
                >
                  {excluded && 'NOT '}
                  {tag}
                </button>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => onClearTag(tag)}
                  aria-label={`Remove tag filter ${tag}`}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
