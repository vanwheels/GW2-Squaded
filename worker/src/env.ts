export interface Env {
  /** Anonymous share-link blob store (builds/squad comps) — see index.ts's own doc comments. */
  SHARES: KVNamespace
  /** Account/token/lockout state for the sync feature (see sync-types.ts) — the low-volume
   *  counterpart to the high-frequency per-account sync blob, which lives in SYNC_R2 instead. */
  SYNC_KV: KVNamespace
  /** Per-account sync blob (see sync-types.ts's SyncPayload) — one R2 object per account, merged
   *  and overwritten on every PUT /sync/:username. R2 has no free-tier write-count cap like KV's
   *  1,000/day, which matters here since every sync push/pull round trip writes this blob. */
  SYNC_R2: R2Bucket
  /** Discord bot board state (guild settings, permissions, builds/squads, pending approvals). */
  DB: D1Database
  /** Not secret — see wrangler.toml's own comment on why this lives in [vars]. */
  DISCORD_PUBLIC_KEY: string
  /** Not secret — see wrangler.toml's own comment. */
  DISCORD_APPLICATION_ID: string
  /** Secret — set via `wrangler secret put DISCORD_BOT_TOKEN` in production, `.dev.vars` locally. */
  DISCORD_BOT_TOKEN: string
  /** Cloudflare Browser Rendering — a headless Chromium instance `render/build-screenshot.ts`
   *  drives via `@cloudflare/puppeteer` to screenshot the web-preview render page for
   *  `/builddisplay`. Free at this project's scale (10 browser-min/day, no paid plan needed). */
  MYBROWSER: Fetcher
  /** Not secret — this worker's own public URL, e.g. `https://gw2-squaded-share.<subdomain>.
   *  workers.dev`. `render/build-screenshot.ts` navigates Browser Rendering here (it proxies to a
   *  real Cloudflare-hosted Chromium reaching the public internet, never `localhost`) to load the
   *  `/build-preview.html` page `[assets]` serves from this same deployable. Hardcoded per
   *  wrangler.toml's own comment, same reasoning as DISCORD_PUBLIC_KEY/DISCORD_APPLICATION_ID —
   *  this project targets one production deployment, not a multi-env config surface. */
  PUBLIC_ORIGIN: string
}
