import { constantTimeEqual, generateToken, hashPassword, hashToken, isValidPassword, isValidUsername, verifyPassword, type PasswordHash } from './crypto'
import { handleInteraction } from './discord/interactions'
import type { Env } from './env'
import { CORS_HEADERS, json } from './http'
import { mergeCollection, type SyncTombstone } from './merge'
import { renderShareLandingPage, renderShareNotFoundPage } from './render/share-landing'
import { EMPTY_SYNC_PAYLOAD, type HasIdAndUpdatedAt, type SyncPayload } from './sync-types'

export type { Env }

/** Matches `src/shared/share/types.ts`'s `ShareKind` in the main app — duplicated here rather than
 *  shared via a package/path reference since this Worker is a separate deployable with its own
 *  dependency tree (no monorepo tooling set up), same "self-contained" approach as electron-builder
 *  packaging. Keep the two in sync by hand if a new kind is ever added. */
type ShareKind = 'build' | 'squadComp'

const SHARE_KINDS: ShareKind[] = ['build', 'squadComp']

/** Generous but bounded — this is an opaque JSON blob store with no schema validation of its own
 *  (the real Build/SquadComp shape is validated on import, client-side); this cap just guards
 *  against abuse/mistakes, not against legitimate builds/squads which are a few KB at most. */
const MAX_BODY_BYTES = 256 * 1024

interface StoredShare {
  kind: ShareKind
  data: unknown
  createdAt: string
}

function isShareKind(value: unknown): value is ShareKind {
  return typeof value === 'string' && (SHARE_KINDS as string[]).includes(value)
}

async function handleCreate(request: Request, env: Env): Promise<Response> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (typeof body !== 'object' || body === null) return json({ error: 'invalid_body' }, 400)
  const { kind, data } = body as Record<string, unknown>
  if (!isShareKind(kind)) return json({ error: 'invalid_kind' }, 400)
  if (typeof data !== 'object' || data === null) return json({ error: 'invalid_data' }, 400)

  const serialized = JSON.stringify(data)
  if (serialized.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  const id = crypto.randomUUID()
  const stored: StoredShare = { kind, data, createdAt: new Date().toISOString() }
  await env.SHARES.put(`share:${id}`, JSON.stringify(stored))

  return json({ id }, 201)
}

async function getStoredShare(id: string, env: Env): Promise<StoredShare | null> {
  const raw = await env.SHARES.get(`share:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as StoredShare
}

async function handleGet(id: string, env: Env): Promise<Response> {
  const stored = await getStoredShare(id, env)
  if (!stored) return json({ error: 'not_found' }, 404)
  return json(stored)
}

/** `GET /shares/:id/open` — the human-facing landing page a build/squad's board hyperlink points
 *  to (`render/board.ts`'s `shareLandingUrl`), as opposed to `GET /shares/:id` above which is the
 *  JSON API the desktop app's own import flow fetches. See `render/share-landing.ts`'s doc comment
 *  for why this is a separate page rather than content-negotiating the same route. A fresh nonce
 *  per request gates the page's one inline `<script>` (the Copy button) via CSP, rather than
 *  weakening the policy with a blanket `'unsafe-inline'`. */
async function handleShareLanding(id: string, env: Env): Promise<Response> {
  const nonce = crypto.randomUUID()
  const stored = await getStoredShare(id, env)
  const html = stored ? renderShareLandingPage(id, stored, env.PUBLIC_ORIGIN, nonce) : renderShareNotFoundPage(nonce)

  return new Response(html, {
    status: stored ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'`
    }
  })
}

/**
 * Account routes (`POST /signup`, `POST /login`) — real username + password accounts, ported from
 * ChoiceBuds' `handleSignup`/`handleLogin` (same key scheme, same limits). A device authenticates
 * with a server-issued opaque bearer token, not the password itself: signup/login return a random
 * token and the Worker stores only its hash, so a compromised device never hands over a password
 * the user might have reused elsewhere. Multiple devices stay signed in independently — login does
 * not invalidate another device's token. The sync routes (`PUT`/`GET /sync/:username`) that
 * consume this token are Leg 3.
 */

interface Account {
  username: string // display case
  passwordHash: string
  passwordSalt: string
  createdAt: string
}

interface TokenEntry {
  tokenHash: string
  createdAt: string
}

const MAX_TOKENS_PER_ACCOUNT = 10 // one per signed-in device; oldest evicted beyond this
const LOGIN_FAIL_LIMIT = 10
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60
const SIGNUP_THROTTLE_SECONDS = 60 // KV's expirationTtl floor is 60s

function accountKey(lowerUsername: string): string {
  return `account:${lowerUsername}`
}
function tokensKey(lowerUsername: string): string {
  return `tokens:${lowerUsername}`
}
function loginFailKey(lowerUsername: string): string {
  return `loginfail:${lowerUsername}`
}
function signupThrottleKey(ip: string): string {
  return `signupthrottle:${ip}`
}

