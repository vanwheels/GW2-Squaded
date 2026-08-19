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
import { SPECTER_SPEC_ID } from '@shared/skill-calc/profession-mechanic'
import { WEAVER_SPEC_ID } from '@shared/weapon-calc/weapon-skills'
import { DEFAULT_COMBAT_STATE, type CombatState } from '@shared/gear-calc/combat-state'
import { getBuildAutoTags } from '@shared/tags/auto-tags'
import { withUnderwaterSetting } from '@shared/types/build'
import { useGameData } from '@renderer/state/game-data-store'
import { useBuildsStore } from '@renderer/state/builds-store'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { useDataUpdate } from '@renderer/state/data-update-store'
import { SharePanel } from '@renderer/components/common/SharePanel'
import { ScreenshotButton } from '@renderer/components/common/ScreenshotButton'
import { TagInput } from '@renderer/components/common/TagInput'
import { ProfessionSpecPicker } from './ProfessionSpecPicker'
import { TraitsEditor } from './TraitsEditor'
import { SkillsEditor } from './SkillsEditor'
import { EquipmentEditor } from './EquipmentEditor'
import { EquipmentTextManifest } from './EquipmentTextManifest'
import { WeaponTypeBar } from './WeaponTypeBar'
import { StatsPanel } from './StatsPanel'
import { CombatStatePanel } from './CombatStatePanel'
import { BoonConditionSummaryPanel } from './BoonConditionSummaryPanel'
import { GearOptimizerPanel } from './GearOptimizerPanel'

interface Props {
  build: Build
  onBack: (build: Build) => Promise<void>
}

const WEAPON_SLOT_KEYS: EquipmentSlotKey[] = ['weaponA1', 'weaponA2', 'weaponB1', 'weaponB2', 'weaponU1', 'weaponU2']

function clearedEquipment(equipment: Build['equipment']): Build['equipment'] {
  const next = { ...equipment }
  for (const key of WEAPON_SLOT_KEYS) delete next[key]
  return next
}

