import { Modal } from '@renderer/components/common/Modal'
import { renderMarkdown } from '@renderer/components/common/markdown'
import { changelogBody } from '@renderer/changelog'

interface Props {
  open: boolean
  onClose: () => void
}

/** Renders the full CHANGELOG.md in-app, newest version first — see `ReleaseNotesProvider` for
 *  when this opens automatically vs. on demand from `SettingsView`'s "What's New" button. */
export function ReleaseNotesModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="release-notes-modal">
      <div className="modal-header">
        <h3>What's New</h3>
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="release-notes-content">{renderMarkdown(changelogBody)}</div>
    </Modal>
  )
}
