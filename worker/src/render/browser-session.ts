import puppeteer, { type Browser } from '@cloudflare/puppeteer'
import type { Env } from '../env'

/**
 * Acquires a Browser Rendering session for `build-screenshot.ts`/`squad-screenshot.ts`, reusing a
 * warm one when a free one exists instead of always paying full headless-Chromium cold-start cost
 * — Cloudflare's own documented pattern for `@cloudflare/puppeteer`
 * (`puppeteer.sessions()`/`puppeteer.connect()`), swapped in 2026-08-19 for the "always
 * `puppeteer.launch()` fresh, no pooling" design both render functions had at v1 (see TODO.md's
 * Discord bot latency entry — this was diagnosed as the single biggest win of the two stacked
 * fixes logged there).
 *
 * Falls back to `puppeteer.launch()` whenever no free session is listed, or `connect()` to the one
 * picked fails (e.g. it closed/got evicted between the `sessions()` list and this call — a real
 * race under concurrent requests, not just a defensive check) — so a cold start remains the worst
 * case, never a hard failure. Callers must `browser.disconnect()` (not `.close()`) when done, so
 * the session survives — per `keep_alive` (60s default, unchanged) — for the next call to reuse;
 * `.close()` would tear it down immediately and defeat the whole point.
 */
export async function getBrowserSession(env: Env): Promise<Browser> {
  const sessionId = await pickFreeSessionId(env)
  if (sessionId) {
    try {
      return await puppeteer.connect(env.MYBROWSER, sessionId)
    } catch (err) {
      console.log(`[browser session] couldn't reuse session ${sessionId}, launching fresh instead: ${err}`)
    }
  }
  return await puppeteer.launch(env.MYBROWSER)
}

/** Active sessions with no worker currently attached (`connectionId` unset) are free to reuse.
 *  Picks randomly among them rather than always the first, matching Cloudflare's own docs example
 *  — under concurrent requests, always picking the first-listed free session would have them all
 *  race for the same one instead of spreading across whatever's actually free. */
async function pickFreeSessionId(env: Env): Promise<string | undefined> {
  const sessions = await puppeteer.sessions(env.MYBROWSER)
  const free = sessions.filter((session) => !session.connectionId).map((session) => session.sessionId)
  if (free.length === 0) return undefined
  return free[Math.floor(Math.random() * free.length)]
}
