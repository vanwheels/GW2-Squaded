import type { ThemeMode } from '@renderer/state/app-settings-store'

interface Props {
  value: ThemeMode
  onChange: (value: ThemeMode) => void
}

const OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' }
]

/**
 * 3-way System/Light/Dark control (SettingsView's Display panel) — plain `<button>`s reusing the
 * same "active" visual (border-color + color: var(--accent)) every other selected-state control in
 * this app already uses (`.nav-item.active`, `.spec-icon-button.chosen`, `.major-trait.selected`,
 * ...), rather than inventing a new segmented-control look. `role="radiogroup"`/`aria-checked` give
 * it the same keyboard/screen-reader semantics as a native radio group.
 */
export function ThemeModeToggle({ value, onChange }: Props) {
  return (
    <div className="theme-mode-row" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          className={value === mode ? 'theme-mode-option active' : 'theme-mode-option'}
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
