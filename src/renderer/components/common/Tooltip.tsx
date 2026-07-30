import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** Tooltip body. `null`/`undefined` suppresses the tooltip entirely (no hover popup). */
  content: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Instant-hover tooltip, replacing native `title=` (whose popup delay is OS/browser-controlled
 * and can't be shortened via CSS/JS). Portals into `document.body` so it isn't clipped by
 * scrollable/overflow-hidden ancestor panels, and positions itself from the trigger's
 * bounding rect on each hover rather than tracking the cursor.
 */
export function Tooltip({ content, children, className }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  function show(): void {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setCoords({ x: rect.left + rect.width / 2, y: rect.top - 6 })
    setOpen(true)
  }

  function hide(): void {
    setOpen(false)
  }

  return (
    <span
      ref={triggerRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        content != null &&
        createPortal(
          <div className="tooltip-popup" style={{ left: coords.x, top: coords.y }} role="tooltip">
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

/** Common "bold name + muted description" shape shared by trait/skill/boon tooltips. */
export function TooltipBody({ title, description }: TooltipBodyProps) {
  return (
    <>
      <div className="tooltip-title">{title}</div>
      {description && <div className="tooltip-description">{description}</div>}
    </>
  )
}
