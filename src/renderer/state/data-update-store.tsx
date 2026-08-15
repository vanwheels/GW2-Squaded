import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DataUpdateStatus } from '@shared/game-data/data-update-provider'

interface DataUpdateValue {
  status: DataUpdateStatus
  checkForUpdate: () => void
  downloadUpdate: () => void
  restartAndApply: () => void
  /** The currently-loaded local game data's `GameDataMeta.gw2Build` (`null` until the first read
   *  resolves, or if the local `meta.json` predates that field) — the "is this build stale
   *  relative to the current patch" signal `Build.updatedAtGw2Build` gets compared against, see
   *  `BuildsView`'s card "last updated" line. Re-read on every status change, not just once, same
   *  reasoning as `SettingsView`'s own `localMeta` read: a completed download updates the on-disk
   *  copy immediately even though the loaded-in-memory game data stays the old copy until restart. */
  localGw2Build: number | null
}

const DataUpdateContext = createContext<DataUpdateValue | null>(null)

/**
 * Wraps `window.gw2DataUpdate`'s IPC status push in one context so both `NavBar` (a small
 * "update available" badge) and `SettingsView` (the full check/download panel, mirroring the
 * app-binary `UpdateControls`) share the exact same status rather than each subscribing
 * independently — matches `AppSettingsProvider`'s "mount once near the top of App.tsx" shape.
 */
export function DataUpdateStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DataUpdateStatus>({ state: 'idle' })
  const [localGw2Build, setLocalGw2Build] = useState<number | null>(null)

  useEffect(() => window.gw2DataUpdate.onStatus(setStatus), [])

  useEffect(() => {
    void window.gw2DataUpdate.getLocalMeta().then((meta) => setLocalGw2Build(meta.gw2Build))
  }, [status.state])

  const value: DataUpdateValue = {
    status,
    checkForUpdate: () => void window.gw2DataUpdate.checkForUpdate(),
    downloadUpdate: () => void window.gw2DataUpdate.downloadUpdate(),
    restartAndApply: () => void window.gw2DataUpdate.restartAndApply(),
    localGw2Build
  }

  return <DataUpdateContext.Provider value={value}>{children}</DataUpdateContext.Provider>
}

export function useDataUpdate(): DataUpdateValue {
  const ctx = useContext(DataUpdateContext)
  if (!ctx) throw new Error('useDataUpdate must be used within a DataUpdateProvider')
  return ctx
}
