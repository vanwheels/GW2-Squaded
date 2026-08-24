import type { ReactNode } from 'react'

const HEADING_RE = /^(#{1,3})\s+(.*)/
const BULLET_RE = /^-\s+/
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

/**
 * Minimal Markdown renderer for CHANGELOG.md's fixed subset: `#`/`##`/`###` headings, flat `- `
 * bullet lists (a continuation line wraps without its own `- `, indented or not), plain
 * paragraphs, and inline `**bold**`/`` `code` ``. Hand-rolled rather than a dependency — the
 * input is first-party, version-controlled content (CHANGELOG.md), not arbitrary/untrusted
 * Markdown, and the syntax it actually uses is small and has stayed stable across every release
 * section so far. Markdown links (`[text](url)`) render as their label only: CHANGELOG.md's one
 * use of the syntax points at a repo-relative doc file, not a URL that means anything inside the
 * packaged app.
 */
export function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      const Tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3'
      blocks.push(<Tag key={key++}>{renderInline(heading[2])}</Tag>)
      i++
      continue
    }

    if (BULLET_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim() !== '' && !HEADING_RE.test(lines[i])) {
        if (BULLET_RE.test(lines[i])) {
          items.push(lines[i].replace(BULLET_RE, ''))
        } else {
          items[items.length - 1] += ` ${lines[i].trim()}`
        }
        i++
      }
      blocks.push(
        <ul key={key++}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    const paragraphLines = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !HEADING_RE.test(lines[i]) && !BULLET_RE.test(lines[i])) {
      paragraphLines.push(lines[i].trim())
      i++
    }
    blocks.push(<p key={key++}>{renderInline(paragraphLines.join(' '))}</p>)
  }

  return blocks
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(INLINE_RE)
    .filter((part) => part.length > 0)
    .map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx}>{part.slice(2, -2)}</strong>
      if (part.startsWith('`') && part.endsWith('`')) return <code key={idx}>{part.slice(1, -1)}</code>
      const link = /^\[([^\]]+)\]\([^)]+\)$/.exec(part)
      if (link) return <span key={idx}>{link[1]}</span>
      return <span key={idx}>{part}</span>
    })
}
