import { useMemo, useState } from 'react'
import type { Build, PartySlots, SquadComp, SquadSlot } from '@shared/types'
import { isLikelySquadCompSharePayload } from '@shared/share/validate'
import { useSquadCompsStore, makeBlankSquadComp } from '@renderer/state/squad-comps-store'
import { useBuildsStore } from '@renderer/state/builds-store'
import { useTagFilter } from '@renderer/state/use-tag-filter'
import { reorderBefore } from '@renderer/lib/reorder'
import { sortFavoritesFirst, middleClickToggle } from '@renderer/lib/favorites'
import { formatRelativeTime } from '@renderer/lib/format-relative-time'
import { professionAccentColor } from '@renderer/lib/profession-colors'
import { SquadCompEditorView } from '@renderer/components/squad-editor/SquadCompEditorView'
import { ImportFromLinkButton } from '@renderer/components/common/ImportFromLinkButton'
import { TagFilterBar } from '@renderer/components/common/TagFilterBar'

/** A slot's profession for mosaic purposes — an assigned build wins, then a `GhostPick`'s
 *  profession, else `null` (empty slot, rendered as a hollow dot). */
function slotProfession(slot: SquadSlot, buildsById: Map<string, Build>): Build['profession'] | null {
  if (slot.buildId) return buildsById.get(slot.buildId)?.profession ?? null
  return slot.ghostPick?.profession ?? null
}

interface Props {
  /** Jumps to the Builds tab with a given build open for editing — see `BuildsSidebar`'s doc
   *  comment on the same prop name for why this has to come from `App.tsx`. */
  onEditBuild: (buildId: string) => void
}

export function SquadsView({ onEditBuild }: Props) {
  const { squadComps, loading, createSquadComp, updateSquadComp, removeSquadComp } = useSquadCompsStore()
  const { builds, createBuild } = useBuildsStore()
  const buildsById = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds])
  const [editing, setEditing] = useState<{ squadComp: SquadComp; isNew: boolean } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const { query, setQuery, tagStates, toggleTag, clearTag, filtered } = useTagFilter({
    records: squadComps,
    getName: (squadComp) => squadComp.name,
    getTags: (squadComp) => squadComp.tags
  })
  const customTags = useMemo(() => [...new Set(squadComps.flatMap((s) => s.tags))].sort(), [squadComps])

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
      // `updatedAtGw2Build` refers to the sharer's own local game-data snapshot, not this
      // importer's — nulled out (== "unknown") rather than carried over, same reasoning as
      // `BuildsView.handleImport`.
      await createBuild({ ...build, id: newId, createdAt: now, updatedAt: now, updatedAtGw2Build: null })
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

  function handleDrop(beforeId: string | null): void {
    const draggedId = dragId
    setDragId(null)
    setDropTargetId(null)
    if (!draggedId || draggedId === beforeId) return
    const squadComp = squadComps.find((s) => s.id === draggedId)
    if (!squadComp) return
    const order = reorderBefore(filtered, draggedId, beforeId)
    if (order !== squadComp.order) void updateSquadComp({ ...squadComp, order })
  }

  /** Not a content edit (same reasoning as `order`) — doesn't bump `updatedAt`. */
  function toggleFavorite(squadComp: SquadComp): void {
    void updateSquadComp({ ...squadComp, favorite: !squadComp.favorite })
  }

  if (editing) {
    return (
      <SquadCompEditorView
        squadComp={editing.squadComp}
        onBack={async (squadComp) => {
          await (editing.isNew ? createSquadComp(squadComp) : updateSquadComp(squadComp))
          setEditing(null)
        }}
        onEditBuild={onEditBuild}
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
        <>
          <TagFilterBar
            query={query}
            onQueryChange={setQuery}
            customTags={customTags}
            tagStates={tagStates}
            onToggleTag={toggleTag}
            onClearTag={clearTag}
            placeholder="Search squads…"
          />
          {filtered.length === 0 ? (
            <p className="empty-state">No squads match your search/filter.</p>
          ) : (
            <ul className="record-list" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(null)}>
              {sortFavoritesFirst(filtered, (squadComp) => squadComp.favorite).map((squadComp) => {
                const className = [
                  dragId === squadComp.id ? 'record-card-dragging' : null,
                  dropTargetId === squadComp.id ? 'record-card-drop-target' : null
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li
                    key={squadComp.id}
                    className={className || undefined}
                    draggable
                    title={squadComp.favorite ? 'Middle-click to unfavorite' : 'Middle-click to favorite'}
                    {...middleClickToggle(() => toggleFavorite(squadComp))}
                    onDragStart={() => setDragId(squadComp.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setDropTargetId(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDropTargetId(squadComp.id)
                    }}
                    onDragLeave={() => setDropTargetId((id) => (id === squadComp.id ? null : id))}
                    onDrop={(e) => {
                      e.stopPropagation()
                      handleDrop(squadComp.id)
                    }}
                  >
                    <button
                      type="button"
                      className="record-delete"
                      onClick={() => void removeSquadComp(squadComp.id)}
                      aria-label={`Delete ${squadComp.name}`}
                      title="Delete squad"
                    >
                      ×
                    </button>
                    <span className={squadComp.favorite ? 'favorite-star is-favorite' : 'favorite-star favorite-star-hint'}>
                      {squadComp.favorite ? '★' : '☆'}
                    </span>
                    <button className="record-open" onClick={() => setEditing({ squadComp, isNew: false })}>
                      <span className="record-open-text">
                        <strong>{squadComp.name}</strong>
                        <span className="party-mosaic">
                          {squadComp.parties.map((party, partyIndex) => (
                            <span className="party-mosaic-row" key={partyIndex}>
                              <span className="party-mosaic-label">P{partyIndex + 1}</span>
                              {party.slots.map((slot, slotIndex) => {
                                const profession = slotProfession(slot, buildsById)
                                const color = profession ? professionAccentColor(profession) : undefined
                                return (
                                  <span
                                    key={slotIndex}
                                    className={color ? 'party-mosaic-dot' : 'party-mosaic-dot party-mosaic-dot-empty'}
                                    style={color ? { backgroundColor: color } : undefined}
                                  />
                                )
                              })}
                            </span>
                          ))}
                        </span>
                        <span className="muted">
                          {squadComp.parties.length} part{squadComp.parties.length === 1 ? 'y' : 'ies'}
                        </span>
                        <span className="muted record-updated" title={new Date(squadComp.updatedAt).toLocaleString()}>
                          Updated {formatRelativeTime(squadComp.updatedAt)}
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
