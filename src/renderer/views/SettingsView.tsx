import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/updater/updater-provider'

export function SettingsView() {
  const [version, setVersion] = useState('')
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    void window.gw2Updater.getAppVersion().then(setVersion)
    void window.gw2Updater.isSupported().then(setSupported)
    return window.gw2Updater.onStatus(setStatus)
  }, [])

  return (
    <section>
      <div className="view-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-panel">
        <h3>Updates</h3>
        <p className="muted">Current version: {version || '—'}</p>
        {supported ? (
          <UpdateControls status={status} />
        ) : (
          <p className="empty-state">
            In-app updates are only available in the packaged Windows build.
          </p>
        )}
      </div>
    </section>
  )
}

function UpdateControls({ status }: { status: UpdateStatus }) {
  switch (status.state) {
    case 'idle':
      return <button onClick={() => void window.gw2Updater.checkForUpdates()}>Check for updates</button>
    case 'checking':
      return <p className="muted">Checking for updates…</p>
    case 'not-available':
      return (
        <div className="settings-update-row">
          <p>You're on the latest version.</p>
          <button onClick={() => void window.gw2Updater.checkForUpdates()}>Check again</button>
        </div>
      )
    case 'available':
      return (
        <div className="settings-update-row">
          <p>Update {status.version} is available.</p>
          <button onClick={() => void window.gw2Updater.downloadUpdate()}>Download update</button>
        </div>
      )
    case 'downloading':
      return (
        <div className="settings-update-row">
          <p className="muted">Downloading update… {status.percent}%</p>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${status.percent}%` }} />
          </div>
        </div>
      )
    case 'downloaded':
      return (
        <div className="settings-update-row">
          <p>Update {status.version} downloaded and ready to install.</p>
          <button onClick={() => void window.gw2Updater.quitAndInstall()}>Restart and install</button>
        </div>
      )
    case 'error':
      return (
        <div className="settings-update-row">
          <p className="error-text">Update check failed: {status.message}</p>
          <button onClick={() => void window.gw2Updater.checkForUpdates()}>Try again</button>
        </div>
      )
  }
}