async function getAccount(env: Env, lowerUsername: string): Promise<Account | null> {
  const raw = await env.SYNC_KV.get(accountKey(lowerUsername))
  return raw ? (JSON.parse(raw) as Account) : null
}

async function getTokens(env: Env, lowerUsername: string): Promise<TokenEntry[]> {
  const raw = await env.SYNC_KV.get(tokensKey(lowerUsername))
  return raw ? (JSON.parse(raw) as TokenEntry[]) : []
}

async function addToken(env: Env, lowerUsername: string, tokenHash: string): Promise<void> {
  const tokens = await getTokens(env, lowerUsername)
  tokens.push({ tokenHash, createdAt: new Date().toISOString() })
  while (tokens.length > MAX_TOKENS_PER_ACCOUNT) tokens.shift()
  await env.SYNC_KV.put(tokensKey(lowerUsername), JSON.stringify(tokens))
}

async function isLoginLocked(env: Env, lowerUsername: string): Promise<boolean> {
  const raw = await env.SYNC_KV.get(loginFailKey(lowerUsername))
  return raw !== null && Number(raw) >= LOGIN_FAIL_LIMIT
}

async function recordLoginFailure(env: Env, lowerUsername: string): Promise<void> {
  const raw = await env.SYNC_KV.get(loginFailKey(lowerUsername))
  const count = raw ? Number(raw) + 1 : 1
  await env.SYNC_KV.put(loginFailKey(lowerUsername), String(count), { expirationTtl: LOGIN_FAIL_WINDOW_SECONDS })
}

async function clearLoginFailures(env: Env, lowerUsername: string): Promise<void> {
  await env.SYNC_KV.delete(loginFailKey(lowerUsername))
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

async function handleSignup(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const throttled = await env.SYNC_KV.get(signupThrottleKey(ip))
  if (throttled !== null) return json({ error: 'signup_throttled' }, 429)

  const body = await readJsonBody<{ username?: unknown; password?: unknown }>(request)
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    return json({ error: 'invalid_body' }, 400)
  }
  if (!isValidUsername(body.username)) return json({ error: 'invalid_username' }, 400)
  if (!isValidPassword(body.password)) return json({ error: 'invalid_password' }, 400)

  const lowerUsername = body.username.toLowerCase()
  const existing = await getAccount(env, lowerUsername)
  if (existing) return json({ error: 'username_taken' }, 409)

  const { hash, salt } = await hashPassword(body.password)
  const account: Account = {
    username: body.username,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString()
  }
  await env.SYNC_KV.put(accountKey(lowerUsername), JSON.stringify(account))

  const token = generateToken()
  await addToken(env, lowerUsername, await hashToken(token))
  await env.SYNC_KV.put(signupThrottleKey(ip), '1', { expirationTtl: SIGNUP_THROTTLE_SECONDS })

  return json({ ok: true, token }, 201)
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody<{ username?: unknown; password?: unknown }>(request)
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    return json({ error: 'invalid_body' }, 400)
  }

  const lowerUsername = body.username.toLowerCase()
  if (await isLoginLocked(env, lowerUsername)) return json({ error: 'login_locked' }, 429)

  const account = await getAccount(env, lowerUsername)
  if (!account) {
    await recordLoginFailure(env, lowerUsername)
    return json({ error: 'invalid_credentials' }, 401)
  }

  const stored: PasswordHash = { hash: account.passwordHash, salt: account.passwordSalt }
  const valid = await verifyPassword(body.password, stored)
  if (!valid) {
    await recordLoginFailure(env, lowerUsername)
    return json({ error: 'invalid_credentials' }, 401)
  }

  await clearLoginFailures(env, lowerUsername)
  const token = generateToken()
  await addToken(env, lowerUsername, await hashToken(token))

  return json({ ok: true, token })
}

/**
 * Sync routes (`PUT|GET /sync/:username`) — ported from ChoiceBuds' `handleSyncGet`/
 * `handleSyncPut`. No legacy-KV-blob fallback (unlike ChoiceBuds): this is a new feature, not a
 * migration, so the per-account blob only ever lives in `env.SYNC_R2`. PUT doubles as pull — the
 * Worker merges the pushed payload against the stored one (last-write-wins by `updatedAt`, see
 * merge.ts) and hands back the merged result in the same response, so the pushing client
 * reconciles in one round trip instead of needing a separate GET.
 */

/** builds/squadComps JSON is small text even at real per-account scale — generous but bounded
 *  against abuse/mistakes, same reasoning as handleCreate's MAX_BODY_BYTES above. */
const MAX_SYNC_BODY_BYTES = 512 * 1024
/** Per-account throttle on PUT, not a real abuse defense — guards against a buggy client hammering
 *  the sync endpoint in a tight loop. */
const MIN_SYNC_WRITE_INTERVAL_MS = 3000

function syncKey(lowerUsername: string): string {
  return `sync:${lowerUsername}`
}

