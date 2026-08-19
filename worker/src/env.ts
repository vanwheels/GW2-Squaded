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
}
