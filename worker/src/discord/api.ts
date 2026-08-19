const API_BASE = 'https://discord.com/api/v10'

/** Discord message payload shape this bot actually sends — a small subset of the full message
 *  object (https://discord.com/developers/docs/resources/message#message-object), just what
 *  `render/board.ts`'s board sections and command followups need. */
export interface DiscordMessagePayload {
  content?: string
  embeds?: DiscordEmbed[]
  /** Only `discord/approvals.ts`'s pending-approval cards set this (the Approve/Reject buttons).
   *  An explicit `[]` on the decided-card edit is what clears a card's buttons — Discord's message
   *  edit only touches fields present in the request body, so omitting `components` entirely would
   *  leave the old buttons in place. */
  components?: DiscordActionRow[]
  flags?: number
  /** Only `/builddisplay`'s followup sets this (`render/build-screenshot.ts`'s PNG) — never part
   *  of the JSON body itself. `editOriginalInteractionResponse` pulls it out and uploads it as a
   *  `multipart/form-data` part instead, switching request shape based on its presence. */
  file?: DiscordAttachment
}

/** Subset of Discord's message component object shapes this bot actually sends — action rows
 *  holding either the Approve/Reject/Preview buttons on a pending-approval card, or a "Preview a
 *  build…" string select menu on a board section message (`render/board.ts`'s
 *  `renderBuildSection`), per https://discord.com/developers/docs/interactions/message-components.
 *  Discord doesn't allow mixing buttons and a select menu in the same row, but this type doesn't
 *  enforce that — callers just don't do it. */
export interface DiscordButton {
  type: 2 // ComponentType.BUTTON
  style: number
  label: string
  custom_id: string
}

export interface DiscordSelectOption {
  label: string
  value: string
}

/** A string select (`ComponentType.STRING_SELECT`) — the "Preview a build…" dropdown per board
 *  section. Discord caps `options` at 25 entries and 100 characters per `label`/`value`; callers
 *  are responsible for staying under both (`render/board.ts` truncates/caps before building one of
 *  these). */
export interface DiscordStringSelectMenu {
  type: 3 // ComponentType.STRING_SELECT
  custom_id: string
  placeholder?: string
  options: DiscordSelectOption[]
}

export interface DiscordActionRow {
  type: 1 // ComponentType.ACTION_ROW
  components: (DiscordButton | DiscordStringSelectMenu)[]
}

export interface DiscordAttachment {
  filename: string
  contentType: string
  data: Uint8Array
}

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  footer?: { text: string }
}

export class DiscordApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Discord API error ${status}: ${body}`)
  }
}

async function discordFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) throw new DiscordApiError(res.status, await res.text())
  return res
}

/** Posts a new message to `channelId` using the bot token (not a webhook/interaction token) —
 *  used by `/buildBoardSetup`/`/buildBoardRebuild` and their squad equivalents to create the
 *  bot-owned board messages `board_messages` then tracks. */
export async function createChannelMessage(
  botToken: string,
  channelId: string,
  payload: DiscordMessagePayload
): Promise<{ id: string }> {
  const res = await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return res.json() as Promise<{ id: string }>
}

/** In-place edit of a bot-owned board message — how every mutating build/squad command keeps a
 *  board section in sync after writing to D1 (see docs/discord-bot.md's "Tracks which
 *  channel+message the bot owns" note on `board_messages`). */
export async function editChannelMessage(
  botToken: string,
  channelId: string,
  messageId: string,
  payload: DiscordMessagePayload
): Promise<void> {
  await discordFetch(`/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

/** Edits the deferred placeholder response for an in-flight interaction, via the
 *  webhooks/{application_id}/{interaction_token} route — this is how `dispatch.ts` delivers a
 *  command's real result after acking with a DEFERRED response (see that file's doc comment for
 *  why every mutating command defers: D1 + a board-message PATCH can exceed Discord's 3-second
 *  initial-response window). Uses the interaction token, not the bot token — no `Authorization`
 *  header needed, same as any interaction followup.
 *
 *  When `payload.file` is set (`/builddisplay` only, so far), this sends `multipart/form-data`
 *  instead of a bare JSON body — Discord's file-upload shape for this route: the JSON half goes in
 *  a `payload_json` part, the bytes in a `files[0]` part, and `payload_json.attachments` must list
 *  the new file by its `files[]` index or Discord silently drops it (this isn't optional the way
 *  it might look — Discord's edit-message attachment model treats a missing `attachments` entry as
 *  "remove this attachment", including ones being added in the same request). */
export async function editOriginalInteractionResponse(
  applicationId: string,
  interactionToken: string,
  payload: DiscordMessagePayload
): Promise<void> {
  const path = `/webhooks/${applicationId}/${interactionToken}/messages/@original`
  const { file, ...jsonPayload } = payload

  if (!file) {
    await discordFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonPayload)
    })
    return
  }

  const form = new FormData()
  form.append('payload_json', JSON.stringify({ ...jsonPayload, attachments: [{ id: 0 }] }))
  form.append('files[0]', new Blob([file.data], { type: file.contentType }), file.filename)
  await discordFetch(path, { method: 'PATCH', body: form })
}
