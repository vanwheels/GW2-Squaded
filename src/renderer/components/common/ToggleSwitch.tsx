interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/**
 * iOS-style pill toggle switch (flagged 2026-08-16, replacing the plain checkboxes `SettingsView`
 * used to use — see TODO.md's Settings-restyle item and `--toggle-on` in `global.css` for the color
 * decision). A real `<input type="checkbox">` still drives the state and stays keyboard/screen-reader
 * accessible — only visually hidden (`toggle-switch-input`) — with the track/thumb built from a
 * sibling `<span>` styled off the input's own `:checked`/`:focus-visible` state via CSS, rather than
 * a non-native custom control.
 */
export function ToggleSwitch({ checked, onChange, label }: Props) {
  return (
    <label className="toggle-switch-row">
      <input
        className="toggle-switch-input"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-switch-track" aria-hidden="true">
        <span className="toggle-switch-thumb" />
      </span>
      <span>{label}</span>
    </label>
  )
}
