import { useMemo, useState } from 'react'

interface UseTagFilterOptions<T> {
  records: T[]
  getName: (record: T) => string
  getTags: (record: T) => string[]
}

interface TagFilter<T> {
  query: string
  setQuery: (query: string) => void
  /** Every distinct tag across `records`, alphabetized — feeds the filter-chip row. */
  allTags: string[]
  selectedTags: Set<string>
  toggleTag: (tag: string) => void
  /** Name-substring match (case-insensitive) AND every selected tag present (not OR) — see the
   *  2026-08-01 TODO scoping note on the tags feature for why AND was picked. */
  filtered: T[]
}

/**
 * Shared search+tag-filter state for the Builds/Squads card grids and the squad editor's build
 * sidebar, so all three stay in sync on filtering behavior instead of re-implementing it.
 */
export function useTagFilter<T>({ records, getName, getTags }: UseTagFilterOptions<T>): TagFilter<T> {
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const record of records) for (const tag of getTags(record)) tags.add(tag)
    return [...tags].sort((a, b) => a.localeCompare(b))
  }, [records, getTags])

  function toggleTag(tag: string): void {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return records.filter((record) => {
      if (needle && !getName(record).toLowerCase().includes(needle)) return false
      if (selectedTags.size === 0) return true
      const recordTags = new Set(getTags(record))
      for (const tag of selectedTags) if (!recordTags.has(tag)) return false
      return true
    })
  }, [records, query, selectedTags, getName, getTags])

  return { query, setQuery, allTags, selectedTags, toggleTag, filtered }
}
