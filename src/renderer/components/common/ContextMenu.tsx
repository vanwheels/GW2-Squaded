import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_MARGIN = 8

export interface ContextMenuItem {
  label: string
  onSelect: () => void
}

interface Props {
  /** Cursor position (`e.clientX`/`e.clientY` from the triggering `onContextMenu`) — clamped
   *  inside the viewport below, same reasoning as `FloatingPanel`'s anchor clamping. */
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/**
 * Small right-click menu, portaled to `document.body` and positioned at the cursor rather than
 * anchored to an element (the one thing `FloatingPanel` can't do — it always measures from an
 * `anchorRef`'s own bounding rect). Closes on outside `mousedown`, Escape, or picking an item.
 */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ x, y })

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const clampedX = Math.min(x, window.innerWidth - VIEWPORT_MARGIN - rect.width)
    const clampedY = Math.min(y, window.innerHeight - VIEWPORT_MARGIN - rect.height)
    setCoords({ x: Math.max(VIEWPORT_MARGIN, clampedX), y: Math.max(VIEWPORT_MARGIN, clampedY) })
  }, [x, y])

  useEffect(() => {
    function handlePointerDown(e: MouseEvent): void {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ position: 'fixed', left: coords.x, top: coords.y }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="context-menu-item"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
