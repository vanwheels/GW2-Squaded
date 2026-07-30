import { useMemo, useState } from 'react'
import type { Build, ProfessionId, SkillSelection, TraitLineSelection, TraitLineSlots } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { ProfessionSelect } from './ProfessionSelect'
import { EliteSpecSelect } from './EliteSpecSelect'
import { TraitsEditor } from './TraitsEditor'
import { SkillsEditor } from './SkillsEditor'
import { EquipmentEditor } from './EquipmentEditor'
import { BoonUptimePanel } from './BoonUptimePanel'

interface Props {
  build: Build
  isNew: boolean
  onSave: (build: Build) => Promise<void>
  onCancel: () => void
}

export function BuildEditorView({ build, isNew, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Build>(build)
  const [saving, setSaving] = useState(false)
  const { eliteSpecSkills } = useGameData()

  const equippedSpecializationIds = useMemo(
    () =>
      new Set(
        draft.specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId)
      ),
    [draft.specializations]
  )

  function handleProfessionChange(profession: ProfessionId): void {
    setDraft({
      ...draft,
      profession,
      specializations: [null, null, null],
      skills: { heal: null, utility: [null, null, null], elite: null }
    })
  }

  /** Equipping/swapping specialization lines can invalidate a previously-chosen elite-spec-
   *  gated skill (e.g. dropping the Luminary line while "Resolute Stance" is the heal skill) —
   *  clear any skill selection that's no longer valid under the new specialization set. */
  function handleSpecializationsChange(specializations: TraitLineSlots): void {
    const nextEquippedIds = new Set(
      specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId)
    )
    const stillValid = (skillId: number | null): number | null => {
      if (skillId === null) return null
      const requiredSpecId = eliteSpecSkills[skillId]
      return requiredSpecId === undefined || nextEquippedIds.has(requiredSpecId) ? skillId : null
    }
    const skills: SkillSelection = {
      heal: stillValid(draft.skills.heal),
      utility: draft.skills.utility.map(stillValid) as SkillSelection['utility'],
      elite: stillValid(draft.skills.elite)
    }
    setDraft({ ...draft, specializations, skills })
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
    <section className="build-editor">
      <div className="view-header">
        <button onClick={onCancel}>← Back</button>
        <input
          className="build-name-input"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Create build' : 'Save'}
        </button>
      </div>

      <div className="build-editor-columns">
        <div className="build-editor-column">
          <ProfessionSelect value={draft.profession} onChange={handleProfessionChange} />
          <EliteSpecSelect
            profession={draft.profession}
            value={draft.specializations}
            onChange={handleSpecializationsChange}
          />
          <h3>Traits</h3>
          <TraitsEditor
            profession={draft.profession}
            value={draft.specializations}
            onChange={handleSpecializationsChange}
          />
          <h3>Skills</h3>
          <SkillsEditor
            build={draft}
            value={draft.skills}
            onChange={(skills) => setDraft({ ...draft, skills })}
            equippedSpecializationIds={equippedSpecializationIds}
          />
        </div>
        <div className="build-editor-column">
          <h3>Equipment</h3>
          <EquipmentEditor
            value={draft.equipment}
            onChange={(equipment) => setDraft({ ...draft, equipment })}
          />
        </div>
        <div className="build-editor-column">
          <BoonUptimePanel build={draft} />
        </div>
      </div>
    </section>
  )
}
