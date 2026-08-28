import { useState } from 'react'

interface Props {
  /** Runs the actual capture — `BuildEditorView`/`SquadCompEditorView` pass a thunk that calls
   *  `window.gw2Capture.captureBuildScreenshot`/`captureSquadScreenshot` with their current draft.
   *  See that provider's doc comment for the full offscreen-render pipeline this kicks off. */
  capture: () => Promise<void>
}

type Status = 'idle' | 'busy' | 'done' | 'error'

/**
 * Copies a screenshot of the current build/squad straight to the OS clipboard (via `capture`, see
 * that prop's doc comment) — the "screenshot" alternative to a public web viewer for shared
 * builds/squads, e.g. pasting directly into Discord.
 *
 * 2026-08-28: this used to do its own on-screen `webContents.capturePage` of a `targetRef`
 * element, single-shot or scroll-stitched depending on whether it fit the real window's visible
 * viewport (see git history for that implementation) — replaced once the below-1920 reflow work
 * made the result depend on the real window's current width, and a stitch-compositor bug started
 * surfacing as duplicated content. `capture` now hands the whole job to a dedicated offscreen
 * render (`src/main/capture/offscreen-capture.ts`) that's always the same standardized width and
 * always captures the full content in one shot — this component only tracks button status.
 */
export function ScreenshotButton({ capture }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleClick(): Promise<void> {
    setStatus('busy')
    try {
      await capture()
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
