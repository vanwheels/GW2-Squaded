import { useCallback, useState } from 'react'
import type { Build } from '@shared/types'
import { isLikelyBuild } from '@shared/share/validate'
import { getBuildAutoTags } from '@shared/tags/auto-tags'
import { useBuildsStore, makeBlankBuild } from '@renderer/state/builds-store'
import { useGameData } from '@renderer/state/game-data-store'
import { useTagFilter } from '@renderer/state/use-tag-filter'
import { reorderBefore } from '@renderer/lib/reorder'
import { formatRelativeTime } from '@renderer/lib/format-relative-time'
import { BuildEditorView } from '@renderer/components/build-editor/BuildEditorView'
import { ImportFromLinkButton } from '@renderer/components/common/ImportFromLinkButton'
import { TagFilterBar } from '@renderer/components/common/TagFilterBar'

export function BuildsView() {
  const { builds, loading, createBuild, updateBuild, removeBuild } = useBuildsStore()
  const { professions, specializationsById } = useGameData()
  const [editing, setEditing] = useState<{ build: Build; isNew: boolean } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const getTags = useCallback(
    (build: Build) => [...getBuildAutoTags(build, { professions, specializationsById }), ...build.tags],
    [professions, specializationsById]
  )
  const { query, setQuery, allTags, selectedTags, toggleTag, filtered } = useTagFilter({
    records: builds,
    getName: (build) => build.name,
    getTags
  })

  async function handleImport(data: unknown): Promise<void> {
    if (!isLikelyBuild(data)) throw new Error('This link does not contain a valid build.')
    const now = new Date().toISOString()
    await createBuild({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
  }

  function handleDrop(beforeId: string | null): void {
    const draggedId = dragId
    setDragId(null)
    setDropTargetId(null)
    if (!draggedId || draggedId === beforeId) return
    const build = builds.find((b) => b.id === draggedId)
    if (!build) return
    const order = reorderBefore(filtered, draggedId, beforeId)
    if (order !== build.order) void updateBuild({ ...build, order })
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
        <>
          <TagFilterBar
            query={query}
            onQueryChange={setQuery}
            allTags={allTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            placeholder="Search builds…"
          />
          {filtered.length === 0 ? (
            <p className="empty-state">No builds match your search/filter.</p>
          ) : (
            <ul className="record-list" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(null)}>
              {filtered.map((build) => {
                const profession = professions.find((p) => p.id === build.profession)
                const className = [
                  dragId === build.id ? 'record-card-dragging' : null,
                  dropTargetId === build.id ? 'record-card-drop-target' : null
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li
                    key={build.id}
                    className={className || undefined}
                    draggable
                    onDragStart={() => setDragId(build.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setDropTargetId(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDropTargetId(build.id)
                    }}
                    onDragLeave={() => setDropTargetId((id) => (id === build.id ? null : id))}
                    onDrop={(e) => {
                      e.stopPropagation()
                      handleDrop(build.id)
                    }}
                  >
                    <button className="record-open" onClick={() => setEditing({ build, isNew: false })}>
                      {profession && <img className="record-open-icon" src={profession.icon} alt="" draggable={false} />}
                      <span className="record-open-text">
                        <strong>{build.name}</strong>
                        <span className="muted">{profession?.name ?? build.profession}</span>
                        <span className="muted record-updated" title={new Date(build.updatedAt).toLocaleString()}>
                          Updated {formatRelativeTime(build.updatedAt)}
                        </span>
                      </span>
                    </button>
                    <button onClick={() => void removeBuild(build.id)}>Delete</button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
