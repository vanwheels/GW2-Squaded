import type { RefObject } from 'react'
import type { Build, ProfessionId, TraitLineSlots } from '@shared/types'
import type { CombatState } from '@shared/gear-calc/combat-state'
import { ProfessionSpecPicker } from './ProfessionSpecPicker'
import { WeaponTypeBar } from './WeaponTypeBar'
import { CombatStatePanel } from './CombatStatePanel'
import { TraitsEditor } from './TraitsEditor'
import { EquipmentEditor } from './EquipmentEditor'
import { EquipmentTextManifest } from './EquipmentTextManifest'
import { StatsPanel } from './StatsPanel'
import { BoonConditionSummaryPanel } from './BoonConditionSummaryPanel'
import { SkillsEditor } from './SkillsEditor'

interface Props {
  /** Display build — already underwater-masked by the caller (see `withUnderwaterSetting`), same
   *  as `BuildEditorView`'s `displayBuild`. */
  build: Build
  combatState: CombatState
  equippedSpecializationIds: Set<number>
  /** Whether the screenshot-only equipment text manifest row renders below the 3 columns — always
   *  `true` for a read-only preview (that's the whole point of "what a screenshot would look
   *  like"), a live toggle (`screenshotPreviewOpen`) in the real editor. */
  showEquipmentManifest: boolean
  /** `ScreenshotButton`'s capture target in the real editor; omitted for a read-only preview,
   *  which has nothing to screenshot itself. */
  gridRef?: RefObject<HTMLDivElement>
  /** `false` makes the whole grid inert (`pointer-events: none`) — used by `BuildPreviewModal` so
   *  a quick look at a build's layout can never accidentally start editing it. Every `on*` handler
   *  below is optional and no-ops by default for exactly that case: with pointer events off, none
   *  of them can fire anyway, so the read-only caller doesn't need to wire up real ones. Defaults
   *  to `true` (the interactive, `BuildEditorView` case). */
  interactive?: boolean
  onProfessionSpecChoose?: (profession: ProfessionId, eliteSpecializationId: number | null) => void
  onCombatStateChange?: (state: CombatState) => void
  onWeaponEquipmentChange?: (equipment: Build['equipment']) => void
  onSpecializationsChange?: (specializations: TraitLineSlots) => void
  onEquipmentChange?: (equipment: Build['equipment']) => void
  onConsumablesChange?: (value: Pick<Build, 'relicId' | 'foodId' | 'utilityId'>) => void
  onOpenOptimizer?: () => void
  onSkillsChange?: (skills: Build['skills']) => void
  onBuildChange?: (patch: Partial<Build>) => void
}

/**
 * The "screenshot" portion of the build editor — Profession/Weapon-type/Combat-state toolbar row
 * plus the Traits/Equipment/Stats+Skills columns and the optional equipment text manifest below
 * them — factored out of `BuildEditorView` (2026-08-19) so `BuildPreviewModal`'s right-click
 * "Preview" can render the exact same layout read-only for an arbitrary build, without a second
 * copy of this markup drifting out of sync with the real editor. See that component's doc comment
 * on `interactive` for how the two callers differ.
 */
export function BuildScreenshotGrid({
  build,
  combatState,
  equippedSpecializationIds,
  showEquipmentManifest,
  gridRef,
  interactive = true,
  onProfessionSpecChoose = () => {},
  onCombatStateChange = () => {},
  onWeaponEquipmentChange = () => {},
  onSpecializationsChange = () => {},
  onEquipmentChange = () => {},
  onConsumablesChange = () => {},
  onOpenOptimizer = () => {},
  onSkillsChange = () => {},
  onBuildChange = () => {}
}: Props) {
  return (
    <div
      className="build-editor-grid"
      ref={gridRef}
      style={interactive ? undefined : { pointerEvents: 'none' }}
    >
      <div className="build-editor-top-cell build-editor-top-cell-snug">
        <ProfessionSpecPicker
          profession={build.profession}
          specializations={build.specializations}
          onChoose={onProfessionSpecChoose}
        />
      </div>
      <div className="build-editor-top-cell build-editor-top-cell-snug">
        <WeaponTypeBar build={build} onEquipmentChange={onWeaponEquipmentChange} />
      </div>
      <div className="build-editor-top-cell">
        <CombatStatePanel build={build} value={combatState} onChange={onCombatStateChange} />
      </div>

      <div className="build-editor-column">
        <h3>Traits</h3>
        <TraitsEditor
          profession={build.profession}
          build={build}
          value={build.specializations}
          onChange={onSpecializationsChange}
        />
      </div>
      <div className="build-editor-column">
        <div className="column-header-row">
          <h3>Equipment</h3>
          <button type="button" onClick={onOpenOptimizer}>
            Gear Optimizer
          </button>
        </div>
        <EquipmentEditor
          value={build.equipment}
          onChange={onEquipmentChange}
          profession={build.profession}
          consumables={{ relicId: build.relicId, foodId: build.foodId, utilityId: build.utilityId }}
          onConsumablesChange={onConsumablesChange}
        />
      </div>
      <div className="build-editor-column build-editor-column-stretch">
        <div className="stats-boons-row">
          <StatsPanel build={build} combatState={combatState} />
          <BoonConditionSummaryPanel build={build} />
        </div>
        <SkillsEditor
          build={build}
          value={build.skills}
          onChange={onSkillsChange}
          onBuildChange={onBuildChange}
          equippedSpecializationIds={equippedSpecializationIds}
          combatState={combatState}
        />
      </div>

      {showEquipmentManifest && (
        <div className="equipment-text-manifest-wrap build-editor-grid-fullwidth">
          <EquipmentTextManifest build={build} />
        </div>
      )}
    </div>
  )
}
