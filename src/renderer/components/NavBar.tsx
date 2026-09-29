import { useDataUpdate } from '@renderer/state/data-update-store'
import { useUpdater } from '@renderer/state/updater-store'

export type ViewKey = 'builds' | 'squads' | 'settings'

interface NavBarProps {
  active: ViewKey
  onChange: (view: ViewKey) => void
}

const NAV_ITEMS: { key: ViewKey; label: string }[] = [
  { key: 'builds', label: 'Builds' },
  { key: 'squads', label: 'Squads' },
  { key: 'settings', label: 'Settings' }
]

export function NavBar({ active, onChange }: NavBarProps) {
  // "Check on launch, prompt the user" (TODO.md) surfaces here rather than a launch-time modal —
  // a quiet badge on the Settings tab, where the matching check/download controls already live,
  // is enough of a prompt without interrupting anything. Same treatment for the app-binary
  // updater as the game-data one; the app update takes priority in the title since it's the
  // more actionable of the two when both happen to be available at once.
  const { status: dataUpdateStatus } = useDataUpdate()
  const dataUpdateAvailable = dataUpdateStatus.state === 'available'
  const { status: appUpdateStatus } = useUpdater()
  const appUpdateAvailable = appUpdateStatus.state === 'available' || appUpdateStatus.state === 'downloaded'
  const badgeTitle = appUpdateAvailable ? 'App update available' : 'Game data update available'

  return (
    <nav className="nav-bar">
      <span className="nav-brand">GW2-Squaded</span>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={item.key === active ? 'nav-item active' : 'nav-item'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.key === 'settings' && (dataUpdateAvailable || appUpdateAvailable) && (
            <span className="nav-item-badge" title={badgeTitle} />
          )}
        </button>
      ))}
    </nav>
  )
}