export function BuildEditorView({ build, onBack }: Props) {
  const [draft, setDraft] = useState<Build>(build)
  const [saving, setSaving] = useState(false)
  const [combatState, setCombatState] = useState<CombatState>(DEFAULT_COMBAT_STATE)
  const [optimizerOpen, setOptimizerOpen] = useState(false)
  // Screenshot-only equipment text manifest (see EquipmentTextManifest's doc comment) — hidden by
  // default so it never clutters normal editing; toggled on right before using ScreenshotButton,
  // same as a print-preview. Included in the capture whenever it's open since it lives inside
  // `columnsRef`'s own subtree, below the normal 3-column layout.
  const [screenshotPreviewOpen, setScreenshotPreviewOpen] = useState(false)
  const { eliteSpecSkills, legends, professions, specializationsById } = useGameData()
  const { builds } = useBuildsStore()
  const { showUnderwater } = useAppSettings()
  const { localGw2Build } = useDataUpdate()
  const columnsRef = useRef<HTMLDivElement>(null)

  /** Display/calc-only view of `draft` — never passed to `onBack`. See `withUnderwaterSetting`'s
   *  doc comment: forces `environment: 'land'` when the Settings underwater toggle is off, so
   *  `StatsPanel`/`BoonConditionSummaryPanel`/`SkillsEditor` (and everything it renders underneath,
   *  `WeaponSkillBar`/`ProfessionMechanicBar`) all behave as if nothing were equipped underwater,
   *  regardless of what `draft.environment` actually holds. Edits still flow through the real
   *  `draft` below (`onBuildChange`/`setDraft` close over `draft`, not this), so this is purely a
   *  read-side mask. */
  const displayBuild = useMemo(() => withUnderwaterSetting(draft, showUnderwater), [draft, showUnderwater])

  const autoTags = useMemo(
    () => getBuildAutoTags(draft, { professions, specializationsById }),
    [draft, professions, specializationsById]
  )
  const tagSuggestions = useMemo(() => [...new Set(builds.flatMap((b) => b.tags))].sort(), [builds])

  const equippedSpecializationIds = useMemo(
    () =>
      new Set(
        draft.specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId)
      ),
    [draft.specializations]
  )

  /** `initialEliteSpecId` lets `ProfessionSpecPicker` land on a different profession's elite spec
   *  in one click (see its doc comment) — seeded directly into the reset specialization slots
   *  rather than as a follow-up `handleSpecializationsChange` call, since two separate `setDraft`
   *  calls in the same handler would have the second one operate on stale `draft`. */
  function handleProfessionChange(profession: ProfessionId, initialEliteSpecId: number | null = null): void {
    const skills: SkillSelection =
      profession === 'Revenant'
        ? { kind: 'revenant', legends: [null, null], activeLegendIndex: 0 }
        : { kind: 'standard', heal: null, utility: [null, null, null], elite: null }
    const specializations: TraitLineSlots = [
      null,
      null,
      initialEliteSpecId === null ? null : { specializationId: initialEliteSpecId, chosenTraitIds: [null, null, null] }
    ]
    setDraft({
      ...draft,
      profession,
      specializations,
      skills,
      // Weapon types are profession-specific — old picks (and their itemStatId) are invalid on a
      // new profession. Armor/trinket slots are untouched.
      equipment: clearedEquipment(draft.equipment),
      // Pets are Ranger-only — a pet chosen before switching away (or never touched on a
      // non-Ranger build) is meaningless for the new profession.
      equippedPetIds: [null, null],
      activePetIndex: 0,
      // Familiar is Elementalist Evoker-only, same reasoning as pets above.
      familiarId: profession === 'Elementalist' ? draft.familiarId : null,
      // Weaver's "previous" attunement is Elementalist Weaver-only, same reasoning as pets above —
      // landing directly on Weaver via `initialEliteSpecId` (a one-click cross-profession pick, see
      // this function's own doc comment) defaults it to match `activeAttunement` (current ===
      // previous) rather than carrying over the old profession's always-null value, same seeding
      // `handleSpecializationsChange` does below for a same-profession pick.
      weaverPreviousAttunement:
        profession === 'Elementalist' && initialEliteSpecId === WEAVER_SPEC_ID
          ? draft.activeAttunement
          : profession === 'Elementalist'
            ? draft.weaverPreviousAttunement
            : null,
      // Stolen Skill is Thief-only, same reasoning as pets/familiar above.
      thiefStolenSkillId: profession === 'Thief' ? draft.thiefStolenSkillId : null
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

    // Weapon legality no longer depends on which spec line is equipped — "Weaponmaster Training"
    // is always-on (see EquipmentEditor's spec-agnostic `weaponOptions`, COMPLETED.md Session 35),
    // so dropping/switching a trait line must NOT clear an already-equipped elite-spec weapon
    // (e.g. dropping Renegade must not unequip Shortbow).
    const familiarId = nextEquippedIds.has(EVOKER_SPECIALIZATION_ID) ? draft.familiarId : null
    // Weaver's "previous" attunement: cleared when Weaver's dropped, seeded to match
    // `activeAttunement` (current === previous) when it's newly picked up — see
    // `Build.weaverPreviousAttunement`'s doc comment.
    const weaverPreviousAttunement = nextEquippedIds.has(WEAVER_SPEC_ID)
      ? (draft.weaverPreviousAttunement ?? draft.activeAttunement)
      : null
    // Specter's own F2 "Enter Shadow Shroud" replaces the manually-picked Stolen Skill slot
    // entirely — see `Build.thiefStolenSkillId`'s doc comment.
    const thiefStolenSkillId = nextEquippedIds.has(SPECTER_SPEC_ID) ? null : draft.thiefStolenSkillId

    setDraft({ ...draft, specializations, skills, familiarId, weaverPreviousAttunement, thiefStolenSkillId })
  }

  /** `ProfessionSpecPicker`'s single combined onChoose — an elite spec from a different profession
   *  switches profession first (seeding that new profession's reset specialization slots with the
   *  chosen spec directly, see `handleProfessionChange`); same-profession picks just update the
   *  elite trait line via the normal `handleSpecializationsChange` invalidation logic. */
  function handleEliteSpecChoose(profession: ProfessionId, eliteSpecializationId: number | null): void {
    if (profession !== draft.profession) {
      handleProfessionChange(profession, eliteSpecializationId)
      return
    }
    const nextSpecializations = [...draft.specializations] as TraitLineSlots
    nextSpecializations[2] =
      eliteSpecializationId === null ? null : { specializationId: eliteSpecializationId, chosenTraitIds: [null, null, null] }
    handleSpecializationsChange(nextSpecializations)
  }

  /** Saves the current draft, then navigates back — there's no separate Save button; leaving the
   *  editor is what commits the build (see the "auto-save on back" behavior this replaced). Stamps
   *  `updatedAtGw2Build` alongside `updatedAt` so `BuildsView`'s card can later tell "reviewed under
   *  the current patch" apart from "not reviewed since a balance patch shipped" — see that field's
   *  doc comment on `Build`. */
  async function handleBack(): Promise<void> {
    setSaving(true)
    try {
      await onBack({ ...draft, updatedAt: new Date().toISOString(), updatedAtGw2Build: localGw2Build })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="build-editor">
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
        <TagInput
          tags={draft.tags}
          onChange={(tags) => setDraft({ ...draft, tags })}
          suggestions={tagSuggestions}
          autoTags={autoTags}
        />
        <button type="button" onClick={() => setScreenshotPreviewOpen((open) => !open)}>
          {screenshotPreviewOpen ? 'Hide screenshot layout' : 'Preview screenshot layout'}
        </button>
        <ScreenshotButton targetRef={columnsRef} />
        <SharePanel kind="build" getData={() => draft} />
      </div>

      {/* Profession/elite-spec + weapon-type picks, both single-button-opens-a-popover controls,
          share this row above the 3-column layout (2026-08-19) — freed up by moving Tags into the
          header row above. Bumps Traits up to the top of its own column (no more picker sitting
          above it) and gives weapon-type selection its own dedicated gw2skills.net-style strip
          instead of living inside any one gear slot — see `WeaponTypeBar`'s doc comment. */}
      <div className="editor-profession-weapon-bar">
        <ProfessionSpecPicker
          profession={draft.profession}
          specializations={draft.specializations}
          onChoose={handleEliteSpecChoose}
        />
        <div className="editor-profession-weapon-divider" />
        <WeaponTypeBar build={draft} onEquipmentChange={(equipment) => setDraft({ ...draft, equipment })} />
      </div>

      <div className="build-editor-capture" ref={columnsRef}>
        <div className="build-editor-columns">
          <div className="build-editor-column">
            <h3>Traits</h3>
            <TraitsEditor
              profession={draft.profession}
              build={displayBuild}
              value={draft.specializations}
              onChange={handleSpecializationsChange}
            />
          </div>
          <div className="build-editor-column">
            <div className="column-header-row">
              <h3>Equipment</h3>
              <button type="button" onClick={() => setOptimizerOpen(true)}>
                Gear Optimizer
              </button>
            </div>
            <EquipmentEditor
              value={draft.equipment}
              onChange={(equipment) => setDraft({ ...draft, equipment })}
              profession={draft.profession}
              consumables={{ relicId: draft.relicId, foodId: draft.foodId, utilityId: draft.utilityId }}
              onConsumablesChange={(patch) => setDraft({ ...draft, ...patch })}
            />
          </div>
          <div className="build-editor-column build-editor-column-fill build-editor-column-stretch">
            {/* Stats+Boons share a row (2026-08-19) — BoonConditionSummaryPanel used to sit in its
                own full-width block below StatsPanel, leaving the space right of the narrow stat
                grid empty; CombatStatePanel (simulation-assumption toggles, must stay inside
                `.build-editor-capture` — see its own doc comment) reflows into its own full-width
                strip below the row instead of squeezing into that same narrow column, freeing
                Skills to move up into the space both changes vacate. */}
            <div className="stats-combat-block">
              <div className="stats-boons-row">
                <StatsPanel build={displayBuild} combatState={combatState} />
                <BoonConditionSummaryPanel build={displayBuild} />
              </div>
              <CombatStatePanel build={displayBuild} value={combatState} onChange={setCombatState} />
            </div>
            <h3>Skills</h3>
            <SkillsEditor
              build={displayBuild}
              value={draft.skills}
              onChange={(skills) => setDraft({ ...draft, skills })}
              onBuildChange={(patch) => setDraft({ ...draft, ...patch })}
              equippedSpecializationIds={equippedSpecializationIds}
              combatState={combatState}
            />
          </div>
        </div>
        {screenshotPreviewOpen && (
          <div className="equipment-text-manifest-wrap">
            <h4 className="equip-manifest-heading">Equipment (screenshot layout)</h4>
            <EquipmentTextManifest build={draft} />
          </div>
        )}
      </div>

      <GearOptimizerPanel
        build={draft}
        combatState={combatState}
        onApply={(patch) => setDraft({ ...draft, ...patch })}
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      />
    </section>
  )
}
