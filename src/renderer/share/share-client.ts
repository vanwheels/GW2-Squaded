import type { CreateShareResponse, GetShareResponse, ShareKind } from '@shared/share/types'

/** The one real deployment of `worker/` (deployed 2026-07-31 via `npx wrangler deploy` — see
 *  COMPLETED.md). Not a secret — it's a public HTTPS API with no auth — so it's fine to bake in as
 *  the default rather than requiring every build to carry a working `.env`. `VITE_SHARE_API_BASE_URL`
 *  (see `.env`/`.env.example`) overrides this, e.g. to point a dev build at a local `wrangler dev`
 *  instance instead. */
const DEFAULT_SHARE_API_BASE_URL = 'https://gw2-squaded-share.vanwheelstheman.workers.dev'

/**
 * Base URL of the `worker/` share backend. `fetch` runs directly in the renderer (no IPC
 * round-trip through main) since this is a plain public HTTPS API, not a local-resource access —
 * but note `index.html`'s CSP `connect-src` must also allow this origin.
 */
function apiBaseUrl(): string | null {
  const url = (import.meta.env.VITE_SHARE_API_BASE_URL as string | undefined) || DEFAULT_SHARE_API_BASE_URL
  return url && url.length > 0 ? url.replace(/\/$/, '') : null
}

export function isShareConfigured(): boolean {
  return apiBaseUrl() !== null
}

export async function createShare(kind: ShareKind, data: unknown): Promise<string> {
  const base = apiBaseUrl()
  if (!base) throw new Error('Sharing is not configured in this build (VITE_SHARE_API_BASE_URL is unset).')
  const res = await fetch(`${base}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, data })
  })
  if (!res.ok) throw new Error(`Failed to create share link (server returned ${res.status}).`)
  const body = (await res.json()) as CreateShareResponse
  return `${base}/shares/${body.id}`
}

export async function fetchShare(idOrUrl: string): Promise<GetShareResponse> {
  const base = apiBaseUrl()
  if (!base) throw new Error('Sharing is not configured in this build (VITE_SHARE_API_BASE_URL is unset).')
  const id = extractShareId(idOrUrl)
  if (!id) throw new Error('Enter a share link or id.')
  const res = await fetch(`${base}/shares/${encodeURIComponent(id)}`)
  if (res.status === 404) throw new Error('Share link not found — check it was copied correctly.')
  if (!res.ok) throw new Error(`Failed to load share link (server returned ${res.status}).`)
  return (await res.json()) as GetShareResponse
}

/** Accepts either a bare share id or a full share URL (`.../shares/<id>`) so users can paste
 *  either one into the import box. */
export function extractShareId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/([^/]+)\/?$/)
  return match ? match[1] : trimmed
}
