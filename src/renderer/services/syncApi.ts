/**
 * syncApi.ts — Cross-Device Sync Worker Client
 * Talks to the same `worker/` deployment `../share/share-client.ts` already uses — real
 * username/password accounts, authenticated per device via a server-issued opaque bearer token
 * (see `worker/src/index.ts`'s account + sync route doc comments). Ported from ChoiceBuds'
 * `src/renderer/services/syncApi.ts` (same account/token scheme, same endpoints).
 *
 * Deliberately deviates from `share-client.ts`'s no-timeout convention with an AbortController:
 * this Worker is infrastructure the user runs themselves, so a lapsed/torn-down deployment is a
 * real possibility — a hung fetch here would otherwise freeze the Settings UI with no feedback.
 */

import type { Build, SquadComp } from '@shared/types'
import type { SyncTombstone } from '@shared/storage/storage-interface'
import { apiBaseUrl } from '../share/share-client'

const REQUEST_TIMEOUT_MS = 10_000

/**
 * Mirrors the Worker's own `SyncPayload` (`worker/src/sync-types.ts`) by hand — not imported
 * since the Worker is a separate deployable package, same reasoning as `storage-interface.ts`'s
 * `SyncTombstone`.
 */
export interface SyncPayload {
  builds: Build[]
  buildTombstones: SyncTombstone[]
  squadComps: SquadComp[]
  squadCompTombstones: SyncTombstone[]
  savedAt: string
}

interface TokenResponse {
  token: string
}

interface ErrorResponse {
  error?: string
}

function requireBaseUrl(): string {
  const base = apiBaseUrl()
  if (!base) throw new Error('Sync is not configured in this build (VITE_SHARE_API_BASE_URL is unset).')
  return base
}

export function isSyncConfigured(): boolean {
  return apiBaseUrl() !== null
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Sync server took too long to respond — check your connection and try again', { cause: err })
    }
    throw new Error('Could not reach the sync server — check your connection and try again', { cause: err })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as ErrorResponse | null
  return body?.error || fallback
}

export async function signup(username: string, password: string): Promise<{ token: string }> {
  const base = requireBaseUrl()
  const response = await fetchWithTimeout(`${base}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Sign up failed (${response.status})`))
  }

  return (await response.json()) as TokenResponse
}

export async function login(username: string, password: string): Promise<{ token: string }> {
  const base = requireBaseUrl()
  const response = await fetchWithTimeout(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Log in failed (${response.status})`))
  }

  return (await response.json()) as TokenResponse
}

/**
 * PUTs this device's local state and returns the Worker's merged result (`worker/src/index.ts`'s
 * `handleSyncPut`) — the Worker merges per-record instead of overwriting, so this doubles as a
 * pull: the response is the full authoritative post-merge `SyncPayload`, not just an
 * acknowledgement.
 */
export async function pushSyncData(username: string, token: string, payload: SyncPayload): Promise<SyncPayload> {
  const base = requireBaseUrl()
  const response = await fetchWithTimeout(`${base}/sync/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Sync failed (${response.status})`))
  }

  return (await response.json()) as SyncPayload
}

/** Returns null if no data has ever been pushed under this account. */
export async function pullSyncData(username: string, token: string): Promise<SyncPayload | null> {
  const base = requireBaseUrl()
  const response = await fetchWithTimeout(`${base}/sync/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (response.status === 404) return null

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Pull failed (${response.status})`))
  }

  return (await response.json()) as SyncPayload
}
