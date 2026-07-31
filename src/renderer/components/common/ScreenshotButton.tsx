import { useState, type RefObject } from 'react'

interface Props {
  /** Element to screenshot — only its currently-visible (on-screen, unscrolled) portion is
   *  captured, since `webContents.capturePage` grabs from the rendered window surface rather than
   *  the full scrollable DOM content. Fine for v1 (see TODO.md); not a full-page stitch. */
  targetRef: RefObject<HTMLElement>
}

type Status = 'idle' | 'busy' | 'done' | 'error'

/** Copies a screenshot of `targetRef`'s current on-screen bounds straight to the OS clipboard
 *  (via `window.gw2Capture`, see capture-provider.ts) — the "screenshot" alternative to a public
 *  web viewer for shared builds/squads, e.g. pasting directly into Discord. */
export function ScreenshotButton({ targetRef }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleClick(): Promise<void> {
    const el = targetRef.current
    if (!el) return
    setStatus('busy')
    try {
      const rect = el.getBoundingClientRect()
      await window.gw2Capture.captureRegion({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
      setStatus('done')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  return (
    <button type="button" onClick={() => void handleClick()} disabled={status === 'busy'}>
      {status === 'busy' ? 'Copying…' : status === 'done' ? 'Copied to clipboard!' : status === 'error' ? 'Failed — try again' : 'Copy screenshot'}
    </button>
  )
}
