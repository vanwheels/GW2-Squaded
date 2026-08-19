import { useMemo, useState } from 'react'

interface UseTagFilterOptions<T> {
  records: T[]
  getName: (record: T) => string
  getTags: (record: T) => string[]
}

/** A tag filter is either narrowing the list to records that have it (`include`) or hiding any
 *  record that has it (`exclude`) — a tag not in the map is neither. */
export type TagFilterState = 'include' | 'exclude'

interface TagFilter<T> {
  query: string
  setQuery: (query: string) => void
  tagStates: Map<string, TagFilterState>
  /** Cycles a tag's state: absent → `include` → `exclude` → absent. Same handler for every
   *  tag/profession/spec chip — see `TagChipDropdown`/`ProfessionTagPicker`. */
  toggleTag: (tag: string) => void
  /** Drops a tag straight to absent regardless of its current state — the one-click "remove
   *  filter" affordance `TagChipDropdown`'s `×` button uses, distinct from `toggleTag`'s cycle. */
  clearTag: (tag: string) => void
  /** Name-substring match (case-insensitive) AND at least one `include` tag present (OR across
   *  includes, not AND — a build can only be one profession, so requiring every included tag
   *  would make selecting 2 professions always show nothing) AND no `exclude` tag present (a
   *  record is dropped if it has any excluded tag, regardless of what else it matches). */
  filtered: T[]
}

/**
 * Shared search+tag-filter state for the Builds/Squads card grids and the squad editor's build
 * sidebar, so all three stay in sync on filtering behavior instead of re-implementing it.
 */
export function useTagFilter<T>({ records, getName, getTags }: UseTagFilterOptions<T>): TagFilter<T> {
  const [query, setQuery] = useState('')
  const [tagStates, setTagStates] = useState<Map<string, TagFilterState>>(new Map())

  function toggleTag(tag: string): void {
    setTagStates((prev) => {
      const next = new Map(prev)
      const current = next.get(tag)
      if (current === undefined) next.set(tag, 'include')
      else if (current === 'include') next.set(tag, 'exclude')
      else next.delete(tag)
      return next
    })
  }

  function clearTag(tag: string): void {
    setTagStates((prev) => {
      if (!prev.has(tag)) return prev
      const next = new Map(prev)
      next.delete(tag)
      return next
    })
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const includeTags = new Set<string>()
    const excludeTags = new Set<string>()
    for (const [tag, state] of tagStates) {
      if (state === 'include') includeTags.add(tag)
      else excludeTags.add(tag)
    }
    return records.filter((record) => {
      if (needle && !getName(record).toLowerCase().includes(needle)) return false
      const tags = getTags(record)
      if (excludeTags.size > 0 && tags.some((tag) => excludeTags.has(tag))) return false
      if (includeTags.size === 0) return true
      return tags.some((tag) => includeTags.has(tag))
    })
  }, [records, query, tagStates, getName, getTags])

  return { query, setQuery, tagStates, toggleTag, clearTag, filtered }
}
