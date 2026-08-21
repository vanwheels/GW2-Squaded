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
import { isBuildStaleSincePatch, withUnderwaterSetting } from '@shared/types/build'
import { useGameData } from '@renderer/state/game-data-store'
import { useBuildsStore } from '@renderer/state/builds-store'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { useDataUpdate } from '@renderer/state/data-update-store'
import { SharePanel } from '@renderer/components/common/SharePanel'
import { ScreenshotButton } from '@renderer/components/common/ScreenshotButton'
import { TagInput } from '@renderer/components/common/TagInput'
import { ToggleSwitch } from '@renderer/components/common/ToggleSwitch'
import { BuildScreenshotGrid } from './BuildScreenshotGrid'
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
  const { eliteSpecSkills, legends, professions, specializationsById } = useGameData()
  const { builds } = useBuildsStore()
  const { showUnderwater, partyWideOnly, setPartyWideOnly } = useAppSettings()
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
   *  `updatedAtGw2Build` alongside `updatedAt`, but only when `draft` actually differs from the
   *  `build` prop the editor was opened with — merely opening the editor and immediately backing
   *  out must NOT touch either timestamp, or `BuildsView`'s "reviewed under the current patch" vs.
   *  "not reviewed since a balance patch shipped" distinction (`isBuildStaleSincePatch`, see
   *  `updatedAtGw2Build`'s doc comment on `Build`) gets silently cleared by just glancing at a
   *  build. `Build` is plain JSON-serializable data (no `Date`/`Set`/`Map` fields), so a
   *  `JSON.stringify` comparison is a safe, dependency-free stand-in for deep-equality here. */
  async function handleBack(): Promise<void> {
    setSaving(true)
    try {
      const edited = JSON.stringify(draft) !== JSON.stringify(build)
      await onBack(
        edited ? { ...draft, updatedAt: new Date().toISOString(), updatedAtGw2Build: localGw2Build } : draft
      )
    } finally {
      setSaving(false)
    }
  }

  /** User-initiated counterpart to the automatic stamping above: confirms "I reviewed this build
   *  against the current patch and it's still good" without requiring a throwaway content edit to
   *  clear the "Not reviewed since latest patch" flag (`isBuildStaleSincePatch`). Only touches
   *  `draft` — like every other field here, it's persisted by the normal save-on-`handleBack` flow,
   *  not immediately, so it composes with the diff check above instead of bypassing it. */
  function handleMarkReviewed(): void {
    setDraft({ ...draft, updatedAt: new Date().toISOString(), updatedAtGw2Build: localGw2Build })
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
        {isBuildStaleSincePatch(draft, localGw2Build) && (
          <button type="button" onClick={handleMarkReviewed} title="Confirm this build is still good under the current patch">
            Mark as up to date
          </button>
        )}
        <ToggleSwitch checked={partyWideOnly} onChange={setPartyWideOnly} label="Party-wide only" />
        <ScreenshotButton targetRef={columnsRef} />
        <SharePanel kind="build" getData={() => draft} />
      </div>

      {/* `BuildScreenshotGrid` (2026-08-19) — the "toolbar row + 3 editing columns" CSS Grid used to
          live inline here; factored out so `BuildPreviewModal`'s right-click "Preview" can render
          the exact same layout read-only for an arbitrary build, see that component's doc comment.
          `columnsRef` (`gridRef` below) is still `ScreenshotButton`'s capture target — only this
          component's own doc comment now carries the "why this grid, why these cells" reasoning. */}
      <BuildScreenshotGrid
        build={displayBuild}
        combatState={combatState}
        equippedSpecializationIds={equippedSpecializationIds}
        gridRef={columnsRef}
        onProfessionSpecChoose={handleEliteSpecChoose}
        onCombatStateChange={setCombatState}
        onWeaponEquipmentChange={(equipment) => setDraft({ ...draft, equipment })}
        onSpecializationsChange={handleSpecializationsChange}
        onEquipmentChange={(equipment) => setDraft({ ...draft, equipment })}
        onConsumablesChange={(patch) => setDraft({ ...draft, ...patch })}
        onOpenOptimizer={() => setOptimizerOpen(true)}
        onSkillsChange={(skills) => setDraft({ ...draft, skills })}
        onBuildChange={(patch) => setDraft({ ...draft, ...patch })}
      />

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
