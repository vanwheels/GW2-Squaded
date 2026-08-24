import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ReleaseNotesModal } from '@renderer/components/common/ReleaseNotesModal'

const STORAGE_KEY = 'gw2squaded.lastSeenReleaseNotesVersion'

interface ReleaseNotesValue {
  openReleaseNotes: () => void
}

const ReleaseNotesContext = createContext<ReleaseNotesValue | null>(null)

/**
 * Owns the "What's New" modal (full CHANGELOG.md rendered in-app — see `ReleaseNotesModal`) and
 * the logic for popping it automatically the first time the app runs after an update: compares
 * the running app version (`window.gw2Updater.getAppVersion()`, unconditionally available even
 * outside the packaged Windows build — see `auto-updater.ts`) against the last version this
 * install has shown notes for, kept in plain `localStorage` (same per-install-preference
 * reasoning as `app-settings-store.tsx` — this isn't build/squad data). A brand-new install (no
 * stored value yet) just records the current version silently instead of popping the entire
 * history at someone on their very first launch. `SettingsView`'s "What's New" button reaches
 * this same modal instance via `openReleaseNotes()`.
 */
export function ReleaseNotesProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.gw2Updater.getAppVersion().then((version) => {
      if (cancelled || !version) return
      const lastSeen = localStorage.getItem(STORAGE_KEY)
      if (lastSeen !== null && lastSeen !== version) setOpen(true)
      localStorage.setItem(STORAGE_KEY, version)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const value: ReleaseNotesValue = {
    openReleaseNotes: () => setOpen(true)
  }

  return (
    <ReleaseNotesContext.Provider value={value}>
      {children}
      <ReleaseNotesModal open={open} onClose={() => setOpen(false)} />
    </ReleaseNotesContext.Provider>
  )
}

export function useReleaseNotes(): ReleaseNotesValue {
  const ctx = useContext(ReleaseNotesContext)
  if (!ctx) throw new Error('useReleaseNotes must be used within a ReleaseNotesProvider')
  return ctx
}
