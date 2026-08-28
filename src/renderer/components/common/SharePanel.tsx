import { useState } from 'react'
import type { ShareKind } from '@shared/share/types'
import { createShare, isShareConfigured } from '@renderer/share/share-client'

interface Props {
  kind: ShareKind
  /** Computed lazily, only once the user actually clicks Share — building a squad comp's payload
   *  means bundling every referenced build's full data (see `SquadCompSharePayload`), not just
   *  reading `draft` directly. */
  getData: () => unknown
}

type Status = 'idle' | 'busy' | 'done' | 'error'

/**
 * "Share Link" button shared by `BuildEditorView` and `SquadCompEditorView` — creates an immutable
 * link via the `worker/` backend and copies it straight to the OS clipboard, mirroring
 * `ScreenshotButton`'s "just do the one thing" pattern: the button's own label reports progress,
 * no separate popover to manually re-copy from.
 *
 * 2026-08-28: replaced the old popover (URL input + Copy/Close buttons) after user feedback that
 * it ran off-screen when the button sat near the window edge, and was redundant now that the link
 * is already auto-copied on success — see git history for that implementation.
 * Renders nothing when no backend is configured (`VITE_SHARE_API_BASE_URL` unset), e.g. in a dev
 * build before deploy.
 */
export function SharePanel({ kind, getData }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  if (!isShareConfigured()) return null

  async function handleShare(): Promise<void> {
    setStatus('busy')
    try {
      const url = await createShare(kind, getData())
      await navigator.clipboard.writeText(url)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  return (
    <button type="button" onClick={() => void handleShare()} disabled={status === 'busy'}>
      {status === 'busy' ? 'Creating link…' : status === 'done' ? 'Link copied to clipboard!' : status === 'error' ? 'Failed — try again' : 'Share Link'}
    </button>
  )
}