async function verifyBearerToken(env: Env, lowerUsername: string, request: Request): Promise<boolean> {
  const auth = request.headers.get('Authorization') ?? ''
  const match = auth.match(/^Bearer (.+)$/)
  if (!match) return false

  const presentedHash = await hashToken(match[1])
  const tokens = await getTokens(env, lowerUsername)
  return tokens.some(t => constantTimeEqual(t.tokenHash, presentedHash))
}

function isRecordArray(value: unknown): value is HasIdAndUpdatedAt[] {
  return Array.isArray(value) && value.every((v): v is HasIdAndUpdatedAt =>
    typeof v === 'object' && v !== null &&
    typeof (v as Record<string, unknown>).id === 'string' &&
    typeof (v as Record<string, unknown>).updatedAt === 'string'
  )
}

function isTombstoneArray(value: unknown): value is SyncTombstone[] {
  return Array.isArray(value) && value.every((v): v is SyncTombstone =>
    typeof v === 'object' && v !== null &&
    typeof (v as Record<string, unknown>).id === 'string' &&
    typeof (v as Record<string, unknown>).deletedAt === 'string'
  )
}

async function handleSyncGet(env: Env, lowerUsername: string, request: Request): Promise<Response> {
  if (!(await verifyBearerToken(env, lowerUsername, request))) return json({ error: 'invalid_token' }, 401)

  const r2Object = await env.SYNC_R2.get(syncKey(lowerUsername))
  if (r2Object === null) return json({ error: 'not_found' }, 404)

  return new Response(await r2Object.text(), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

async function handleSyncPut(request: Request, env: Env, lowerUsername: string): Promise<Response> {
  if (!(await verifyBearerToken(env, lowerUsername, request))) return json({ error: 'invalid_token' }, 401)

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_SYNC_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  const bodyText = await request.text()
  if (bodyText.length > MAX_SYNC_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  let parsed: Partial<SyncPayload>
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (
    !isRecordArray(parsed.builds) || !isTombstoneArray(parsed.buildTombstones) ||
    !isRecordArray(parsed.squadComps) || !isTombstoneArray(parsed.squadCompTombstones)
  ) {
    return json({ error: 'invalid_body' }, 400)
  }
  const incoming = parsed as SyncPayload

  const r2Key = syncKey(lowerUsername)
  const r2Object = await env.SYNC_R2.get(r2Key)

  // Throttle on the server's own record of when it last accepted a write for this account (R2
  // customMetadata, never sent by the client) — a client-supplied timestamp would let a client
  // bypass the throttle by lying.
  const receivedAt = Number(r2Object?.customMetadata?.receivedAt ?? '0')
  if (r2Object && Date.now() - receivedAt < MIN_SYNC_WRITE_INTERVAL_MS) {
    return json({ error: 'write_throttled' }, 429)
  }

  const existing: SyncPayload = r2Object ? JSON.parse(await r2Object.text()) : EMPTY_SYNC_PAYLOAD

  const buildsMerge = mergeCollection(existing.builds, existing.buildTombstones, incoming.builds, incoming.buildTombstones)
  const squadCompsMerge = mergeCollection(existing.squadComps, existing.squadCompTombstones, incoming.squadComps, incoming.squadCompTombstones)

  const merged: SyncPayload = {
    builds: buildsMerge.records,
    buildTombstones: buildsMerge.tombstones,
    squadComps: squadCompsMerge.records,
    squadCompTombstones: squadCompsMerge.tombstones,
    savedAt: new Date().toISOString()
  }

  const mergedText = JSON.stringify(merged)
  await env.SYNC_R2.put(r2Key, mergedText, {
    customMetadata: { receivedAt: String(Date.now()) },
    httpMetadata: { contentType: 'application/json' }
  })

  return new Response(mergedText, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/').filter(Boolean)

    if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'shares') {
      return handleCreate(request, env)
    }

    if (request.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'shares') {
      return handleGet(pathParts[1], env)
    }

    if (request.method === 'GET' && pathParts.length === 3 && pathParts[0] === 'shares' && pathParts[2] === 'open') {
      return handleShareLanding(pathParts[1], env)
    }

    if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'interactions') {
      return handleInteraction(request, env, ctx)
    }

    if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'signup') {
      return handleSignup(request, env)
    }

    if (request.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'login') {
      return handleLogin(request, env)
    }

    if (pathParts.length === 2 && pathParts[0] === 'sync') {
      const username = decodeURIComponent(pathParts[1])
      if (!isValidUsername(username)) return json({ error: 'invalid_username' }, 400)
      const lowerUsername = username.toLowerCase()

      if (request.method === 'GET') return handleSyncGet(env, lowerUsername, request)
      if (request.method === 'PUT') return handleSyncPut(request, env, lowerUsername)
      return json({ error: 'method_not_allowed' }, 405)
    }

    return json({ error: 'not_found' }, 404)
  }
}
