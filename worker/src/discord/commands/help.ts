import { commands, OPT, type CatalogCommand, type CatalogOption } from '../command-catalog'
import type { DiscordMessagePayload } from '../api'
import type { CommandContext } from './context'

/** Same blue `render/board.ts`'s `BOARD_EMBED_COLOR` uses — kept as its own constant rather than a
 *  shared import, same as `approvals.ts`'s own card-color constants; this bot doesn't have a
 *  shared-palette module and one accent color repeated across a few files doesn't need one yet. */
const HELP_EMBED_COLOR = 0x3ea6ff

function findCommand(name: string): CatalogCommand {
  const cmd = commands.find((c) => c.name === name)
  if (!cmd) throw new Error(`command-catalog.ts is missing "${name}" — help.ts's category lists have drifted from it`)
  return cmd
}

function formatOption(opt: CatalogOption): string {
  return opt.required ? `<${opt.name}>` : `[${opt.name}]`
}

/** One usage line per invokable form of a command, derived mechanically from its
 *  `command-catalog.ts` entry so `/help`'s text can't drift from what's actually registered.
 *  More than one line only for `/buildboardconfig`, whose four subcommands (`OPT.SUB_COMMAND`
 *  options) each need their own usage + description rather than one line covering all four. */
function usageLines(cmd: CatalogCommand): { usage: string; description: string }[] {
  const subcommands = (cmd.options ?? []).filter((o) => o.type === OPT.SUB_COMMAND)
  if (subcommands.length > 0) {
    return subcommands.map((sub) => {
      const args = (sub.options ?? []).map(formatOption).join(' ')
      return { usage: `/${cmd.name} ${sub.name}${args ? ` ${args}` : ''}`, description: sub.description }
    })
  }
  const args = (cmd.options ?? []).map(formatOption).join(' ')
  return [{ usage: `/${cmd.name}${args ? ` ${args}` : ''}`, description: cmd.description }]
}

function section(title: string, commandNames: string[]): string {
  const lines = commandNames.flatMap((name) => usageLines(findCommand(name)))
  const body = lines.map(({ usage, description }) => `\`${usage}\` — ${description}`).join('\n')
  return `**${title}**\n${body}`
}

/** `/help` — lists every command this bot supports, grouped the same way `docs/discord-bot.md`
 *  groups them, with a one-line usage + description each. No board read/write, so no permission
 *  gate, same as `/ping`. Every slash command's response is ephemeral by default
 *  (`interactions.ts`'s `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` ack always sets `EPHEMERAL`), so
 *  this doesn't spam the channel either. */
export async function help(_ctx: CommandContext): Promise<DiscordMessagePayload> {
  const sections = [
    section('Builds', ['buildadd', 'buildedit', 'buildmove', 'buildremove', 'builddisplay']),
    section('Squads', ['squadadd', 'squadedit', 'squadremove', 'squaddisplay']),
    section('Board setup (admin — Manage Server)', ['buildboardsetup', 'buildboardrebuild', 'squadboardsetup', 'squadboardrebuild']),
    section('Board permissions & approvals (admin — Manage Server)', ['buildboardconfig'])
  ]

  const description = [
    '`<required>` = required, `[optional]` = optional. `name` fields autocomplete against existing board entries as you type.',
    ...sections,
    '**Also**\n' +
      'Every board section has its own "Preview a build…"/"Preview a squad…" dropdown for a quick screenshot — no command needed. ' +
      'In Manual approval mode (`/buildboardconfig approvalmode`), a change posts as a card with Preview/Approve/Reject buttons instead of applying immediately.'
  ].join('\n\n')

  return {
    embeds: [{ title: 'GW2-Squaded bot — commands', description, color: HELP_EMBED_COLOR }]
  }
}
