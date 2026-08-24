import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/updater/updater-provider'
import type { DataUpdateStatus, GameDataMeta } from '@shared/game-data/data-update-provider'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { useDataUpdate } from '@renderer/state/data-update-store'
import { useReleaseNotes } from '@renderer/state/release-notes-store'
import { ToggleSwitch } from '@renderer/components/common/ToggleSwitch'
import { ThemeModeToggle } from '@renderer/components/common/ThemeModeToggle'

export function SettingsView() {
  const [version, setVersion] = useState('')
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const {
    showUnderwater,
    setShowUnderwater,
    showRacialSkills,
    setShowRacialSkills,
    themeMode,
    setThemeMode
  } = useAppSettings()
  const dataUpdate = useDataUpdate()
  const { openReleaseNotes } = useReleaseNotes()
  const [localMeta, setLocalMeta] = useState<GameDataMeta | null>(null)

  useEffect(() => {
    void window.gw2Updater.getAppVersion().then(setVersion)
    void window.gw2Updater.isSupported().then(setSupported)
    return window.gw2Updater.onStatus(setStatus)
  }, [])

  // Re-reads local meta on every status change (not just once) since a completed download
  // updates the on-disk copy `getLocalMeta` reads from immediately, even though the loaded game
  // data itself stays the old copy in memory until a restart.
  useEffect(() => {
    void window.gw2DataUpdate.getLocalMeta().then(setLocalMeta)
  }, [dataUpdate.status.state])

  return (
    <section>
      <div className="view-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-grid">
        <div className="settings-panel">
          <h3>Display</h3>
          <div className="field">
            <span>Theme</span>
            <ThemeModeToggle value={themeMode} onChange={setThemeMode} />
          </div>
          <ToggleSwitch
            checked={showUnderwater}
            onChange={setShowUnderwater}
            label="Show underwater equipment & skills"
          />
          <ToggleSwitch checked={showRacialSkills} onChange={setShowRacialSkills} label="Show racial skills" />
        </div>

        <div className="settings-panel">
          <h3>Updates</h3>
          <p className="muted">Current version: {version || '—'}</p>
          <button type="button" onClick={openReleaseNotes}>
            What's New
          </button>
          {supported ? (
            <UpdateControls status={status} />
          ) : (
            <p className="empty-state">
              In-app updates are only available in the packaged Windows build.
            </p>
          )}
        </div>

        <div className="settings-panel">
          <h3>Game data</h3>
          <p className="muted">
            {localMeta
              ? `Last synced ${new Date(localMeta.fetchedAt).toLocaleDateString()}${
                  localMeta.gw2Build !== null ? ` (build ${localMeta.gw2Build})` : ''
                }`
              : 'Loading…'}
          </p>
          <DataUpdateControls status={dataUpdate.status} controls={dataUpdate} />
        </div>

        <div className="settings-panel">
          <h3>Credits</h3>
          <p>
            Equipment-slot and stat-prefix icons are used with permission from{' '}
            <strong>gw2skills.net</strong> — thanks to Connor McLeoud for granting reuse.
          </p>
          <p>
            Profession and elite-specialization icons are the{' '}
            <a href="https://wiki.guildwars2.com/wiki/Guild_Wars_2_Wiki:Profession_icons" target="_blank" rel="noreferrer">
              Guild Wars 2 Wiki's "Tango icon"
            </a>{' '}
            set, licensed under the{' '}
            <a href="https://www.gnu.org/licenses/fdl-1.3.html" target="_blank" rel="noreferrer">
              GNU Free Documentation License
            </a>
            .
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
      </div>
    </section>
  )
}

interface DataUpdateControlsProps {
  status: DataUpdateStatus
  controls: { checkForUpdate: () => void; downloadUpdate: () => void; restartAndApply: () => void }
}

function DataUpdateControls({ status, controls }: DataUpdateControlsProps) {
  switch (status.state) {
    case 'idle':
      return <button onClick={controls.checkForUpdate}>Check for game data updates</button>
    case 'checking':
      return <p className="muted">Checking for game data updates…</p>
    case 'not-available':
      return (
        <div className="settings-update-row">
          <p>Game data is up to date.</p>
          <button onClick={controls.checkForUpdate}>Check again</button>
        </div>
      )
    case 'available':
      return (
        <div className="settings-update-row">
          <p>
            New game data is available
            {status.remoteMeta.gw2Build !== null ? ` (build ${status.remoteMeta.gw2Build})` : ''}.
          </p>
          <button onClick={controls.downloadUpdate}>Download update</button>
        </div>
      )
    case 'downloading':
      return (
        <div className="settings-update-row">
          <p className="muted">Downloading game data… {status.percent}%</p>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${status.percent}%` }} />
          </div>
        </div>
      )
    case 'downloaded':
      return (
        <div className="settings-update-row">
          <p>Game data downloaded and ready — restart to apply.</p>
          <button onClick={controls.restartAndApply}>Restart now</button>
        </div>
      )
    case 'error':
      return (
        <div className="settings-update-row">
          <p className="error-text">Game data check failed: {status.message}</p>
          <button onClick={controls.checkForUpdate}>Try again</button>
        </div>
      )
  }
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
