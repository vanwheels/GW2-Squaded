import { useState, type RefObject } from 'react'

interface Props {
  /** Element to screenshot. Captured in one shot when it already fits inside the window's visible
   *  viewport at its current scroll position; otherwise `captureElement` scrolls it into view in
   *  slices and stitches them together — see that function's doc comment. */
  targetRef: RefObject<HTMLElement>
  /** Runs (and is awaited) right before measuring/capturing — e.g. to hide screenshot-irrelevant
   *  UI via a state flip on the caller's side (a sidebar, action buttons, an expanded dropdown).
   *  The button waits an extra animation frame afterward so the resulting re-render/layout settles
   *  before anything is measured. */
  onBeforeCapture?: () => void | Promise<void>
  /** Runs once the capture finishes (success or failure) to restore whatever `onBeforeCapture`
   *  changed. */
  onAfterCapture?: () => void
}

type Status = 'idle' | 'busy' | 'done' | 'error'

/** Safety cap on stitch slices — just loop-termination insurance (e.g. against a scroll position
 *  that never advances), not tied to any expected content size. */
const MAX_SLICES = 24

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode captured tile'))
    img.src = dataUrl
  })
}

/**
 * Captures `el` to the clipboard, handling content taller than the window's visible viewport.
 * `webContents.capturePage` only ever grabs the currently on-screen portion of the page (it can't
 * reach content scrolled out of view), so:
 *
 * - **Fast path**: if `el` already fits entirely within the viewport at its current scroll
 *   position, one `captureRegion` call does the whole thing, straight to the clipboard — this is
 *   the common case (a build editor, or a squad of a few lines) and matches the original behavior.
 * - **Stitched path**: otherwise, the window is scrolled in slices covering `el`'s full height
 *   (`getBoundingClientRect().height` reports the true full layout height regardless of what's
 *   currently scrolled into view), each slice captured via `captureRegionToDataUrl`, and all tiles
 *   drawn onto one offscreen `<canvas>` in order before the composited PNG is written to the
 *   clipboard via `writeImageDataUrl`. The window's scroll position is restored afterward
 *   regardless of outcome.
 */
async function captureElement(el: HTMLElement): Promise<void> {
  const rect = el.getBoundingClientRect()
  const viewportHeight = window.innerHeight

  if (rect.top >= 0 && rect.bottom <= viewportHeight) {
    await window.gw2Capture.captureRegion({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    })
    return
  }

  const originalScrollY = window.scrollY
  const documentTop = originalScrollY + rect.top
  const totalHeight = Math.round(rect.height)
  const width = Math.round(rect.width)

  try {
    const tiles: HTMLImageElement[] = []
    let captured = 0
    let iterations = 0

    while (captured < totalHeight && iterations < MAX_SLICES) {
      iterations++
      window.scrollTo(0, documentTop + captured)
      await waitForFrame()

      const liveRect = el.getBoundingClientRect()
      const y = Math.max(0, Math.round(liveRect.top))
      const remaining = totalHeight - captured
      const height = Math.min(remaining, Math.round(window.innerHeight) - y)
      if (height <= 0) break

      const dataUrl = await window.gw2Capture.captureRegionToDataUrl({
        x: Math.round(liveRect.x),
        y,
        width,
        height
      })
      tiles.push(await loadImage(dataUrl))
      captured += height
    }

    if (tiles.length === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = tiles[0].naturalWidth
    canvas.height = tiles.reduce((sum, t) => sum + t.naturalHeight, 0)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    let y = 0
    for (const tile of tiles) {
      ctx.drawImage(tile, 0, y)
      y += tile.naturalHeight
    }

    await window.gw2Capture.writeImageDataUrl(canvas.toDataURL('image/png'))
  } finally {
    window.scrollTo(0, originalScrollY)
  }
}

/** Copies a screenshot of `targetRef`'s full content straight to the OS clipboard (via
 *  `window.gw2Capture`, see capture-provider.ts) — the "screenshot" alternative to a public web
 *  viewer for shared builds/squads, e.g. pasting directly into Discord. See `captureElement` for
 *  how content taller than the viewport is handled. */
export function ScreenshotButton({ targetRef, onBeforeCapture, onAfterCapture }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleClick(): Promise<void> {
    const el = targetRef.current
    if (!el) return
    setStatus('busy')
    try {
      await onBeforeCapture?.()
      await waitForFrame()
      await captureElement(el)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    } finally {
      onAfterCapture?.()
    }
  }

  return (
    <button type="button" onClick={() => void handleClick()} disabled={status === 'busy'}>
      {status === 'busy' ? 'Copying…' : status === 'done' ? 'Copied to clipboard!' : status === 'error' ? 'Failed — try again' : 'Copy screenshot'}
    </button>
  )
}
