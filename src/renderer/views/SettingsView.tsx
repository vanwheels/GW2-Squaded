import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/updater/updater-provider'
import { useAppSettings } from '@renderer/state/app-settings-store'

export function SettingsView() {
  const [version, setVersion] = useState('')
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const { showUnderwater, setShowUnderwater, showRacialSkills, setShowRacialSkills } = useAppSettings()

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
        <h3>Display</h3>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={showUnderwater}
            onChange={(e) => setShowUnderwater(e.target.checked)}
          />
          <span>Show underwater equipment &amp; skills</span>
        </label>
        <p className="muted">
          When off, the Equipment tab's underwater weapon panel and the in-game skill bar's
          land/underwater toggle stay hidden, and underwater weapon skills are excluded from
          boon/condition totals — same as if nothing were equipped underwater. Off by default since
          underwater combat rarely comes up in WvW.
        </p>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={showRacialSkills}
            onChange={(e) => setShowRacialSkills(e.target.checked)}
          />
          <span>Show racial skills</span>
        </label>
        <p className="muted">
          When off, Human/Charr/Asura/Norn/Sylvari racial skills are hidden from the Heal/Utility/
          Elite pickers. Off by default since racial skills rarely see competitive WvW use.
        </p>
      </div>

      <div className="settings-panel settings-panel-spaced">
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

      <div className="settings-panel settings-panel-spaced">
        <h3>Credits</h3>
        <p>
          Equipment-slot and stat-prefix icons are used with permission from{' '}
          <strong>gw2skills.net</strong> — thanks to Connor McLeoud for granting reuse.
        </p>
        <p>
          Reference data and imagery also draw on the{' '}
          <strong>Guild Wars 2 Wiki</strong> community.
        </p>
        <p className="muted">
          This application is not affiliated with or endorsed by ArenaNet or NCSOFT. Guild Wars 2
          game data is used under{' '}
          <a
            href="https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/"
            target="_blank"
            rel="noreferrer"
          >
            ArenaNet's Content Terms of Use
          </a>
          .
        </p>
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
