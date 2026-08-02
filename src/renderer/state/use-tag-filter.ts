import { useMemo, useState } from 'react'

interface UseTagFilterOptions<T> {
  records: T[]
  getName: (record: T) => string
  getTags: (record: T) => string[]
}

interface TagFilter<T> {
  query: string
  setQuery: (query: string) => void
  selectedTags: Set<string>
  toggleTag: (tag: string) => void
  /** Name-substring match (case-insensitive) AND at least one selected tag present (OR across
   *  tags, not AND — a build can only be one profession, so requiring every selected tag would
   *  make selecting 2 professions always show nothing). */
  filtered: T[]
}

/**
 * Shared search+tag-filter state for the Builds/Squads card grids and the squad editor's build
 * sidebar, so all three stay in sync on filtering behavior instead of re-implementing it.
 */
export function useTagFilter<T>({ records, getName, getTags }: UseTagFilterOptions<T>): TagFilter<T> {
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

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
      return getTags(record).some((tag) => selectedTags.has(tag))
    })
  }, [records, query, selectedTags, getName, getTags])

  return { query, setQuery, selectedTags, toggleTag, filtered }
}
