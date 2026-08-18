import { useCallback, useMemo, useState } from 'react'
import type { Build } from '@shared/types'
import { isLikelyBuild } from '@shared/share/validate'
import { isBuildStaleSincePatch } from '@shared/types/build'
import { getBuildAutoTags } from '@shared/tags/auto-tags'
import { useBuildsStore, makeBlankBuild } from '@renderer/state/builds-store'
import { useGameData } from '@renderer/state/game-data-store'
import { useDataUpdate } from '@renderer/state/data-update-store'
import { useTagFilter } from '@renderer/state/use-tag-filter'
import { reorderBefore } from '@renderer/lib/reorder'
import { sortFavoritesFirst, middleClickToggle } from '@renderer/lib/favorites'
import { professionAccentColor } from '@renderer/lib/profession-colors'
import { formatRelativeTime } from '@renderer/lib/format-relative-time'
import { BuildEditorView } from '@renderer/components/build-editor/BuildEditorView'
import { ImportFromLinkButton } from '@renderer/components/common/ImportFromLinkButton'
import { TagFilterBar } from '@renderer/components/common/TagFilterBar'

export function BuildsView() {
  const { builds, loading, createBuild, updateBuild, removeBuild } = useBuildsStore()
  const { professions, specializationsById } = useGameData()
  const { localGw2Build } = useDataUpdate()
  const [editing, setEditing] = useState<{ build: Build; isNew: boolean } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const getTags = useCallback(
    (build: Build) => [...getBuildAutoTags(build, { professions, specializationsById }), ...build.tags],
    [professions, specializationsById]
  )
  const { query, setQuery, selectedTags, toggleTag, filtered } = useTagFilter({
    records: builds,
    getName: (build) => build.name,
    getTags
  })
  const customTags = useMemo(() => [...new Set(builds.flatMap((b) => b.tags))].sort(), [builds])

  /** Show the equipped elite spec's own icon (matches the in-game/gw2skills convention of
   *  identifying a character by its elite spec, not its base profession) when one's chosen —
   *  same pattern as `SlotTile`'s `eliteSpecIconFor`. */
  function eliteSpecIconFor(build: Build): string | undefined {
    const eliteSpecId = build.specializations[2]?.specializationId
    const eliteSpec = eliteSpecId != null ? specializationsById.get(eliteSpecId) : undefined
    return eliteSpec?.elite ? eliteSpec.tangoIcon : undefined
  }

  async function handleImport(data: unknown): Promise<void> {
    if (!isLikelyBuild(data)) throw new Error('This link does not contain a valid build.')
    const now = new Date().toISOString()
    // `updatedAtGw2Build` refers to the sharer's own local game-data snapshot, not this
    // importer's — nulled out (== "unknown") rather than carried over, see `Build.updatedAtGw2Build`.
    await createBuild({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, updatedAtGw2Build: null })
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

  /** Not a content edit (same reasoning as `order`) — doesn't bump `updatedAt`. */
  function toggleFavorite(build: Build): void {
    void updateBuild({ ...build, favorite: !build.favorite })
  }

  if (editing) {
    return (
      <BuildEditorView
        build={editing.build}
        onBack={async (build) => {
          await (editing.isNew ? createBuild(build) : updateBuild(build))
          setEditing(null)
        }}
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
            customTags={customTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            showProfessionPicker
            placeholder="Search builds…"
          />
          {filtered.length === 0 ? (
            <p className="empty-state">No builds match your search/filter.</p>
          ) : (
            <ul className="record-list" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(null)}>
              {sortFavoritesFirst(filtered, (build) => build.favorite).map((build) => {
                const profession = professions.find((p) => p.id === build.profession)
                const className = [
                  dragId === build.id ? 'record-card-dragging' : null,
                  dropTargetId === build.id ? 'record-card-drop-target' : null
                ]
                  .filter(Boolean)
                  .join(' ')
                const accentColor = professionAccentColor(build.profession)
                return (
                  <li
                    key={build.id}
                    className={className || undefined}
                    style={accentColor ? ({ '--profession-accent': accentColor } as React.CSSProperties) : undefined}
                    draggable
                    title={build.favorite ? 'Middle-click to unfavorite' : 'Middle-click to favorite'}
                    {...middleClickToggle(() => toggleFavorite(build))}
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
                    <button
                      type="button"
                      className="record-delete"
                      onClick={() => void removeBuild(build.id)}
                      aria-label={`Delete ${build.name}`}
                      title="Delete build"
                    >
                      ×
                    </button>
                    <span className={build.favorite ? 'favorite-star is-favorite' : 'favorite-star favorite-star-hint'}>
                      {build.favorite ? '★' : '☆'}
                    </span>
                    <button className="record-open" onClick={() => setEditing({ build, isNew: false })}>
                      {profession && (
                        <img
                          className="record-open-icon"
                          src={eliteSpecIconFor(build) ?? profession.tangoIcon}
                          alt=""
                          draggable={false}
                        />
                      )}
                      <span className="record-open-text">
                        <strong>{build.name}</strong>
                        <span className="muted">{profession?.name ?? build.profession}</span>
                        <span
                          className={
                            isBuildStaleSincePatch(build, localGw2Build)
                              ? 'record-updated record-updated-stale'
                              : 'muted record-updated'
                          }
                          title={new Date(build.updatedAt).toLocaleString()}
                        >
                          {isBuildStaleSincePatch(build, localGw2Build)
                            ? 'Not reviewed since latest patch'
                            : `Updated ${formatRelativeTime(build.updatedAt)}`}
                        </span>
                      </span>
                    </button>
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
