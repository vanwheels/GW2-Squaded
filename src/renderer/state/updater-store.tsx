import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { UpdateStatus } from '@shared/updater/updater-provider'

interface UpdaterValue {
  status: UpdateStatus
  version: string
  supported: boolean
  checkForUpdates: () => void
  downloadUpdate: () => void
  quitAndInstall: () => void
}

const UpdaterContext = createContext<UpdaterValue | null>(null)

/**
 * Wraps `window.gw2Updater`'s IPC status push in one context so both `NavBar` (a small "update
 * available" badge) and `SettingsView` (the full check/download panel) share the exact same
 * status rather than each subscribing independently — mirrors `DataUpdateStoreProvider`'s shape.
 */
export function UpdaterStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [version, setVersion] = useState('')
  const [supported, setSupported] = useState(false)

  useEffect(() => window.gw2Updater.onStatus(setStatus), [])

  useEffect(() => {
    void window.gw2Updater.getAppVersion().then(setVersion)
    void window.gw2Updater.isSupported().then(setSupported)
  }, [])

  const value: UpdaterValue = {
    status,
    version,
    supported,
    checkForUpdates: () => void window.gw2Updater.checkForUpdates(),
    downloadUpdate: () => void window.gw2Updater.downloadUpdate(),
    quitAndInstall: () => void window.gw2Updater.quitAndInstall()
  }

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>
}

export function useUpdater(): UpdaterValue {
  const ctx = useContext(UpdaterContext)
  if (!ctx) throw new Error('useUpdater must be used within an UpdaterStoreProvider')
  return ctx
}
