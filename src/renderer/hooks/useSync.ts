/**
 * useSync Hook — Cross-Device Sync Orchestration
 * Automatic background sync against the Worker's per-record merge endpoint
 * (`worker/src/index.ts`, `services/syncApi.ts`) — a single `syncNow()` both pushes this device's
 * local state and applies back whatever the Worker's merge decided is authoritative, so there's no
 * separate push/pull or manual conflict resolution to get wrong. Ported from ChoiceBuds'
 * `src/renderer/hooks/useSync.ts` (same account/token scheme, same trigger shape), trimmed to this
 * app's two collections (`builds`/`squadComps`, no `playerProfile`-equivalent) and its
 * store-replaces-tombstones-wholesale `applySyncedState` signature instead of ChoiceBuds' bare
 * record-array one.
 *
 * Mount this once, high enough in the provider tree to see `BuildsStoreProvider`/
 * `SquadCompsStoreProvider`/`AppSettingsProvider` (see `App.tsx`/`AppWeb.tsx`'s `SyncController`),
 * so the triggers below run from launch regardless of whether the user ever opens Settings.
 *
 * Accounts are real username/password (see `worker/src/index.ts`) — this device authenticates with
 * an opaque bearer token issued at signup/login, never the password itself.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Build, SquadComp } from '@shared/types'
import type { SyncTombstone } from '@shared/storage/storage-interface'
import { signup, login, pushSyncData, isSyncConfigured, type SyncPayload } from '../services/syncApi'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{2,32}$/
const MIN_PASSWORD_LENGTH = 8

// How long to wait after the last local mutation before syncing, so a burst of edits (e.g.
// reordering a whole list) collapses into one sync instead of one per keystroke/drag step.
const AUTO_SYNC_DEBOUNCE_MS = 5_000
// Fallback poll so a device that isn't actively editing still picks up another device's changes.
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000

export type SyncStatus = 'signed-out' | 'idle' | 'syncing' | 'error'
export type SyncResult = { ok: true } | { ok: false; message: string }

/** The slice of `builds-store.tsx`'s `BuildsStore` this hook needs — accepted structurally so a
 *  test can pass a bare mock instead of a real provider-backed store. */
export interface SyncableBuildsStore {
  builds: Build[]
  applySyncedState: (builds: Build[], tombstones: SyncTombstone[]) => Promise<void>
}

/** The slice of `squad-comps-store.tsx`'s `SquadCompsStore` this hook needs. */
export interface SyncableSquadCompsStore {
  squadComps: SquadComp[]
  applySyncedState: (squadComps: SquadComp[], tombstones: SyncTombstone[]) => Promise<void>
}

/** The slice of `app-settings-store.tsx`'s `AppSettingsValue` this hook needs. */
export interface SyncCredentialsSettings {
  syncUsername: string | null
  syncToken: string | null
  lastSyncedAt: string | null
  setSyncCredentials: (patch: { syncUsername: string | null; syncToken: string | null; lastSyncedAt: string | null }) => void
}

/** Repository methods this hook calls directly (bypassing the stores) to read tombstones not yet
 *  acknowledged by a sync push — `builds-store.tsx`/`squad-comps-store.tsx` don't keep these in
 *  React state since nothing else in the app needs them. */
export interface SyncableStorageAdapter {
  builds: { listTombstones: () => Promise<SyncTombstone[]> }
  squadComps: { listTombstones: () => Promise<SyncTombstone[]> }
}

export interface UseSyncReturn {
  /** Whether this build was compiled with a sync Worker configured at all (`VITE_SHARE_API_BASE_URL`)
   *  — Sign-In UI should hide itself entirely when this is false rather than offer a form that can
   *  only ever fail. */
  configured: boolean
  syncUsername: string | null
  lastSyncedAt: string | null
  status: SyncStatus
  error: string | null
  signUp: (username: string, password: string) => Promise<SyncResult>
  logIn: (username: string, password: string) => Promise<SyncResult>
  logOut: () => Promise<void>
  /** Pushes local state and applies back the Worker's merged result — safe to call anytime, and
   *  safe to call concurrently (shares one in-flight run). */
  syncNow: () => Promise<SyncResult>
}

