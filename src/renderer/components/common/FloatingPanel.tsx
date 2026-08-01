import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 4

interface Props {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  className?: string
}

/**
 * Portals picker-popover content to `document.body`, fixed-positioned from the anchor's bounding
 * rect and clamped inside the viewport (flipping above the anchor if there's no room below) —
 * same technique `Tooltip` uses for hover popups, applied to click-to-open pickers instead.
 *
 * Escapes both the trigger's local stacking context (so a popover always paints above the rest of
 * the build editor rather than being confined beneath a later sibling with an equal/higher z-index
 * — see TraitsEditor's per-line `z-index: 1` rows) and the trigger's own layout box (so it never
 * pushes the page taller/wider or gets clipped at the 1920x1080 window edge, and never needs page
 * scrolling to reach — see SkillsEditor's/EquipmentEditor's in-flow pickers).
 *
 * Also closes on an outside `mousedown` (ignoring clicks on the anchor itself, which already
 * toggles via the caller's own `onClick`) so a picker doesn't linger once the user's attention has
 * moved elsewhere in the panel.
 */
export function FloatingPanel({ open, anchorRef, onClose, children, className }: Props) {
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    let x = anchorRect.left
    if (x + panelRect.width > window.innerWidth - VIEWPORT_MARGIN) x = window.innerWidth - VIEWPORT_MARGIN - panelRect.width
    if (x < VIEWPORT_MARGIN) x = VIEWPORT_MARGIN

    let y = anchorRect.bottom + ANCHOR_GAP
    if (y + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      const above = anchorRect.top - panelRect.height - ANCHOR_GAP
      y = above >= VIEWPORT_MARGIN ? above : VIEWPORT_MARGIN
    }

    setCoords({ x, y })
    // Re-measure only on open/close transitions, not on every coords change (that would loop) —
    // matches Tooltip's identical single-measure-per-show approach.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent): void {
      const target = e.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, anchorRef, onClose])

  if (!open) return null
  return createPortal(
    <div ref={panelRef} className={className} style={{ position: 'fixed', left: coords.x, top: coords.y, zIndex: 900 }}>
      {children}
    </div>,
    document.body
  )
}
