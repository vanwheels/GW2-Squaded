import { useMemo } from 'react'
import type { Build, TraitLineSelection } from '@shared/types'
import { DEFAULT_COMBAT_STATE } from '@shared/gear-calc/combat-state'
import { withUnderwaterSetting } from '@shared/types/build'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { Modal } from '@renderer/components/common/Modal'
import { BuildScreenshotGrid } from './BuildScreenshotGrid'

interface Props {
  build: Build | null
  onClose: () => void
}

/**
 * Read-only "what would this build's screenshot look like" popup — the squad editor's right-click
 * "Preview" (see `BuildsSidebar`'s context menu). Renders the exact same `BuildScreenshotGrid` the
 * real `BuildEditorView`/`ScreenshotButton` capture, just `interactive={false}` (inert, no draft
 * state of its own) and always with the equipment manifest shown, since a preview has no separate
 * "toggle it on before screenshotting" step to mirror — it's meant to look like the finished
 * screenshot immediately.
 */
export function BuildPreviewModal({ build, onClose }: Props) {
  const { showUnderwater } = useAppSettings()
  const displayBuild = useMemo(() => (build ? withUnderwaterSetting(build, showUnderwater) : null), [build, showUnderwater])
  const equippedSpecializationIds = useMemo(() => {
    if (!build) return new Set<number>()
    return new Set(
      build.specializations.filter((s): s is TraitLineSelection => s !== null).map((s) => s.specializationId)
    )
  }, [build])

  return (
    <Modal open={displayBuild !== null} onClose={onClose} className="build-preview-modal">
      {displayBuild && (
        <>
          <div className="modal-header">
            <h3>{displayBuild.name}</h3>
            <button type="button" className="modal-close" onClick={onClose}>
              ✕
            </button>
          </div>
          <BuildScreenshotGrid
            build={displayBuild}
            combatState={DEFAULT_COMBAT_STATE}
            equippedSpecializationIds={equippedSpecializationIds}
            interactive={false}
          />
        </>
      )}
    </Modal>
  )
}
