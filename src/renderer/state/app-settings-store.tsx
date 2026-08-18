import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** 'system' follows the OS's `prefers-color-scheme`; 'light'/'dark' are explicit overrides. */
export type ThemeMode = 'system' | 'light' | 'dark'

interface AppSettings {
  /** Off by default (noted 2026-07-31 in TODO.md): underwater isn't frequently used in WvW and
   *  normally shouldn't factor into boon/condition output. When off, every underwater editing
   *  surface (the Equipment tab's land/underwater weapon panel, the in-game skill bar's
   *  land/underwater toggle) stays hidden, and `Build.withUnderwaterSetting` forces `environment:
   *  'land'` wherever a build feeds the stats/boon-condition calculators — same effect as if
   *  nothing were equipped underwater, even for a build saved with `environment: 'underwater'`
   *  before the toggle was turned off. */
  showUnderwater: boolean
  /** Off by default, same reasoning as `showUnderwater`: racial skills (Human/Charr/Asura/Norn/
   *  Sylvari Heal/Utility/Elite skills) are never part of a competitive WvW build, just extra
   *  picker clutter for the overwhelming majority of users. When off, `isRacialSkill`-matching
   *  skills are dropped from the Heal/Utility/Elite picker's option list only — an already-chosen
   *  racial skill (from before the toggle was turned off) still renders normally in the bar/
   *  tooltip, same as `showUnderwater` never strips a saved build's data. */
  showRacialSkills: boolean
  /** Defaults to 'dark' (not 'system'), matching the app's behavior before this setting existed —
   *  see `resolveTheme`/`applyTheme` below for how this becomes the `<html data-theme>` attribute
   *  `global.css`'s `:root[data-theme='light']` override reads. */
  themeMode: ThemeMode
}

const DEFAULT_SETTINGS: AppSettings = {
  showUnderwater: false,
  showRacialSkills: false,
  themeMode: 'dark'
}

const STORAGE_KEY = 'gw2squaded.appSettings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** 'system' resolves via `prefers-color-scheme`; otherwise the mode itself is already resolved. */
function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = resolveTheme(mode)
}

// Applied synchronously at module load — this module is imported (via App.tsx) before
// ReactDOM ever renders, so this runs before the first paint and avoids a dark->light (or
// vice versa) flash for anyone whose saved/system theme isn't the CSS file's bare-`:root`
// default (dark).
applyTheme(loadSettings().themeMode)

interface AppSettingsValue extends AppSettings {
  setShowUnderwater: (value: boolean) => void
  setShowRacialSkills: (value: boolean) => void
  setThemeMode: (value: ThemeMode) => void
}

const AppSettingsContext = createContext<AppSettingsValue | null>(null)

/**
 * App-wide display preferences — deliberately plain `localStorage`, not `gw2Storage`'s IPC-backed
 * SQLite tables: these are per-install UI toggles, not build/squad data that needs to round-trip
 * through the Electron main process or ever get shared/exported. Wraps the whole app (outermost
 * provider in `App.tsx`) since both `SettingsView` and every build/squad-editor surface that reads
 * `showUnderwater` need it.
 */
export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  // Re-applies on every themeMode change, and — only while in 'system' mode — also reacts live to
  // the OS preference changing while the app is open (no restart needed).
  useEffect(() => {
    applyTheme(settings.themeMode)
    if (settings.themeMode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [settings.themeMode])

  const value: AppSettingsValue = {
    ...settings,
    setShowUnderwater: (showUnderwater) => setSettings((current) => ({ ...current, showUnderwater })),
    setShowRacialSkills: (showRacialSkills) => setSettings((current) => ({ ...current, showRacialSkills })),
    setThemeMode: (themeMode) => setSettings((current) => ({ ...current, themeMode }))
  }

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings(): AppSettingsValue {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettings must be used within an AppSettingsProvider')
  return ctx
}
