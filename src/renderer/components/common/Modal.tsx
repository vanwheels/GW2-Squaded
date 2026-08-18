import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Extra class on the dialog box itself (not the backdrop) — e.g. to widen it beyond the
   *  default max-width for content-heavy dialogs like the Gear Optimizer. */
  className?: string
}

/**
 * Viewport-centered modal dialog, portaled to `document.body` — closes on Escape or a backdrop
 * click (the backdrop's `onMouseDown` only fires `onClose` when the event target *is* the
 * backdrop itself, not a bubbled click from inside the dialog). Distinct from
 * `FloatingPanel` (anchor-relative popover that stays open alongside the rest of the page): a
 * `Modal` dims/blocks the whole page behind it, for content substantial enough to want its own
 * focused surface — currently just the Gear Optimizer (TODO.md's "Gear Optimizer entry point +
 * UI" item).
 */
export function Modal({ open, onClose, children, className }: Props) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={className ? `modal-dialog ${className}` : 'modal-dialog'}>{children}</div>
    </div>,
    document.body
  )
}
