import { useState } from 'react'
import type { Build, ProfessionId } from '@shared/types'
import { ProfessionSelect } from './ProfessionSelect'
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

  function handleProfessionChange(profession: ProfessionId): void {
    setDraft({
      ...draft,
      profession,
      specializations: [],
      skills: { heal: null, utility: [null, null, null], elite: null }
    })
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
          <h3>Traits</h3>
          <TraitsEditor
            profession={draft.profession}
            value={draft.specializations}
            onChange={(specializations) => setDraft({ ...draft, specializations })}
          />
          <h3>Skills</h3>
          <SkillsEditor
            profession={draft.profession}
            value={draft.skills}
            onChange={(skills) => setDraft({ ...draft, skills })}
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
