import { useState } from 'react'
import type { SquadComp } from '@shared/types'
import { useSquadCompsStore, makeBlankSquadComp } from '@renderer/state/squad-comps-store'
import { SquadCompEditorView } from '@renderer/components/squad-editor/SquadCompEditorView'

export function SquadsView() {
  const { squadComps, loading, createSquadComp, updateSquadComp, removeSquadComp } = useSquadCompsStore()
  const [editing, setEditing] = useState<{ squadComp: SquadComp; isNew: boolean } | null>(null)

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
        <button onClick={() => setEditing({ squadComp: makeBlankSquadComp(), isNew: true })}>+ New squad</button>
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
                <strong>{squadComp.name}</strong>
                <span className="muted"> — {squadComp.parties.length} part{squadComp.parties.length === 1 ? 'y' : 'ies'}</span>
              </button>
              <button onClick={() => void removeSquadComp(squadComp.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
