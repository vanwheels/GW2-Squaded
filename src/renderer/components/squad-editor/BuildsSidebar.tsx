import { useBuildsStore } from '@renderer/state/builds-store'
import { useGameData } from '@renderer/state/game-data-store'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { setBuildDragData } from './drag-payload'

/**
 * Drag source for assigning builds to squad slots — every saved build, draggable onto any
 * `SlotTile`. Clicking a slot's own picker (see `SlotTile`) is the other, non-drag way to assign
 * the same build, per the confirmed "both" interaction requirement.
 */
export function BuildsSidebar() {
  const { builds, loading } = useBuildsStore()
  const { professions } = useGameData()

  return (
    <aside className="builds-sidebar">
      <h3>Saved builds</h3>
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : builds.length === 0 ? (
        <p className="empty-state">No saved builds yet — create one in the Builds tab.</p>
      ) : (
        <ul className="builds-sidebar-list">
          {builds.map((build) => {
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
                    {profession && <img className="builds-sidebar-icon" src={profession.icon} alt="" />}
                    <span className="builds-sidebar-name">{build.name}</span>
                  </div>
                </Tooltip>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
