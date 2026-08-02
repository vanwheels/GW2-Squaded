interface Props {
  /** Tags to offer, e.g. every `tags` value in use across the current records. */
  allTags: string[]
  selectedTags: Set<string>
  onToggleTag: (tag: string) => void
}

/** Filter-by-custom-tag control: a dropdown of every tag currently in use (excluding ones already
 *  active), plus the active ones shown as removable chips below it. */
export function TagChipDropdown({ allTags, selectedTags, onToggleTag }: Props) {
  const activeTags = allTags.filter((tag) => selectedTags.has(tag))
  const availableTags = allTags.filter((tag) => !selectedTags.has(tag))

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
          {activeTags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
              <button type="button" className="tag-chip-remove" onClick={() => onToggleTag(tag)} aria-label={`Remove tag filter ${tag}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
