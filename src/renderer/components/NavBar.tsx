import { useDataUpdate } from '@renderer/state/data-update-store'

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
  // is enough of a prompt without interrupting anything.
  const { status } = useDataUpdate()
  const dataUpdateAvailable = status.state === 'available'

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
          {item.key === 'settings' && dataUpdateAvailable && (
            <span className="nav-item-badge" title="Game data update available" />
          )}
        </button>
      ))}
    </nav>
  )
}
