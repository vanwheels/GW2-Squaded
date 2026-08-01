import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { stripGw2Markup } from '@shared/gear-calc/format-description'

interface Props {
  /** Tooltip body. `null`/`undefined` suppresses the tooltip entirely (no hover popup). */
  content: ReactNode
  children: ReactNode
  className?: string
  /** For callers that need to position the trigger itself (e.g. an explicit CSS Grid
   *  `gridColumn`/`gridRow` placement) — the wrapping `<span>` is the actual grid/flex item, not
   *  `children`, so a style on `children` alone wouldn't reach it. */
  style?: CSSProperties
}

/**
 * Instant-hover tooltip, replacing native `title=` (whose popup delay is OS/browser-controlled
 * and can't be shortened via CSS/JS). Portals into `document.body` so it isn't clipped by
 * scrollable/overflow-hidden ancestor panels, and positions itself from the trigger's
 * bounding rect on each hover rather than tracking the cursor.
 */
const VIEWPORT_MARGIN = 8

export function Tooltip({ content, children, className, style }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  function show(): void {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setCoords({ x: rect.left + rect.width / 2, y: rect.top - 6 })
    setOpen(true)
  }

  function hide(): void {
    setOpen(false)
  }

  // The popup is centered/anchored via a CSS transform on a fixed-position box, so its rendered
  // size isn't known until after layout. Measure once mounted and nudge `coords` back on-screen
  // if the box overflows the viewport (common near window edges) — a pure shift of the anchor
  // point, since the transform offset from that anchor stays constant either way.
  useLayoutEffect(() => {
    if (!open) return
    const rect = popupRef.current?.getBoundingClientRect()
    if (!rect) return
    let dx = 0
    let dy = 0
    if (rect.left < VIEWPORT_MARGIN) dx = VIEWPORT_MARGIN - rect.left
    else if (rect.right > window.innerWidth - VIEWPORT_MARGIN) dx = window.innerWidth - VIEWPORT_MARGIN - rect.right
    if (rect.top < VIEWPORT_MARGIN) dy = VIEWPORT_MARGIN - rect.top
    if (dx !== 0 || dy !== 0) setCoords((c) => ({ x: c.x + dx, y: c.y + dy }))
  }, [open, content])

  return (
    <span
      ref={triggerRef}
      className={className}
      style={style}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        content != null &&
        createPortal(
          <div ref={popupRef} className="tooltip-popup" style={{ left: coords.x, top: coords.y }} role="tooltip">
            {content}
          </div>,
          document.body
        )}
    </span>
  )
}

interface TooltipBodyProps {
  title: string
  description?: string
}

/**
 * Common "bold name + muted description" shape shared by trait/skill/boon tooltips.
 * `description` is stripped of raw GW2 API markup (`<c=@abilitytype>`/`<c=@reminder>` color
 * tags, `<br>`) here so every caller gets clean text for free rather than each needing its own
 * `stripGw2Markup` call.
 */
export function TooltipBody({ title, description }: TooltipBodyProps) {
  const clean = description ? stripGw2Markup(description) : undefined
  return (
    <>
      <div className="tooltip-title">{title}</div>
      {clean && <div className="tooltip-description">{clean}</div>}
    </>
  )
}
