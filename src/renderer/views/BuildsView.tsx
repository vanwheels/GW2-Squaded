import { useState } from 'react'
import type { Build } from '@shared/types'
import { useBuildsStore, makeBlankBuild } from '@renderer/state/builds-store'
import { BuildEditorView } from '@renderer/components/build-editor/BuildEditorView'

export function BuildsView() {
  const { builds, loading, createBuild, updateBuild, removeBuild } = useBuildsStore()
  const [editing, setEditing] = useState<{ build: Build; isNew: boolean } | null>(null)

  if (editing) {
    return (
      <BuildEditorView
        build={editing.build}
        isNew={editing.isNew}
        onSave={async (build) => {
          await (editing.isNew ? createBuild(build) : updateBuild(build))
          setEditing(null)
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <section>
      <div className="view-header">
        <h2>Builds</h2>
        <button onClick={() => setEditing({ build: makeBlankBuild(), isNew: true })}>+ New build</button>
      </div>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : builds.length === 0 ? (
        <p className="empty-state">No saved builds yet. Click "+ New build" to create one.</p>
      ) : (
        <ul className="record-list">
          {builds.map((build) => (
            <li key={build.id}>
              <button className="record-open" onClick={() => setEditing({ build, isNew: false })}>
                <strong>{build.name}</strong>
                <span className="muted"> — {build.profession}</span>
              </button>
              <button onClick={() => void removeBuild(build.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
