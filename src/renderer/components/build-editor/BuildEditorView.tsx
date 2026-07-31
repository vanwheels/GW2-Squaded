import { useMemo, useRef, useState } from 'react'
import type {
  Build,
  EquipmentSlotKey,
  ProfessionId,
  SkillSelection,
  StandardSkillSelection,
  TraitLineSelection,
  TraitLineSlots
} from '@shared/types'
import { EVOKER_SPECIALIZATION_ID } from '@shared/skill-calc/familiar'
import { useGameData } from '@renderer/state/game-data-store'
import { SharePanel } from '@renderer/components/common/SharePanel'
import { ScreenshotButton } from '@renderer/components/common/ScreenshotButton'
import { ProfessionSelect } from './ProfessionSelect'
import { EliteSpecSelect } from './EliteSpecSelect'
import { TraitsEditor } from './TraitsEditor'
import { SkillsEditor } from './SkillsEditor'
import { EquipmentEditor } from './EquipmentEditor'
import { BoonUptimePanel } from './BoonUptimePanel'
import { StatsPanel } from './StatsPanel'

interface Props {
  build: Build
  isNew: boolean
  onSave: (build: Build) => Promise<void>
  onCancel: () => void
}

const WEAPON_SLOT_KEYS: EquipmentSlotKey[] = ['weaponA1', 'weaponA2', 'weaponB1', 'weaponB2', 'weaponU1', 'weaponU2']

function clearedEquipment(equipment: Build['equipment']): Build['equipment'] {
  const next = { ...equipment }
  for (const key of WEAPON_SLOT_KEYS) delete next[key]
  return next
}

export function BuildEditorView({ build, isNew, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Build>(build)
  const [saving, setSaving] = useState(false)
  const { eliteSpecSkills, legends, professions } = useGameData()
  const columnsRef = useRef<HTMLDivElement>(null)

  const equippedSpecializationIds = useMemo(
    () =>
      new Set(
        draft.specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId)
      ),
    [draft.specializations]
  )

  function handleProfessionChange(profession: ProfessionId): void {
    const skills: SkillSelection =
      profession === 'Revenant'
        ? { kind: 'revenant', legends: [null, null], activeLegendIndex: 0 }
        : { kind: 'standard', heal: null, utility: [null, null, null], elite: null }
    setDraft({
      ...draft,
      profession,
      specializations: [null, null, null],
      skills,
      // Weapon types are profession-specific — old picks (and their itemStatId) are invalid on a
      // new profession. Armor/trinket slots are untouched.
      equipment: clearedEquipment(draft.equipment),
      // Pets are Ranger-only — a pet chosen before switching away (or never touched on a
      // non-Ranger build) is meaningless for the new profession.
      equippedPetIds: [null, null],
      activePetIndex: 0,
      // Familiar is Elementalist Evoker-only, same reasoning as pets above.
      familiarId: profession === 'Elementalist' ? draft.familiarId : null
    })
  }

  /** Equipping/swapping specialization lines can invalidate a previously-chosen elite-spec-
   *  gated skill (e.g. dropping the Luminary line while "Resolute Stance" is the heal skill) or
   *  legend (e.g. dropping the Herald line while Legendary Dragon Stance is equipped) — clear any
   *  selection that's no longer valid under the new specialization set. */
  function handleSpecializationsChange(specializations: TraitLineSlots): void {
    const nextEquippedIds = new Set(
      specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId)
    )
    let skills: SkillSelection
    if (draft.skills.kind === 'revenant') {
      const legendStillValid = (legendId: string | null): string | null => {
        if (legendId === null) return null
        const requiredSpecId = legends.find((l) => l.id === legendId)?.specializationId
        return requiredSpecId == null || nextEquippedIds.has(requiredSpecId) ? legendId : null
      }
      skills = {
        ...draft.skills,
        legends: draft.skills.legends.map(legendStillValid) as [string | null, string | null]
      }
    } else {
      const stillValid = (skillId: number | null): number | null => {
        if (skillId === null) return null
        const requiredSpecId = eliteSpecSkills[skillId]
        return requiredSpecId === undefined || nextEquippedIds.has(requiredSpecId) ? skillId : null
      }
      skills = {
        kind: 'standard',
        heal: stillValid(draft.skills.heal),
        utility: draft.skills.utility.map(stillValid) as StandardSkillSelection['utility'],
        elite: stillValid(draft.skills.elite)
      }
    }

    const profession = professions.find((p) => p.id === draft.profession)
    const equipment = { ...draft.equipment }
    for (const key of WEAPON_SLOT_KEYS) {
      const weaponType = equipment[key]?.weaponType
      const requiredSpecId = weaponType ? profession?.weapons[weaponType]?.specializationId : null
      if (requiredSpecId != null && !nextEquippedIds.has(requiredSpecId)) {
        equipment[key] = { itemStatId: null, weaponType: null }
      }
    }

    const familiarId = nextEquippedIds.has(EVOKER_SPECIALIZATION_ID) ? draft.familiarId : null

    setDraft({ ...draft, specializations, skills, equipment, familiarId })
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
        <ScreenshotButton targetRef={columnsRef} />
        <SharePanel kind="build" getData={() => draft} />
      </div>

      <div className="build-editor-columns" ref={columnsRef}>
        <div className="build-editor-main">
          <div className="build-editor-top-row">
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
            </div>
            <div className="build-editor-column">
              <h3>Equipment</h3>
              <EquipmentEditor
                value={draft.equipment}
                onChange={(equipment) => setDraft({ ...draft, equipment })}
                profession={draft.profession}
                consumables={{ relicId: draft.relicId, foodId: draft.foodId, utilityId: draft.utilityId }}
                onConsumablesChange={(patch) => setDraft({ ...draft, ...patch })}
              />
            </div>
          </div>
          <div className="build-editor-column">
            <h3>Skills</h3>
            <SkillsEditor
              build={draft}
              value={draft.skills}
              onChange={(skills) => setDraft({ ...draft, skills })}
              onBuildChange={(patch) => setDraft({ ...draft, ...patch })}
              equippedSpecializationIds={equippedSpecializationIds}
            />
          </div>
        </div>
        <div className="build-editor-column">
          <StatsPanel build={draft} />
          <BoonUptimePanel build={draft} />
        </div>
      </div>
    </section>
  )
}
