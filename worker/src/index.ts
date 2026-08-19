import { handleInteraction } from './discord/interactions'
import type { Env } from './env'
import { CORS_HEADERS, json } from './http'
import { renderShareLandingPage, renderShareNotFoundPage } from './render/share-landing'

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

    return json({ error: 'not_found' }, 404)
  }
}
