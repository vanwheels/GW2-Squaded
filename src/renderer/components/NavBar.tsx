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
        </button>
      ))}
    </nav>
  )
}
