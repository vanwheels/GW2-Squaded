import type { RefObject } from 'react'
import type { Build, GhostPick, Party } from '@shared/types'
import { PartyRow } from './PartyRow'
import type { BuildDragPayload } from './drag-payload'

interface Props {
  parties: Party[]
  buildsById: Map<string, Build>
  /** Full build list, for each `SlotTile`'s assign-dropdown — pass `[]` for a read-only preview,
   *  which has nothing to assign. */
  builds: Build[]
  /** `ScreenshotButton`'s capture target in the real editor; omitted for a read-only preview,
   *  which has nothing to screenshot itself. */
  gridRef?: RefObject<HTMLDivElement>
  /** `false` makes the whole grid inert (`pointer-events: none`) — same meaning as
   *  `BuildScreenshotGrid`'s own `interactive`, used by the Discord bot's `/squaddisplay` render
   *  page so a preview can never accidentally start editing. Every `on*` handler below is optional
   *  and no-ops by default for exactly that case. Defaults to `true` (the real
   *  `SquadCompEditorView` case). */
  interactive?: boolean
  /** Hides each line's Remove button and expand/collapse toggle, and forces its per-slot summary
   *  closed — see `PartyRow`'s own doc comment on the same prop. Independent of `interactive`:
   *  `SquadCompEditorView` flips this on temporarily mid-`ScreenshotButton` capture while staying
   *  fully interactive underneath; a read-only preview passes `interactive={false}` and this
   *  `true` together. Also hides the "+ Add line" footer button, same as the real editor already
   *  did inline before this was extracted. Defaults to `false`. */
  screenshotMode?: boolean
  onAssignBuild?: (partyIndex: number, slotIndex: number, buildId: string | null) => void
  onAssignGhost?: (partyIndex: number, slotIndex: number, ghostPick: GhostPick | null) => void
  onLabelChange?: (partyIndex: number, slotIndex: number, label: string | null) => void
  onDropBuild?: (partyIndex: number, slotIndex: number, payload: BuildDragPayload) => void
  onRemoveParty?: (partyIndex: number) => void
  /** Passed straight through to each `SlotTile` — see `BuildsSidebar`'s doc comment on the same
   *  prop name. */
  onEditBuild?: (buildId: string) => void
  /** "+ Add line" footer button handler — omitted (no button rendered) when not supplied, e.g. the
   *  preview page has nowhere for it to lead. */
  onAddParty?: () => void
  addPartyDisabled?: boolean
}

/**
 * The "screenshot" portion of the squad editor — one `PartyRow` per party plus the "+ Add line"
 * footer — factored out of `SquadCompEditorView` (2026-08-19) so the Discord bot's
 * `/squaddisplay` render page (`src/web-preview/SquadPreviewPage.tsx`) can render the exact same
 * layout read-only for an arbitrary shared squad comp, without a second copy of this markup
 * drifting out of sync with the real editor. Mirrors `BuildScreenshotGrid`'s own extraction for
 * `/builddisplay`; see that component's doc comment for the shared reasoning.
 */
export function SquadCompScreenshotGrid({
  parties,
  buildsById,
  builds,
  gridRef,
  interactive = true,
  screenshotMode = false,
  onAssignBuild = () => {},
  onAssignGhost = () => {},
  onLabelChange = () => {},
  onDropBuild = () => {},
  onRemoveParty = () => {},
  onEditBuild = () => {},
  onAddParty,
  addPartyDisabled = false
}: Props) {
  return (
    <div className="party-rows" ref={gridRef} style={interactive ? undefined : { pointerEvents: 'none' }}>
      {parties.map((party, partyIndex) => (
        <PartyRow
          key={partyIndex}
          party={party}
          partyIndex={partyIndex}
          builds={builds}
          buildsById={buildsById}
          onAssignBuild={(slotIndex, buildId) => onAssignBuild(partyIndex, slotIndex, buildId)}
          onAssignGhost={(slotIndex, ghostPick) => onAssignGhost(partyIndex, slotIndex, ghostPick)}
          onLabelChange={(slotIndex, label) => onLabelChange(partyIndex, slotIndex, label)}
          onDropBuild={(slotIndex, payload) => onDropBuild(partyIndex, slotIndex, payload)}
          onRemove={() => onRemoveParty(partyIndex)}
          canRemove={parties.length > 1}
          onEditBuild={onEditBuild}
          screenshotMode={screenshotMode}
        />
      ))}
      {onAddParty && !screenshotMode && (
        <button type="button" className="party-row-add" onClick={onAddParty} disabled={addPartyDisabled}>
          + Add line
        </button>
      )}
    </div>
  )
}
