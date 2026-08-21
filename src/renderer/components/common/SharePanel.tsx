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

type State = { phase: 'idle' } | { phase: 'loading' } | { phase: 'done'; url: string } | { phase: 'error'; message: string }

/** "Share Link" button + popover shared by `BuildEditorView` and `SquadCompEditorView` — creates
 *  an immutable link via the `worker/` backend and copies it to the clipboard immediately, no
 *  separate "Copy" press required (2026-08-21 user feedback). The popover still shows the URL
 *  (readable/re-selectable, and a fallback if the clipboard write itself fails) plus a manual
 *  Copy button for re-copying later. Renders nothing when no backend is configured
 *  (`VITE_SHARE_API_BASE_URL` unset), e.g. in a dev build before deploy. */
export function SharePanel({ kind, getData }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [copied, setCopied] = useState(false)

  if (!isShareConfigured()) return null

  async function handleCopy(url: string): Promise<void> {
    await navigator.clipboard.writeText(url)
    setCopied(true)
  }

  async function handleShare(): Promise<void> {
    setOpen(true)
    setCopied(false)
    setState({ phase: 'loading' })
    try {
      const url = await createShare(kind, getData())
      setState({ phase: 'done', url })
      // Auto-copy as soon as the link exists — the whole point of the rename from "Share" to
      // "Share Link" is that one press both creates and copies it.
      await handleCopy(url)
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Failed to create share link.' })
    }
  }

  return (
    <div className="share-panel">
      <button type="button" onClick={() => void handleShare()}>
        Share Link
      </button>
      {open && (
        <div className="share-popover">
          {state.phase === 'loading' && <p className="muted">Creating link…</p>}
          {state.phase === 'error' && <p className="share-error">{state.message}</p>}
          {state.phase === 'done' && (
            <>
              <p className="muted">{copied ? 'Link copied to clipboard!' : 'Link created.'}</p>
              <input
                type="text"
                readOnly
                value={state.url}
                onFocus={(e) => e.currentTarget.select()}
                className="share-url-input"
              />
              <div className="share-popover-actions">
                <button type="button" onClick={() => void handleCopy(state.url)}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
