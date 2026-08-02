interface Props {
  query: string
  onQueryChange: (query: string) => void
  allTags: string[]
  selectedTags: Set<string>
  onToggleTag: (tag: string) => void
  placeholder?: string
}

/** Search box + multi-select tag chip row, shared by BuildsView/SquadsView/BuildsSidebar. */
export function TagFilterBar({ query, onQueryChange, allTags, selectedTags, onToggleTag, placeholder }: Props) {
  return (
    <div className="tag-filter-bar">
      <input
        className="tag-filter-search"
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
      />
      {allTags.length > 0 && (
        <div className="tag-filter-chips">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={selectedTags.has(tag) ? 'tag-filter-chip tag-filter-chip-active' : 'tag-filter-chip'}
              onClick={() => onToggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
