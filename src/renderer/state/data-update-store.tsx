import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DataUpdateStatus } from '@shared/game-data/data-update-provider'

interface DataUpdateValue {
  status: DataUpdateStatus
  checkForUpdate: () => void
  downloadUpdate: () => void
  restartAndApply: () => void
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

  useEffect(() => window.gw2DataUpdate.onStatus(setStatus), [])

  const value: DataUpdateValue = {
    status,
    checkForUpdate: () => void window.gw2DataUpdate.checkForUpdate(),
    downloadUpdate: () => void window.gw2DataUpdate.downloadUpdate(),
    restartAndApply: () => void window.gw2DataUpdate.restartAndApply()
  }

  return <DataUpdateContext.Provider value={value}>{children}</DataUpdateContext.Provider>
}

export function useDataUpdate(): DataUpdateValue {
  const ctx = useContext(DataUpdateContext)
  if (!ctx) throw new Error('useDataUpdate must be used within a DataUpdateProvider')
  return ctx
}
