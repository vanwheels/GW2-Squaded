/**
 * One-time setup (re-run whenever a new elite spec ships): uploads the 9 profession + 36
 * elite-specialization Tango icons — already curated and license-checked in
 * `data/game-data/tango-icons.json` (GFDL, reuse-permitted; see `scripts/fetch-tango-icons.ts`'s
 * own doc comment) — as Discord *application* emojis. Application emojis are bot-owned and usable
 * in every guild the bot is in, unlike a normal guild emoji, so this needs uploading exactly once
 * per icon rather than per-server. Writes the resulting name/id pairs to
 * `src/discord/emoji-map.json`, which `render/board.ts` reads to prefix each board list entry with
 * `<:Name:id>` — a build's elite spec if it has one, else its plain profession.
 *
 * Run with `npm run register-emojis` (loads DISCORD_BOT_TOKEN from .dev.vars, same as
 * register-commands.ts). Idempotent: lists this application's already-registered emojis first and
 * skips any name that's already there, so re-running after a balance patch adds a new elite spec
 * only uploads the new one(s).
 *
 * Deliberately reads `../../data/game-data/tango-icons.json`, crossing the worker/ boundary this
 * project's other worker code avoids (see `professions.ts`'s doc comment on why the *runtime*
 * duplicates that list instead of importing it) — this is one-time offline tooling, never bundled
 * into the deployed Worker, the same category as root's own `scripts/sync-web-preview-game-data.ts`
 * crossing the boundary in the other direction.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
if (!DISCORD_BOT_TOKEN) {
  console.error('DISCORD_BOT_TOKEN is not set — run via `npm run register-emojis` (reads .dev.vars).')
  process.exit(1)
}

/** Same derivation as register-commands.ts's own copy — see that file's doc comment. */
function applicationIdFromToken(token: string): string {
  const firstSegment = token.split('.')[0]
  return Buffer.from(firstSegment, 'base64').toString('utf8')
}

const applicationId = applicationIdFromToken(DISCORD_BOT_TOKEN)

const scriptDir = dirname(fileURLToPath(import.meta.url))
const iconsPath = join(scriptDir, '..', '..', 'data', 'game-data', 'tango-icons.json')
const outPath = join(scriptDir, '..', 'src', 'discord', 'emoji-map.json')

interface TangoIcons {
  professions: Record<string, string>
  specializations: Record<string, string>
}

interface EmojiRef {
  name: string
  id: string
}

/** "https://wiki.guildwars2.com/images/.../Guardian_tango_icon_48px.png" -> "Guardian". Discord
 *  application emoji names must be 2-32 word characters (`[A-Za-z0-9_]`); every name this produces
 *  is a single capitalized profession/elite-spec word, already within that rule. */
function emojiNameFromIconUrl(url: string): string {
  const file = url.split('/').pop() ?? ''
  const match = file.match(/^([A-Za-z0-9_]+)_tango_icon/)
  if (!match) throw new Error(`Can't derive an emoji name from icon filename: ${file}`)
  return match[1]
}

/** The wiki's image server 403s requests with no `User-Agent` (confirmed 2026-08-19) — same header
 *  `scripts/fetch-tango-icons.ts` already sends for its API calls, needed here too since this
 *  fetches the actual image files. */
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/png'
  return `data:${contentType};base64,${buf.toString('base64')}`
}

async function listExistingEmojis(): Promise<Map<string, string>> {
  const res = await fetch(`https://discord.com/api/v10/applications/${applicationId}/emojis`, {
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
  })
  if (!res.ok) throw new Error(`Failed to list existing application emojis: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { items: { id: string; name: string }[] }
  return new Map(body.items.map((e) => [e.name, e.id]))
}

async function createEmoji(name: string, image: string): Promise<string> {
  const res = await fetch(`https://discord.com/api/v10/applications/${applicationId}/emojis`, {
    method: 'POST',
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, image })
  })
  if (!res.ok) throw new Error(`Failed to create emoji "${name}": ${res.status} ${await res.text()}`)
  const created = (await res.json()) as { id: string }
  return created.id
}

async function main(): Promise<void> {
  const icons = JSON.parse(await readFile(iconsPath, 'utf8')) as TangoIcons
  const existingByName = await listExistingEmojis()

  async function ensureEmoji(url: string): Promise<EmojiRef> {
    const name = emojiNameFromIconUrl(url)
    const existingId = existingByName.get(name)
    if (existingId) {
      console.log(`  already registered :${name}:`)
      return { name, id: existingId }
    }
    const image = await fetchAsDataUri(url)
    const id = await createEmoji(name, image)
    console.log(`  uploaded :${name}:`)
    return { name, id }
  }

  const professions: Record<string, EmojiRef> = {}
  for (const [profession, url] of Object.entries(icons.professions)) {
    professions[profession] = await ensureEmoji(url)
  }

  const specializations: Record<string, EmojiRef> = {}
  for (const [specId, url] of Object.entries(icons.specializations)) {
    specializations[specId] = await ensureEmoji(url)
  }

  await writeFile(outPath, JSON.stringify({ professions, specializations }, null, 2) + '\n')
  console.log(`Wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
