import { useState } from 'react'
import type { PartySlots, SquadComp } from '@shared/types'
import { isLikelySquadCompSharePayload } from '@shared/share/validate'
import { useSquadCompsStore, makeBlankSquadComp } from '@renderer/state/squad-comps-store'
import { useBuildsStore } from '@renderer/state/builds-store'
import { SquadCompEditorView } from '@renderer/components/squad-editor/SquadCompEditorView'
import { ImportFromLinkButton } from '@renderer/components/common/ImportFromLinkButton'

export function SquadsView() {
  const { squadComps, loading, createSquadComp, updateSquadComp, removeSquadComp } = useSquadCompsStore()
  const { createBuild } = useBuildsStore()
  const [editing, setEditing] = useState<{ squadComp: SquadComp; isNew: boolean } | null>(null)

  /** Re-creates every bundled build locally under a fresh id first (a shared squad's builds are a
   *  standalone snapshot, not references into the importer's own database — see
   *  `SquadCompSharePayload`), then remaps each slot's `buildId` onto those new local ids before
   *  saving the squad comp itself. */
  async function handleImport(data: unknown): Promise<void> {
    if (!isLikelySquadCompSharePayload(data)) throw new Error('This link does not contain a valid squad.')
    const idMap = new Map<string, string>()
    for (const [oldId, build] of Object.entries(data.builds)) {
      const newId = crypto.randomUUID()
      idMap.set(oldId, newId)
      const now = new Date().toISOString()
      await createBuild({ ...build, id: newId, createdAt: now, updatedAt: now })
    }
    const now = new Date().toISOString()
    await createSquadComp({
      ...data.squadComp,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      parties: data.squadComp.parties.map((party) => ({
        slots: party.slots.map((slot) => ({
          ...slot,
          buildId: slot.buildId ? (idMap.get(slot.buildId) ?? null) : null
        })) as PartySlots
      }))
    })
  }

  if (editing) {
    return (
      <SquadCompEditorView
        squadComp={editing.squadComp}
        isNew={editing.isNew}
        onSave={async (squadComp) => {
          await (editing.isNew ? createSquadComp(squadComp) : updateSquadComp(squadComp))
          setEditing(null)
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <section>
      <div className="view-header">
        <h2>Squads</h2>
        <div className="view-header-actions">
          <ImportFromLinkButton kind="squadComp" kindLabel="squad" onImport={handleImport} />
          <button onClick={() => setEditing({ squadComp: makeBlankSquadComp(), isNew: true })}>+ New squad</button>
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : squadComps.length === 0 ? (
        <p className="empty-state">No saved squads yet. Click "+ New squad" to create one.</p>
      ) : (
        <ul className="record-list">
          {squadComps.map((squadComp) => (
            <li key={squadComp.id}>
              <button className="record-open" onClick={() => setEditing({ squadComp, isNew: false })}>
                <span className="record-open-text">
                  <strong>{squadComp.name}</strong>
                  <span className="muted">
                    {squadComp.parties.length} part{squadComp.parties.length === 1 ? 'y' : 'ies'}
                  </span>
                </span>
              </button>
              <button onClick={() => void removeSquadComp(squadComp.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
