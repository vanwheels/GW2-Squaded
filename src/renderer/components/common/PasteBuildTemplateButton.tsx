import { useState } from 'react'
import type { Build, GameData } from '@shared/types'
import { decodeBuildTemplate } from '@shared/chat-link/build-template-codec'

interface Props {
  gameData: GameData
  /** Applies the decoded patch to the current draft — the caller owns any profession-change
   *  resets (clearing equipment/familiar/etc.), same as `BuildEditorView`'s own profession picker
   *  already does, since a chat link carries no equipment data to preserve/invalidate decisions
   *  for. `warnings` is non-fatal (e.g. a stale skill-palette id) — surfaced here so the user can
   *  see what, if anything, didn't come through. */
  onImport: (patch: Partial<Build>, warnings: string[]) => void
}

/**
 * "Paste Build Template" button + popover — the import counterpart to
 * `CopyBuildTemplateButton`/`ImportFromLinkButton`'s popover shape, but fully local/offline
 * (decoding is synchronous, no `worker/` backend involved).
 */
export function PasteBuildTemplateButton({ gameData, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  function handleImport(): void {
    setError(null)
    try {
      const { patch, warnings: decodeWarnings } = decodeBuildTemplate(value, gameData)
      onImport(patch, decodeWarnings)
      setValue('')
      setWarnings(decodeWarnings)
      if (decodeWarnings.length === 0) setOpen(false)
    } catch (err) {
      setWarnings([])
      setError(err instanceof Error ? err.message : 'Failed to import.')
    }
  }

  return (
    <div className="share-panel">
      <button type="button" onClick={() => setOpen(!open)}>
        Paste Build Template
      </button>
      {open && (
        <div className="share-popover">
          <input
            type="text"
            className="share-url-input"
            placeholder="Paste a [&D…] build-template code…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          {error && <p className="share-error">{error}</p>}
          {warnings.length > 0 && (
            <ul className="share-error">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div className="share-popover-actions">
            <button type="button" onClick={handleImport} disabled={!value.trim()}>
              Import
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
