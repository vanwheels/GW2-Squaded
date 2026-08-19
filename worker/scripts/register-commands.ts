/**
 * Registers this bot's slash commands with Discord's REST API, keeping the Developer Portal's
 * command list in sync with what `src/discord/interactions.ts` actually handles (per the
 * "command-registration script" called for in docs/discord-bot.md's Phase 1).
 *
 * Run with `npm run register-commands` (loads DISCORD_BOT_TOKEN from .dev.vars via Node's
 * --env-file). Uses global registration (applies to every guild the bot is in, can take up to an
 * hour to propagate) rather than guild-scoped — appropriate here since Phase 2+ commands are the
 * same for every server, per docs/discord-bot.md's design (no per-guild command variation).
 *
 * Phase 1 registers a single no-op `/ping` command — its only purpose is proving the full round
 * trip (Developer Portal → Discord → this worker's /interactions route → signature verification
 * → response) works before any real board logic exists. Real commands (/buildAdd, /squadAdd,
 * etc.) replace/extend this list in later phases.
 */

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
if (!DISCORD_BOT_TOKEN) {
  console.error('DISCORD_BOT_TOKEN is not set — run via `npm run register-commands` (reads .dev.vars).')
  process.exit(1)
}

/** Discord bot tokens' first `.`-separated segment is the bot user's id, base64-encoded — for a
 *  normal bot (the vast majority, including this one) that's the same value as the application id.
 *  Deriving it here means the (non-secret, but separately-sourced) application id in
 *  wrangler.toml doesn't also need to be duplicated into this script's own env. */
function applicationIdFromToken(token: string): string {
  const firstSegment = token.split('.')[0]
  return Buffer.from(firstSegment, 'base64').toString('utf8')
}

const applicationId = applicationIdFromToken(DISCORD_BOT_TOKEN)

const commands = [
  {
    name: 'ping',
    description: 'Phase 1 plumbing check — replies pong.',
    type: 1 // CHAT_INPUT
  }
]

const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: 'PUT', // PUT replaces the entire global command set with this list
  headers: {
    Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(commands)
})

if (!response.ok) {
  console.error(`Command registration failed: ${response.status} ${response.statusText}`)
  console.error(await response.text())
  process.exit(1)
}

const registered = (await response.json()) as { name: string; id: string }[]
console.log(`Registered ${registered.length} command(s):`)
for (const command of registered) {
  console.log(`  /${command.name} (id ${command.id})`)
}
