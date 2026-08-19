import type { TagFilterState } from '@renderer/state/use-tag-filter'
import { ProfessionTagPicker } from './ProfessionTagPicker'
import { TagChipDropdown } from './TagChipDropdown'

interface Props {
  query: string
  onQueryChange: (query: string) => void
  /** User-created tags in use across the current records (not profession/elite-spec auto tags —
   *  those get their own icon picker, see `showProfessionPicker`). */
  customTags: string[]
  tagStates: Map<string, TagFilterState>
  onToggleTag: (tag: string) => void
  onClearTag: (tag: string) => void
  /** Show the profession/elite-spec icon picker above the custom-tag dropdown — only meaningful
   *  for build-listing views (`BuildsView`/`BuildsSidebar`); squads have no single profession. */
  showProfessionPicker?: boolean
  placeholder?: string
}

/** Search box + tag filters, shared by BuildsView/SquadsView/BuildsSidebar. Search box, tag-filter
 *  dropdown, and (when shown) the profession/elite-spec filter sit in that order in one row —
 *  the tag dropdown is next to the search box since it's the more frequently reached-for filter,
 *  profession is the "further out" one, per 2026-08-18 layout request. */
export function TagFilterBar({
  query,
  onQueryChange,
  customTags,
  tagStates,
  onToggleTag,
  onClearTag,
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
      <TagChipDropdown allTags={customTags} tagStates={tagStates} onToggleTag={onToggleTag} onClearTag={onClearTag} />
      {showProfessionPicker && <ProfessionTagPicker tagStates={tagStates} onToggleTag={onToggleTag} />}
    </div>
  )
}
