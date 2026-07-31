import { useState } from 'react'
import type { ShareKind } from '@shared/share/types'
import { fetchShare, isShareConfigured } from '@renderer/share/share-client'

interface Props {
  kind: ShareKind
  kindLabel: string
  /** Throws on invalid/mismatched data — the message is shown inline. */
  onImport: (data: unknown) => Promise<void>
}

/** "Import from link" button + popover shared by `BuildsView` and `SquadsView` — resolves a
 *  pasted share link/id via the `worker/` backend and hands the raw payload to `onImport` for
 *  kind-specific validation + local persistence. Renders nothing when no backend is configured. */
export function ImportFromLinkButton({ kind, kindLabel, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isShareConfigured()) return null

  async function handleImport(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const share = await fetchShare(value)
      if (share.kind !== kind) {
        throw new Error(`That link is a ${share.kind === 'build' ? 'build' : 'squad'} link, not a ${kindLabel} link.`)
      }
      await onImport(share.data)
      setOpen(false)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="share-panel">
      <button type="button" onClick={() => setOpen(!open)}>
        Import from link
      </button>
      {open && (
        <div className="share-popover">
          <input
            type="text"
            className="share-url-input"
            placeholder="Paste a share link or id…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          {error && <p className="share-error">{error}</p>}
          <div className="share-popover-actions">
            <button type="button" onClick={() => void handleImport()} disabled={busy || !value.trim()}>
              {busy ? 'Importing…' : 'Import'}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
