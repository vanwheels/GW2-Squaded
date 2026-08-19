import type { Env } from './env'

/** Mirrors `src/renderer/share/share-client.ts`'s `extractShareId` — accepts either a bare share
 *  id or a full share URL (`.../shares/<id>`) so `/buildAdd`/`/squadAdd`/`/buildEdit`/`/squadEdit`
 *  accept whatever a user pastes from the desktop app's share panel. */
export function extractShareId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/([^/]+)\/?$/)
  return match ? match[1] : trimmed
}

interface StoredShare {
  kind: 'build' | 'squadComp'
  data: unknown
  createdAt: string
}

/** Reads a share directly off the `SHARES` KV binding this Worker already owns — per
 *  docs/discord-bot.md's "Architecture" section, this is why Phase 2's commands live in the same
 *  Worker as the share store rather than a sibling deployable: no network hop needed. Returns
 *  `null` for a missing/malformed id, same "not found" outcome either way. */
export async function resolveShare(env: Env, linkOrId: string): Promise<StoredShare | null> {
  const id = extractShareId(linkOrId)
  if (!id) return null
  const raw = await env.SHARES.get(`share:${id}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredShare
  } catch {
    return null
  }
}
