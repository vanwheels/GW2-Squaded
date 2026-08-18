import { useCallback, useMemo } from 'react'
import type { Build } from '@shared/types'
import { getBuildAutoTags } from '@shared/tags/auto-tags'
import { useBuildsStore } from '@renderer/state/builds-store'
import { useGameData } from '@renderer/state/game-data-store'
import { useTagFilter } from '@renderer/state/use-tag-filter'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { TagFilterBar } from '@renderer/components/common/TagFilterBar'
import { setBuildDragData } from './drag-payload'

/**
 * Drag source for assigning builds to squad slots — every saved build, draggable onto any
 * `SlotTile`. Clicking a slot's own picker (see `SlotTile`) is the other, non-drag way to assign
 * the same build, per the confirmed "both" interaction requirement.
 */
export function BuildsSidebar() {
  const { builds, loading } = useBuildsStore()
  const { professions, specializationsById } = useGameData()

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

  /** Same elite-spec-over-profession icon convention as `SlotTile`'s `eliteSpecIconFor` and
   *  `BuildsView`'s copy of it. */
  function eliteSpecIconFor(build: Build): string | undefined {
    const eliteSpecId = build.specializations[2]?.specializationId
    const eliteSpec = eliteSpecId != null ? specializationsById.get(eliteSpecId) : undefined
    return eliteSpec?.elite ? eliteSpec.tangoIcon : undefined
  }

  return (
    <aside className="builds-sidebar">
      <h3>Saved builds</h3>
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : builds.length === 0 ? (
        <p className="empty-state">No saved builds yet — create one in the Builds tab.</p>
      ) : (
        <>
          <TagFilterBar
            query={query}
            onQueryChange={setQuery}
            customTags={customTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            showProfessionPicker
            placeholder="Search…"
          />
          {filtered.length === 0 ? (
            <p className="empty-state">No builds match your search/filter.</p>
          ) : (
            <ul className="builds-sidebar-list">
              {filtered.map((build) => {
                const profession = professions.find((p) => p.id === build.profession)
                return (
                  <li key={build.id}>
                    <Tooltip content={<TooltipBody title={build.name} description={profession?.name ?? build.profession} />}>
                      <div
                        className="builds-sidebar-card"
                        draggable
                        onDragStart={(e) =>
                          setBuildDragData(e, { buildId: build.id, sourcePartyIndex: null, sourceSlotIndex: null })
                        }
                      >
                        {profession && (
                          <img className="builds-sidebar-icon" src={eliteSpecIconFor(build) ?? profession.tangoIcon} alt="" />
                        )}
                        <span className="builds-sidebar-name">{build.name}</span>
                      </div>
                    </Tooltip>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </aside>
  )
}
