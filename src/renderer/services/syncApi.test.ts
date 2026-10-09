import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, pullSyncData, pushSyncData, signup } from './syncApi'
import type { SyncPayload } from './syncApi'

const emptyPayload: SyncPayload = {
  builds: [],
  buildTombstones: [],
  squadComps: [],
  squadCompTombstones: [],
  savedAt: '2026-01-01T00:00:00.000Z'
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('syncApi', () => {
  it('signup posts credentials and returns the token', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, token: 'abc123' }, 201))

    const result = await signup('vanny', 'a-strong-password')

    expect(result.token).toBe('abc123')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/signup')
    expect(JSON.parse(init?.body as string)).toEqual({ username: 'vanny', password: 'a-strong-password' })
  })

  it('signup surfaces the server error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'username_taken' }, 409))

    await expect(signup('vanny', 'a-strong-password')).rejects.toThrow('username_taken')
  })

  it('login posts credentials and returns the token', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, token: 'xyz789' }))

    const result = await login('vanny', 'a-strong-password')

    expect(result.token).toBe('xyz789')
  })

  it('login surfaces a generic failure message when the server gives no error body', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))

    await expect(login('vanny', 'wrong-password')).rejects.toThrow('401')
  })

  it('pushSyncData PUTs the payload with a bearer token and returns the merged result', async () => {
    const merged: SyncPayload = { ...emptyPayload, savedAt: '2026-01-02T00:00:00.000Z' }
    vi.mocked(fetch).mockResolvedValue(jsonResponse(merged))

    const result = await pushSyncData('vanny', 'token-1', emptyPayload)

    expect(result).toEqual(merged)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/sync/vanny')
    expect(init?.method).toBe('PUT')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1')
    expect(JSON.parse(init?.body as string)).toEqual(emptyPayload)
  })

  it('pullSyncData returns null for a 404 (no data pushed yet)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))

    expect(await pullSyncData('vanny', 'token-1')).toBeNull()
  })

  it('pullSyncData returns the payload on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(emptyPayload))

    expect(await pullSyncData('vanny', 'token-1')).toEqual(emptyPayload)
  })
})
