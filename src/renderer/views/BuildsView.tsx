import { useState } from 'react'
import type { Build } from '@shared/types'
import { isLikelyBuild } from '@shared/share/validate'
import { useBuildsStore, makeBlankBuild } from '@renderer/state/builds-store'
import { useGameData } from '@renderer/state/game-data-store'
import { BuildEditorView } from '@renderer/components/build-editor/BuildEditorView'
import { ImportFromLinkButton } from '@renderer/components/common/ImportFromLinkButton'

export function BuildsView() {
  const { builds, loading, createBuild, updateBuild, removeBuild } = useBuildsStore()
  const { professions } = useGameData()
  const [editing, setEditing] = useState<{ build: Build; isNew: boolean } | null>(null)

  async function handleImport(data: unknown): Promise<void> {
    if (!isLikelyBuild(data)) throw new Error('This link does not contain a valid build.')
    const now = new Date().toISOString()
    await createBuild({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
  }

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
        <div className="view-header-actions">
          <ImportFromLinkButton kind="build" kindLabel="build" onImport={handleImport} />
          <button onClick={() => setEditing({ build: makeBlankBuild(), isNew: true })}>+ New build</button>
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : builds.length === 0 ? (
        <p className="empty-state">No saved builds yet. Click "+ New build" to create one.</p>
      ) : (
        <ul className="record-list">
          {builds.map((build) => {
            const profession = professions.find((p) => p.id === build.profession)
            return (
              <li key={build.id}>
                <button className="record-open" onClick={() => setEditing({ build, isNew: false })}>
                  {profession && <img className="record-open-icon" src={profession.icon} alt="" />}
                  <span className="record-open-text">
                    <strong>{build.name}</strong>
                    <span className="muted">{profession?.name ?? build.profession}</span>
                  </span>
                </button>
                <button onClick={() => void removeBuild(build.id)}>Delete</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
