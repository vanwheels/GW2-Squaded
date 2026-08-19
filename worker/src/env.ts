export interface Env {
  /** Anonymous share-link blob store (builds/squad comps) — see index.ts's own doc comments. */
  SHARES: KVNamespace
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