export function useSync(
  buildsStore: SyncableBuildsStore,
  squadCompsStore: SyncableSquadCompsStore,
  settings: SyncCredentialsSettings,
  storage: SyncableStorageAdapter
): UseSyncReturn {
  const { syncUsername, syncToken, lastSyncedAt, setSyncCredentials } = settings

  const [internalStatus, setStatus] = useState<SyncStatus>(() => (syncUsername ? 'idle' : 'signed-out'))
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<Promise<SyncResult> | null>(null)
  // Set right before applySyncedState below writes the Worker's merged result back into the
  // builds/squadComps stores. That write changes `builds`/`squadComps` the same way a real local
  // edit would, which would otherwise re-trigger the debounced-mutation effect below and push right
  // back to the Worker — an infinite ~5s sync loop with no actual local changes involved. Consumed
  // (and cleared) by that effect so only the one render caused by this sync is skipped, not genuine
  // edits after.
  const skipNextMutationSyncRef = useRef(false)

  // Derived rather than effect-driven: being signed out always overrides whatever syncNow last set
  // (e.g. a stale 'error' from before logOut), and there's no external system to synchronize here
  // that an effect would be needed for.
  const status: SyncStatus = !syncUsername || !syncToken ? 'signed-out' : internalStatus

  const signUp = useCallback(
    async (username: string, password: string): Promise<SyncResult> => {
      const trimmedUsername = username.trim()
      if (!USERNAME_PATTERN.test(trimmedUsername)) {
        return { ok: false, message: 'Username must be 2-32 letters, numbers, or underscores' }
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return { ok: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
      }

      let token: string
      try {
        ;({ token } = await signup(trimmedUsername, password))
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Sign up failed' }
      }

      setSyncCredentials({ syncUsername: trimmedUsername, syncToken: token, lastSyncedAt: null })
      return { ok: true }
    },
    [setSyncCredentials]
  )

  const logIn = useCallback(
    async (username: string, password: string): Promise<SyncResult> => {
      const trimmedUsername = username.trim()
      if (!trimmedUsername || !password) {
        return { ok: false, message: 'Username and password are required' }
      }

      let token: string
      try {
        ;({ token } = await login(trimmedUsername, password))
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Log in failed' }
      }

      setSyncCredentials({ syncUsername: trimmedUsername, syncToken: token, lastSyncedAt: null })
      return { ok: true }
    },
    [setSyncCredentials]
  )

  const logOut = useCallback(async (): Promise<void> => {
    // Client-side only: this device's token simply stops being used locally. Other signed-in
    // devices are unaffected, and there's no server-side revoke endpoint in this leg.
    setSyncCredentials({ syncUsername: null, syncToken: null, lastSyncedAt: null })
    setStatus('signed-out')
    setError(null)
  }, [setSyncCredentials])

  const syncNow = useCallback((): Promise<SyncResult> => {
    if (!syncUsername || !syncToken) {
      return Promise.resolve({ ok: false, message: 'Not signed in to sync yet' })
    }
    if (inFlightRef.current) {
      return inFlightRef.current
    }

    const run = (async (): Promise<SyncResult> => {
      setStatus('syncing')
      setError(null)

      try {
        const [buildTombstones, squadCompTombstones] = await Promise.all([
          storage.builds.listTombstones(),
          storage.squadComps.listTombstones()
        ])
        const payload: SyncPayload = {
          builds: buildsStore.builds,
          buildTombstones,
          squadComps: squadCompsStore.squadComps,
          squadCompTombstones,
          savedAt: new Date().toISOString()
        }

        const merged = await pushSyncData(syncUsername, syncToken, payload)

        skipNextMutationSyncRef.current = true
        await Promise.all([
          buildsStore.applySyncedState(merged.builds, merged.buildTombstones),
          squadCompsStore.applySyncedState(merged.squadComps, merged.squadCompTombstones)
        ])

        setSyncCredentials({ syncUsername, syncToken, lastSyncedAt: merged.savedAt })
        setStatus('idle')
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed'
        setError(message)
        setStatus('error')
        return { ok: false, message }
      } finally {
        inFlightRef.current = null
      }
    })()

    inFlightRef.current = run
    return run
    // Depends on the whole buildsStore/squadCompsStore objects (recreated every render of their
    // owning providers) rather than individual fields, so this recreates on every render — fine,
    // since every trigger effect below reads it through syncNowRef instead of depending on it
    // directly.
  }, [syncUsername, syncToken, setSyncCredentials, buildsStore, squadCompsStore, storage])

  // Always-current ref so the trigger effects below (keyed only on syncUsername/syncToken, not on
  // syncNow's own frequently-churning dependency list) never call a stale closure.
  const syncNowRef = useRef(syncNow)
  useEffect(() => {
    syncNowRef.current = syncNow
  }, [syncNow])

  // Immediate sync on sign-in/mount, and on reconnect.
  useEffect(() => {
    if (!syncUsername || !syncToken) return
    syncNowRef.current()

    const handleOnline = () => {
      syncNowRef.current()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncUsername, syncToken])

  // Fallback poll — picks up another device's changes even when this one isn't actively editing.
  useEffect(() => {
    if (!syncUsername || !syncToken) return
    const intervalId = setInterval(() => {
      syncNowRef.current()
    }, AUTO_SYNC_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [syncUsername, syncToken])

  // Debounced on local mutation — deliberately depends on the raw builds/squadComps array
  // references (stable unless a real mutation happened) rather than the wrapped store objects, so
  // the timer only resets on an actual change, not on every render of this hook.
  useEffect(() => {
    if (!syncUsername || !syncToken) return
    if (skipNextMutationSyncRef.current) {
      skipNextMutationSyncRef.current = false
      return
    }
    const timeoutId = setTimeout(() => {
      syncNowRef.current()
    }, AUTO_SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timeoutId)
  }, [syncUsername, syncToken, buildsStore.builds, squadCompsStore.squadComps])

  return {
    configured: isSyncConfigured(),
    syncUsername,
    lastSyncedAt,
    status,
    error,
    signUp,
    logIn,
    logOut,
    syncNow
  }
}
