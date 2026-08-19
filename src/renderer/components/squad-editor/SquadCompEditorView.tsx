import { useMemo, useRef, useState } from 'react'
import type { Build, GhostPick, PartySlots, SquadComp, SquadSlot } from '@shared/types'
import type { SquadCompSharePayload } from '@shared/share/types'
import { useBuildsStore } from '@renderer/state/builds-store'
import { makeBlankParty, useSquadCompsStore } from '@renderer/state/squad-comps-store'
import { SharePanel } from '@renderer/components/common/SharePanel'
import { ScreenshotButton } from '@renderer/components/common/ScreenshotButton'
import { TagInput } from '@renderer/components/common/TagInput'
import { BuildsSidebar } from './BuildsSidebar'
import { PartyRow } from './PartyRow'
import type { BuildDragPayload } from './drag-payload'

interface Props {
  squadComp: SquadComp
  onBack: (squadComp: SquadComp) => Promise<void>
  /** Passed straight through to `BuildsSidebar` — see its doc comment on the same prop name. */
  onEditBuild: (buildId: string) => void
}

/** WvW's real squad cap is 50 players (10 parties of 5) — see TODO.md. */
const MAX_PARTIES = 10

export function SquadCompEditorView({ squadComp, onBack, onEditBuild }: Props) {
  const [draft, setDraft] = useState<SquadComp>(squadComp)
  const [saving, setSaving] = useState(false)
  const { builds } = useBuildsStore()
  const { squadComps } = useSquadCompsStore()
  const buildsById = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds])
  const bodyRef = useRef<HTMLDivElement>(null)
  const tagSuggestions = useMemo(() => [...new Set(squadComps.flatMap((s) => s.tags))].sort(), [squadComps])

  /** Bundles every build referenced by the current roster into the share payload as a full
   *  standalone snapshot (not bare `buildId`s, which only resolve in this user's own local
   *  database) — see `SquadCompSharePayload`'s doc comment. */
  function buildSharePayload(): SquadCompSharePayload {
    const referencedIds = new Set<string>()
    for (const party of draft.parties) {
      for (const slot of party.slots) {
        if (slot.buildId) referencedIds.add(slot.buildId)
      }
    }
    const sharedBuilds: Record<string, Build> = {}
    for (const id of referencedIds) {
      const found = buildsById.get(id)
      if (found) sharedBuilds[id] = found
    }
    return { squadComp: draft, builds: sharedBuilds }
  }

  function updateSlot(partyIndex: number, slotIndex: number, updater: (slot: SquadSlot) => SquadSlot): void {
    setDraft((prev) => ({
      ...prev,
      parties: prev.parties.map((party, pIdx) => {
        if (pIdx !== partyIndex) return party
        const slots = party.slots.map((slot, sIdx) => (sIdx === slotIndex ? updater(slot) : slot)) as PartySlots
        return { ...party, slots }
      })
    }))
  }

  function assignBuild(partyIndex: number, slotIndex: number, buildId: string | null): void {
    updateSlot(partyIndex, slotIndex, (slot) => ({ ...slot, buildId, ghostPick: null }))
  }

  function assignGhost(partyIndex: number, slotIndex: number, ghostPick: GhostPick | null): void {
    updateSlot(partyIndex, slotIndex, (slot) => ({ ...slot, buildId: null, ghostPick }))
  }

  function changeLabel(partyIndex: number, slotIndex: number, label: string | null): void {
    updateSlot(partyIndex, slotIndex, (slot) => ({ ...slot, placeholderLabel: label }))
  }

  /**
   * Dropping a dragged build onto a slot assigns it there. If the drag originated from another
   * slot (not the sidebar), that source slot receives whatever the target slot held before —
   * a genuine swap when the target was occupied, or just clears the source when the target was
   * empty (a plain move).
   */
  function dropBuild(partyIndex: number, slotIndex: number, payload: BuildDragPayload): void {
    setDraft((prev) => {
      const parties = prev.parties.map((party) => ({ ...party, slots: [...party.slots] as PartySlots }))
      const targetSlot = parties[partyIndex].slots[slotIndex]
      const targetPrevBuildId = targetSlot.buildId
      parties[partyIndex].slots[slotIndex] = { ...targetSlot, buildId: payload.buildId, ghostPick: null }

      if (payload.sourcePartyIndex !== null && payload.sourceSlotIndex !== null) {
        const isSameSlot = payload.sourcePartyIndex === partyIndex && payload.sourceSlotIndex === slotIndex
        if (!isSameSlot) {
          const sourceSlot = parties[payload.sourcePartyIndex].slots[payload.sourceSlotIndex]
          parties[payload.sourcePartyIndex].slots[payload.sourceSlotIndex] = {
            ...sourceSlot,
            buildId: targetPrevBuildId,
            ghostPick: null
          }
        }
      }

      return { ...prev, parties }
    })
  }

  function addParty(): void {
    setDraft((prev) =>
      prev.parties.length >= MAX_PARTIES ? prev : { ...prev, parties: [...prev.parties, makeBlankParty()] }
    )
  }

  function removeParty(partyIndex: number): void {
    setDraft((prev) => ({ ...prev, parties: prev.parties.filter((_, i) => i !== partyIndex) }))
  }

  /** Saves the current draft, then navigates back — there's no separate Save button; leaving the
   *  editor is what commits the squad (see the "auto-save on back" behavior this replaced). */
  async function handleBack(): Promise<void> {
    setSaving(true)
    try {
      await onBack({ ...draft, updatedAt: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="squad-editor">
      <div className="view-header">
        <button onClick={() => void handleBack()} disabled={saving}>
          {saving ? 'Saving…' : '← Back'}
        </button>
        <input
          type="text"
          className="build-name-input build-name-input-narrow"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} suggestions={tagSuggestions} />
        <ScreenshotButton targetRef={bodyRef} />
        <SharePanel kind="squadComp" getData={buildSharePayload} />
      </div>

      <div className="squad-editor-body" ref={bodyRef}>
        <BuildsSidebar onEditBuild={onEditBuild} />
        <div className="party-rows">
          {draft.parties.map((party, partyIndex) => (
            <PartyRow
              key={partyIndex}
              party={party}
              partyIndex={partyIndex}
              builds={builds}
              buildsById={buildsById}
              onAssignBuild={(slotIndex, buildId) => assignBuild(partyIndex, slotIndex, buildId)}
              onAssignGhost={(slotIndex, ghostPick) => assignGhost(partyIndex, slotIndex, ghostPick)}
              onLabelChange={(slotIndex, label) => changeLabel(partyIndex, slotIndex, label)}
              onDropBuild={(slotIndex, payload) => dropBuild(partyIndex, slotIndex, payload)}
              onRemove={() => removeParty(partyIndex)}
              canRemove={draft.parties.length > 1}
              onEditBuild={onEditBuild}
            />
          ))}
          <button type="button" className="party-row-add" onClick={addParty} disabled={draft.parties.length >= MAX_PARTIES}>
            + Add line
          </button>
        </div>
      </div>
    </section>
  )
}
