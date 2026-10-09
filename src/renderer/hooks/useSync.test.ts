// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import {
  useSync,
  type SyncableBuildsStore,
  type SyncableSquadCompsStore,
  type SyncCredentialsSettings,
  type SyncableStorageAdapter
} from './useSync'
import type { Build, SquadComp } from '@shared/types'
import type { SyncPayload } from '../services/syncApi'

vi.mock('../services/syncApi', () => ({
  signup: vi.fn(),
  login: vi.fn(),
  pushSyncData: vi.fn(),
  isSyncConfigured: vi.fn(() => true)
}))

import { signup, login, pushSyncData } from '../services/syncApi'

const mockedSignup = vi.mocked(signup)
const mockedLogin = vi.mocked(login)
const mockedPush = vi.mocked(pushSyncData)

function emptyMergedPayload(overrides: Partial<SyncPayload> = {}): SyncPayload {
  return {
    builds: [],
    buildTombstones: [],
    squadComps: [],
    squadCompTombstones: [],
    savedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function setup(settingsOverrides: Partial<Pick<SyncCredentialsSettings, 'syncUsername' | 'syncToken' | 'lastSyncedAt'>> = {}) {
  const setSyncCredentials = vi.fn()
  const settings: SyncCredentialsSettings = {
    syncUsername: null,
    syncToken: null,
    lastSyncedAt: null,
    setSyncCredentials,
    ...settingsOverrides
  }

  const buildsStore: SyncableBuildsStore = {
    builds: [{ id: 'build-1' } as Build],
    // Mirrors the real builds-store.tsx::applySyncedState, which unconditionally overwrites
    // `builds` with the server's (always-fresh-reference) result - that reference change is
    // exactly what the skip-next-mutation-sync mechanism under test exists to not mistake for a
    // local edit.
    applySyncedState: vi.fn(async (records: Build[]) => {
      buildsStore.builds = records
    })
  }

  const squadCompsStore: SyncableSquadCompsStore = {
    squadComps: [{ id: 'squad-1' } as SquadComp],
    applySyncedState: vi.fn(async (records: SquadComp[]) => {
      squadCompsStore.squadComps = records
    })
  }

  const storage: SyncableStorageAdapter = {
    builds: { listTombstones: vi.fn().mockResolvedValue([]) },
    squadComps: { listTombstones: vi.fn().mockResolvedValue([]) }
  }

  const { result, rerender } = renderHook(() => useSync(buildsStore, squadCompsStore, settings, storage))
  return { result, rerender, setSyncCredentials, buildsStore, squadCompsStore, storage }
}

describe('useSync', () => {
  beforeEach(() => {
    mockedSignup.mockReset()
    mockedLogin.mockReset()
    mockedPush.mockReset().mockResolvedValue(emptyMergedPayload())
  })

  // Not configured globally (unlike most hooks, useSync's effects register a global 'online'
  // listener and an interval, which would otherwise leak across tests and keep firing from every
  // previously-rendered (but never unmounted) hook instance in this file).
  afterEach(() => {
    cleanup()
  })

  describe('status', () => {
    it('is signed-out with no account signed in', () => {
      const { result } = setup()
      expect(result.current.status).toBe('signed-out')
    })

    it('auto-syncs on mount when already signed in, landing on idle', async () => {
      setup({ syncUsername: 'ethan', syncToken: 'tok' })
      await waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1))
    })
  })

  describe('signUp', () => {
    it('rejects a malformed username without touching the network', async () => {
      const { result } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.signUp('a', 'password123')
      })

      expect(outcome).toEqual({ ok: false, message: expect.stringContaining('2-32 letters') })
      expect(mockedSignup).not.toHaveBeenCalled()
    })

    it('rejects a too-short password without touching the network', async () => {
      const { result } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.signUp('ethan', 'short')
      })

      expect(outcome).toEqual({ ok: false, message: expect.stringContaining('at least 8 characters') })
      expect(mockedSignup).not.toHaveBeenCalled()
    })

    it('signs up and persists the returned token', async () => {
      mockedSignup.mockResolvedValue({ token: 'new-token' })
      const { result, setSyncCredentials } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.signUp('ethan', 'password123')
      })

      expect(outcome).toEqual({ ok: true })
      expect(mockedSignup).toHaveBeenCalledWith('ethan', 'password123')
      expect(setSyncCredentials).toHaveBeenCalledWith({ syncUsername: 'ethan', syncToken: 'new-token', lastSyncedAt: null })
    })

    it('surfaces the server error when signup fails (e.g. username taken)', async () => {
      mockedSignup.mockRejectedValueOnce(new Error('Username is already taken'))
      const { result, setSyncCredentials } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.signUp('ethan', 'password123')
      })

      expect(outcome).toEqual({ ok: false, message: 'Username is already taken' })
      expect(setSyncCredentials).not.toHaveBeenCalled()
    })
  })

  describe('logIn', () => {
    it('rejects an empty username or password without touching the network', async () => {
      const { result, setSyncCredentials } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.logIn('', '')
      })

      expect(outcome).toEqual({ ok: false, message: expect.stringContaining('required') })
      expect(mockedLogin).not.toHaveBeenCalled()
      expect(setSyncCredentials).not.toHaveBeenCalled()
    })

    it('trims the username and persists the returned token', async () => {
      mockedLogin.mockResolvedValue({ token: 'device-2-token' })
      const { result, setSyncCredentials } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.logIn('  ethan  ', 'password123')
      })

      expect(outcome).toEqual({ ok: true })
      expect(mockedLogin).toHaveBeenCalledWith('ethan', 'password123')
      expect(setSyncCredentials).toHaveBeenCalledWith({ syncUsername: 'ethan', syncToken: 'device-2-token', lastSyncedAt: null })
    })

    it('surfaces the server error when login fails', async () => {
      mockedLogin.mockRejectedValueOnce(new Error('Invalid username or password'))
      const { result, setSyncCredentials } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.logIn('ethan', 'wrong-password')
      })

      expect(outcome).toEqual({ ok: false, message: 'Invalid username or password' })
      expect(setSyncCredentials).not.toHaveBeenCalled()
    })
  })

  describe('logOut', () => {
    it('clears the account/token/timestamp and resets status to signed-out', async () => {
      const { result, setSyncCredentials } = setup({ syncUsername: 'ethan', syncToken: 'tok' })
      await waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1)) // let the mount-time auto-sync settle first

      await act(async () => {
        await result.current.logOut()
      })

      expect(setSyncCredentials).toHaveBeenLastCalledWith({ syncUsername: null, syncToken: null, lastSyncedAt: null })
      expect(result.current.status).toBe('signed-out')
    })
  })

  describe('syncNow', () => {
    it('errors immediately when not signed in', async () => {
      const { result } = setup()

      let outcome
      await act(async () => {
        outcome = await result.current.syncNow()
      })

      expect(outcome).toEqual({ ok: false, message: 'Not signed in to sync yet' })
      expect(mockedPush).not.toHaveBeenCalled()
    })

    it('pushes the current builds/squadComps + tombstone snapshot and applies the merged result back', async () => {
      const remoteBuild = { id: 'remote-build' } as Build
      const merged = emptyMergedPayload({ builds: [remoteBuild], savedAt: '2026-02-02T00:00:00.000Z' })
      mockedPush.mockResolvedValue(merged)

      const { result, setSyncCredentials, buildsStore, squadCompsStore, storage } = setup({
        syncUsername: 'ethan',
        syncToken: 'tok'
      })
      await waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1)) // mount-triggered auto-sync

      let outcome
      await act(async () => {
        outcome = await result.current.syncNow()
      })

      expect(outcome).toEqual({ ok: true })
      expect(storage.builds.listTombstones).toHaveBeenCalled()
      expect(storage.squadComps.listTombstones).toHaveBeenCalled()
      expect(mockedPush).toHaveBeenLastCalledWith('ethan', 'tok', {
        builds: buildsStore.builds,
        buildTombstones: [],
        squadComps: squadCompsStore.squadComps,
        squadCompTombstones: [],
        savedAt: expect.any(String)
      })
      expect(buildsStore.applySyncedState).toHaveBeenLastCalledWith([remoteBuild], [])
      expect(squadCompsStore.applySyncedState).toHaveBeenLastCalledWith([], [])
      expect(setSyncCredentials).toHaveBeenLastCalledWith({
        syncUsername: 'ethan',
        syncToken: 'tok',
        lastSyncedAt: '2026-02-02T00:00:00.000Z'
      })
    })

    it('sets the error state and status when the push itself fails', async () => {
      mockedPush.mockResolvedValueOnce(emptyMergedPayload()) // mount-triggered auto-sync succeeds first
      const { result } = setup({ syncUsername: 'ethan', syncToken: 'tok' })
      await waitFor(() => expect(result.current.status).toBe('idle'))

      mockedPush.mockRejectedValueOnce(new Error('sync exploded'))

      let outcome
      await act(async () => {
        outcome = await result.current.syncNow()
      })

      expect(outcome).toEqual({ ok: false, message: 'sync exploded' })
      expect(result.current.error).toBe('sync exploded')
      expect(result.current.status).toBe('error')
    })

    it('shares one in-flight run across concurrent callers instead of double-pushing', async () => {
      let resolvePush: (payload: SyncPayload) => void
      mockedPush.mockReturnValue(
        new Promise((resolve) => {
          resolvePush = resolve
        })
      )

      const { result } = setup({ syncUsername: 'ethan', syncToken: 'tok' })
      await waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1)) // the pending mount-triggered call

      let outcomeA: unknown
      let outcomeB: unknown
      const callPromise = act(async () => {
        const [a, b] = await Promise.all([result.current.syncNow(), result.current.syncNow()])
        outcomeA = a
        outcomeB = b
      })

      resolvePush!(emptyMergedPayload())
      await callPromise

      expect(mockedPush).toHaveBeenCalledTimes(1) // still just the mount-triggered call - both syncNow() calls shared it
      expect(outcomeA).toEqual({ ok: true })
      expect(outcomeB).toEqual({ ok: true })
    })
  })

  describe('auto-sync triggers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('syncs again after local data changes, once things settle (debounced)', async () => {
      const { rerender, buildsStore } = setup({ syncUsername: 'ethan', syncToken: 'tok' })
      await vi.waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1)) // mount-triggered
      // Reflects the mount-triggered sync's own applySyncedState write (see its mock above) and
      // lets it consume the skip-next-mutation-sync flag, so it's not mistaken later for the
      // genuine edit this test simulates.
      rerender()

      mockedPush.mockClear()
      buildsStore.builds = [{ id: 'a-new-build' } as Build] // simulate a mutation changing the array reference
      rerender()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000)
      })

      expect(mockedPush).toHaveBeenCalledTimes(1)
    })

    it('does not re-sync off its own applySyncedState write (regression: this used to ping-pong forever)', async () => {
      const remoteBuild = { id: 'remote-build' } as Build
      mockedPush.mockResolvedValue(emptyMergedPayload({ builds: [remoteBuild] }))

      const { rerender } = setup({ syncUsername: 'ethan', syncToken: 'tok' })
      await vi.waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1)) // mount-triggered
      // The mount sync's applySyncedState mock just overwrote buildsStore.builds with a fresh
      // reference (remoteBuild) - render so the debounce effect observes it.
      rerender()

      mockedPush.mockClear()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000)
      })

      // A real edit would have scheduled another push here; a reference change that came from
      // applying the sync's own result must not.
      expect(mockedPush).not.toHaveBeenCalled()
    })

    it('syncs again on an interval fallback', async () => {
      setup({ syncUsername: 'ethan', syncToken: 'tok' })
      await vi.waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1)) // mount-triggered

      mockedPush.mockClear()

      await act(async () => {
        // Also crosses the 5s mutation-debounce mark, which fires too (the mount-triggered
        // data-load itself counts as a "change") - that's accepted redundancy, not what this test
        // is isolating, so it asserts "at least once" rather than an exact count.
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      })

      expect(mockedPush).toHaveBeenCalled()
    })

    it('syncs again when the browser comes back online', async () => {
      const { result } = setup({ syncUsername: 'ethan', syncToken: 'tok' })
      // Wait for the mount-triggered sync to fully settle (not just for pushSyncData to have been
      // *called*) - otherwise the in-flight guard would make the 'online' trigger below share that
      // still-pending run instead of starting a new, separately-observable one.
      await vi.waitFor(() => expect(result.current.status).toBe('idle'))

      mockedPush.mockClear()

      await act(async () => {
        window.dispatchEvent(new Event('online'))
      })

      expect(mockedPush).toHaveBeenCalledTimes(1)
    })
  })
})
