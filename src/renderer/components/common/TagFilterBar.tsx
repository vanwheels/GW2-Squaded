import { ProfessionTagPicker } from './ProfessionTagPicker'
import { TagChipDropdown } from './TagChipDropdown'

interface Props {
  query: string
  onQueryChange: (query: string) => void
  /** User-created tags in use across the current records (not profession/elite-spec auto tags —
   *  those get their own icon picker, see `showProfessionPicker`). */
  customTags: string[]
  selectedTags: Set<string>
  onToggleTag: (tag: string) => void
  /** Show the profession/elite-spec icon picker above the custom-tag dropdown — only meaningful
   *  for build-listing views (`BuildsView`/`BuildsSidebar`); squads have no single profession. */
  showProfessionPicker?: boolean
  placeholder?: string
}

/** Search box + tag filters, shared by BuildsView/SquadsView/BuildsSidebar. */
export function TagFilterBar({
  query,
  onQueryChange,
  customTags,
  selectedTags,
  onToggleTag,
  showProfessionPicker,
  placeholder
}: Props) {
  return (
    <div className="tag-filter-bar">
      <input
        className="tag-filter-search"
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
      />
      {showProfessionPicker && <ProfessionTagPicker selectedTags={selectedTags} onToggleTag={onToggleTag} />}
      <TagChipDropdown allTags={customTags} selectedTags={selectedTags} onToggleTag={onToggleTag} />
    </div>
  )
}
