import { useMemo, useState } from 'react'
import type { PartySlots, SquadComp, SquadSlot } from '@shared/types'
import { useBuildsStore } from '@renderer/state/builds-store'
import { makeBlankParty } from '@renderer/state/squad-comps-store'
import { BuildsSidebar } from './BuildsSidebar'
import { PartyRow } from './PartyRow'
import type { BuildDragPayload } from './drag-payload'

interface Props {
  squadComp: SquadComp
  isNew: boolean
  onSave: (squadComp: SquadComp) => Promise<void>
  onCancel: () => void
}

/** WvW's real squad cap is 50 players (10 parties of 5) — see TODO.md. */
const MAX_PARTIES = 10

export function SquadCompEditorView({ squadComp, isNew, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<SquadComp>(squadComp)
  const [saving, setSaving] = useState(false)
  const { builds } = useBuildsStore()
  const buildsById = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds])

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
    updateSlot(partyIndex, slotIndex, (slot) => ({ ...slot, buildId }))
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
      parties[partyIndex].slots[slotIndex] = { ...targetSlot, buildId: payload.buildId }

      if (payload.sourcePartyIndex !== null && payload.sourceSlotIndex !== null) {
        const isSameSlot = payload.sourcePartyIndex === partyIndex && payload.sourceSlotIndex === slotIndex
        if (!isSameSlot) {
          const sourceSlot = parties[payload.sourcePartyIndex].slots[payload.sourceSlotIndex]
          parties[payload.sourcePartyIndex].slots[payload.sourceSlotIndex] = {
            ...sourceSlot,
            buildId: targetPrevBuildId
          }
        }
      }

      return { ...prev, parties }
    })
  }

  function renameParty(partyIndex: number, name: string): void {
    setDraft((prev) => ({
      ...prev,
      parties: prev.parties.map((p, i) => (i === partyIndex ? { ...p, name } : p))
    }))
  }

  function addParty(): void {
    setDraft((prev) =>
      prev.parties.length >= MAX_PARTIES
        ? prev
        : { ...prev, parties: [...prev.parties, makeBlankParty(`Party ${prev.parties.length + 1}`)] }
    )
  }

  function removeParty(partyIndex: number): void {
    setDraft((prev) => ({ ...prev, parties: prev.parties.filter((_, i) => i !== partyIndex) }))
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      await onSave({ ...draft, updatedAt: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="squad-editor">
      <div className="view-header">
        <button onClick={onCancel}>← Back</button>
        <input
          className="build-name-input"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Create squad' : 'Save'}
        </button>
      </div>

      <div className="squad-editor-body">
        <BuildsSidebar />
        <div className="party-rows">
          {draft.parties.map((party, partyIndex) => (
            <PartyRow
              key={partyIndex}
              party={party}
              partyIndex={partyIndex}
              builds={builds}
              buildsById={buildsById}
              onNameChange={(name) => renameParty(partyIndex, name)}
              onAssignBuild={(slotIndex, buildId) => assignBuild(partyIndex, slotIndex, buildId)}
              onLabelChange={(slotIndex, label) => changeLabel(partyIndex, slotIndex, label)}
              onDropBuild={(slotIndex, payload) => dropBuild(partyIndex, slotIndex, payload)}
              onRemove={() => removeParty(partyIndex)}
              canRemove={draft.parties.length > 1}
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
