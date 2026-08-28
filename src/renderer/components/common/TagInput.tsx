import { useRef, useState } from 'react'
import { FloatingPanel } from '@renderer/components/common/FloatingPanel'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  /** All tags already in use elsewhere, for the input's autocomplete. */
  suggestions: string[]
  /** Non-removable computed tags (e.g. profession/elite spec) shown alongside `tags`. */
  autoTags?: string[]
}

const MAX_VISIBLE_SUGGESTIONS = 8

/** Chip row + free-text entry for a build/squad's `tags`, with autocomplete over tags already
 *  used elsewhere. `autoTags` render first, visually distinct and without a remove button.
 *
 *  The suggestion list is a `FloatingPanel` dropdown (2026-08-28, replacing a native `<datalist>` —
 *  Electron/Chromium can't style that popup at all, so it looked like a stray OS control next to
 *  the app's own themed chips). Suggestion buttons use `onMouseDown` + `preventDefault` to add a
 *  tag without ever stealing focus from the input, so the panel's own outside-mousedown close and
 *  the input's Enter/comma/blur handling all keep working unchanged. */
export function TagInput({ tags, onChange, suggestions, autoTags = [] }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string): void {
    const value = raw.trim()
    if (!value) return
    const exists = [...tags, ...autoTags].some((t) => t.toLowerCase() === value.toLowerCase())
    setText('')
    setOpen(false)
    if (!exists) onChange([...tags, value])
  }

  function removeTag(tag: string): void {
    onChange(tags.filter((t) => t !== tag))
  }

  const availableSuggestions = suggestions.filter(
    (s) => ![...tags, ...autoTags].some((t) => t.toLowerCase() === s.toLowerCase())
  )
  const filtered = (
    text ? availableSuggestions.filter((s) => s.toLowerCase().includes(text.toLowerCase())) : availableSuggestions
  ).slice(0, MAX_VISIBLE_SUGGESTIONS)

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
        ref={inputRef}
        className="tag-input-field"
        type="text"
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-autocomplete="list"
        value={text}
        placeholder="Add tag…"
        onChange={(e) => {
          setText(e.target.value)
          setHighlighted(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => addTag(text)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && filtered.length > 0) {
            e.preventDefault()
            setOpen(true)
            setHighlighted((i) => (i + 1) % filtered.length)
          } else if (e.key === 'ArrowUp' && filtered.length > 0) {
            e.preventDefault()
            setOpen(true)
            setHighlighted((i) => (i - 1 + filtered.length) % filtered.length)
          } else if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            if (open && filtered[highlighted]) addTag(filtered[highlighted])
            else addTag(text)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      <FloatingPanel open={open && filtered.length > 0} anchorRef={inputRef} onClose={() => setOpen(false)} className="skill-picker">
        <div className="tag-suggest-list" role="listbox">
          {filtered.map((s, i) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={i === highlighted}
              className={i === highlighted ? 'tag-suggest-option highlighted' : 'tag-suggest-option'}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => addTag(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </FloatingPanel>
    </div>
  )
}
