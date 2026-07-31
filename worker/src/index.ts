export interface Env {
  SHARES: KVNamespace
}

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

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
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

async function handleGet(id: string, env: Env): Promise<Response> {
  const raw = await env.SHARES.get(`share:${id}`)
  if (!raw) return json({ error: 'not_found' }, 404)
  const stored = JSON.parse(raw) as StoredShare
  return json(stored)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    return json({ error: 'not_found' }, 404)
  }
}
