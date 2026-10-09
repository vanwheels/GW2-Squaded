import { createContext, useContext, type ReactNode } from 'react'
import { useSync, type UseSyncReturn } from '@renderer/hooks/useSync'
import { useBuildsStore } from './builds-store'
import { useSquadCompsStore } from './squad-comps-store'
import { useAppSettings } from './app-settings-store'

const SyncStoreContext = createContext<UseSyncReturn | null>(null)

/**
 * Owns the single `useSync` instance for the whole app (its mount/online/poll/debounce triggers
 * must only ever fire once — see `useSync.ts`'s own header comment) and exposes it via context so
 * `SettingsView`'s sign-in UI (TODO.md's Sign-In UI leg) can read/drive it without this provider
 * needing to know that UI exists yet. Must sit inside `BuildsStoreProvider`/`SquadCompsStoreProvider`/
 * `AppSettingsProvider` — see `App.tsx`/`AppWeb.tsx` for where it's mounted, and why the Electron
 * capture window is deliberately excluded.
 */
export function SyncStoreProvider({ children }: { children: ReactNode }) {
  const buildsStore = useBuildsStore()
  const squadCompsStore = useSquadCompsStore()
  const settings = useAppSettings()
  const sync = useSync(buildsStore, squadCompsStore, settings, window.gw2Storage)

  return <SyncStoreContext.Provider value={sync}>{children}</SyncStoreContext.Provider>
}

export function useSyncStore(): UseSyncReturn {
  const store = useContext(SyncStoreContext)
  if (!store) throw new Error('useSyncStore must be used within a SyncStoreProvider')
  return store
}
