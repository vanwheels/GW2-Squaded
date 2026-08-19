import { getBuildByName } from '../../db'
import { renderBuildScreenshot } from '../../render/build-screenshot'
import { extractShareId, resolveShare } from '../../share-resolve'
import { asLikelyBuildFields } from '../../share-validate'
import type { DiscordMessagePayload } from '../api'
import type { CommandContext } from './context'
import { UserError } from '../errors'
import { stringOption } from '../interaction-types'

/** `/builddisplay [name?] [link?]` — exactly one of the two must be given: `name` looks up an
 *  existing board entry by its stored `share_id`, `link` renders an ad-hoc preview of *any* share
 *  link, including one never added to the board at all. Same render path either way (see
 *  docs/discord-bot.md's "Display" section) — this is why the branch below only decides which
 *  `share_id` to resolve, then hands off to the same `renderBuildScreenshot` call regardless. No
 *  board write, so no permission gate — same reasoning as autocomplete having none: this command
 *  only ever reads.
 *
 *  Unlike every other command in this bot, the result isn't a text `content`/`embeds` payload —
 *  it's a screenshot PNG attached via `DiscordMessagePayload.file` (see `api.ts`'s doc comment on
 *  that field for why the multipart branch lives there instead of here). */
export async function buildDisplay(ctx: CommandContext): Promise<DiscordMessagePayload> {
  const name = stringOption(ctx.options, 'name')?.trim()
  const link = stringOption(ctx.options, 'link')?.trim()
  if (!name && !link) throw new UserError('Provide a build name or a link.')
  if (name && link) throw new UserError('Provide only one of name or link, not both.')

  let shareId: string
  if (name) {
    const build = await getBuildByName(ctx.env, ctx.guildId, name)
    if (!build) throw new UserError(`No build named "${name}" found.`)
    shareId = build.share_id
  } else {
    const share = await resolveShare(ctx.env, link!)
    if (!share) throw new UserError("That link wasn't found — check it was copied correctly.")
    if (share.kind !== 'build') throw new UserError('That link is a squad link, not a build link.')
    if (!asLikelyBuildFields(share.data)) throw new UserError("That link doesn't look like a valid build.")
    shareId = extractShareId(link!)
  }

  const png = await renderBuildScreenshot(ctx.env, shareId)
  return { file: { filename: 'build.png', contentType: 'image/png', data: png } }
}
