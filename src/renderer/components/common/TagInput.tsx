import { useId, useState } from 'react'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  /** All tags already in use elsewhere, for the input's autocomplete. */
  suggestions: string[]
  /** Non-removable computed tags (e.g. profession/elite spec) shown alongside `tags`. */
  autoTags?: string[]
}

/** Chip row + free-text entry for a build/squad's `tags`, with autocomplete over tags already
 *  used elsewhere. `autoTags` render first, visually distinct and without a remove button. */
export function TagInput({ tags, onChange, suggestions, autoTags = [] }: Props) {
  const [text, setText] = useState('')
  const listId = useId()

  function addTag(raw: string): void {
    const value = raw.trim()
    if (!value) return
    const exists = [...tags, ...autoTags].some((t) => t.toLowerCase() === value.toLowerCase())
    setText('')
    if (!exists) onChange([...tags, value])
  }

  function removeTag(tag: string): void {
    onChange(tags.filter((t) => t !== tag))
  }

  const availableSuggestions = suggestions.filter(
    (s) => ![...tags, ...autoTags].some((t) => t.toLowerCase() === s.toLowerCase())
  )

  return (
    <div className="tag-input">
      {autoTags.map((tag) => (
        <span key={`auto-${tag}`} className="tag-chip tag-chip-auto">
          {tag}
        </span>
      ))}
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          <button type="button" className="tag-chip-remove" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`}>
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input-field"
        type="text"
        list={listId}
        value={text}
        placeholder="Add tag…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => addTag(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag(text)
          }
        }}
      />
      <datalist id={listId}>
        {availableSuggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
