import { PROFESSIONS } from '../professions'

/**
 * Single source of truth for this bot's slash command set — the Discord-API-shaped `commands`
 * array both `scripts/register-commands.ts` (PUTs it to Discord's REST API) and
 * `discord/commands/help.ts` (renders it as human-readable usage text for `/help`) consume.
 * Previously this array lived inline in `register-commands.ts` only; splitting it out here means
 * `/help` can't drift from what's actually registered — one struct feeds both the registration
 * PUT and the in-Discord help text, rather than the two slowly diverging as commands are added.
 *
 * Discord requires CHAT_INPUT command names to be all-lowercase, so these don't match
 * `docs/discord-bot.md`'s camelCase names verbatim (`/buildAdd` there is `buildadd` here);
 * `dispatch.ts`'s `COMMANDS` map uses these same lowercase names.
 */

// Application Command Option Types (subset used below).
// https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
export const OPT = { SUB_COMMAND: 1, STRING: 3, INTEGER: 4, CHANNEL: 7, ROLE: 8 } as const
const GUILD_TEXT_CHANNEL = 0

/** Restricts a board-admin command to members Discord itself resolves as having Manage Server
 *  (0x20) by default — server admins can still widen/narrow this per-command in Discord's own
 *  Integrations settings UI, per docs/discord-bot.md's "presumably gated to server admins by
 *  Discord's own native per-command permission UI, not by action_permissions" note. */
const MANAGE_GUILD_DEFAULT = '32'

const professionChoices = PROFESSIONS.map((p) => ({ name: p, value: p }))
const boardTypeChoices = [
  { name: 'Build board', value: 'build' },
  { name: 'Squad board', value: 'squad' }
]
const actionChoices = [
  { name: 'Add', value: 'add' },
  { name: 'Edit', value: 'edit' },
  { name: 'Remove', value: 'remove' },
  { name: 'Move', value: 'move' }
]
const approvalModeChoices = [
  { name: 'Automatic — changes apply immediately', value: 'automatic' },
  { name: 'Manual — changes need an approver', value: 'manual' }
]

const nameOption = (description: string, required = true) => ({
  name: 'name',
  description,
  type: OPT.STRING,
  required,
  autocomplete: true
})
const channelOption = (description: string) => ({
  name: 'channel',
  description,
  type: OPT.CHANNEL,
  channel_types: [GUILD_TEXT_CHANNEL],
  required: false
})

/** Registered Discord command option shape — a subset covering everything the array below
 *  actually uses. `type: OPT.SUB_COMMAND` entries nest their own `options`, which is what
 *  `help.ts`'s usage-line formatter walks for `/buildboardconfig`'s four subcommands. */
export interface CatalogOption {
  name: string
  description: string
  type: number
  required?: boolean
  min_value?: number
  choices?: { name: string; value: string }[]
  channel_types?: number[]
  autocomplete?: boolean
  options?: CatalogOption[]
}

export interface CatalogCommand {
  name: string
  description: string
  type: 1 // CHAT_INPUT
  default_member_permissions?: string
  options?: CatalogOption[]
}

export const commands: CatalogCommand[] = [
  {
    name: 'ping',
    description: 'Plumbing healthcheck — replies pong.',
    type: 1
  },
  {
    name: 'help',
    description: 'List every command this bot supports and how to use it.',
    type: 1
  },

  // --- Builds ---------------------------------------------------------------------------------
  {
    name: 'buildadd',
    description: 'Add a build to the board from a share link.',
    type: 1,
    options: [
      { name: 'link', description: 'A GW2-Squaded build share link or id.', type: OPT.STRING, required: true },
      { name: 'name', description: 'Name to list it under (defaults to the build’s own name).', type: OPT.STRING, required: false }
    ]
  },
  {
    name: 'buildremove',
    description: 'Remove a build from the board.',
    type: 1,
    options: [nameOption('The build to remove.')]
  },
  {
    name: 'buildedit',
    description: 'Rename a build and/or replace its share link.',
    type: 1,
    options: [
      nameOption('The build to edit.'),
      { name: 'newname', description: 'New name.', type: OPT.STRING, required: false },
      { name: 'newlink', description: 'New share link or id.', type: OPT.STRING, required: false }
    ]
  },
  {
    name: 'buildmove',
    description: 'Move a build to a new position within its profession section.',
    type: 1,
    options: [
      nameOption('The build to move.'),
      { name: 'position', description: '1 = top of the section.', type: OPT.INTEGER, required: true, min_value: 1 }
    ]
  },
  {
    name: 'builddisplay',
    description: 'Post an image preview of a build. Give a name or a link, not both.',
    type: 1,
    options: [
      nameOption('An existing board entry to preview.', false),
      { name: 'link', description: 'A build share link or id to preview (instead of a name).', type: OPT.STRING, required: false }
    ]
  },

  // --- Squads -----------------------------------------------------------------------------------
  {
    name: 'squadadd',
    description: 'Add a squad composition to the board from a share link.',
    type: 1,
    options: [
      { name: 'link', description: 'A GW2-Squaded squad share link or id.', type: OPT.STRING, required: true },
      { name: 'name', description: 'Name to list it under (defaults to the squad’s own name).', type: OPT.STRING, required: false }
    ]
  },
  {
    name: 'squadremove',
    description: 'Remove a squad composition from the board.',
    type: 1,
    options: [nameOption('The squad to remove.')]
  },
  {
    name: 'squadedit',
    description: 'Rename a squad composition and/or replace its share link.',
    type: 1,
    options: [
      nameOption('The squad to edit.'),
      { name: 'newname', description: 'New name.', type: OPT.STRING, required: false },
      { name: 'newlink', description: 'New share link or id.', type: OPT.STRING, required: false }
    ]
  },
  {
    name: 'squaddisplay',
    description: 'Post an image preview of a squad composition. Give a name or a link, not both.',
    type: 1,
    options: [
      nameOption('An existing board entry to preview.', false),
      { name: 'link', description: 'A squad share link or id to preview (instead of a name).', type: OPT.STRING, required: false }
    ]
  },

  // --- Board admin ------------------------------------------------------------------------------
  {
    name: 'buildboardsetup',
    description: 'One-time: post the 9 profession board sections into a channel.',
    type: 1,
    default_member_permissions: MANAGE_GUILD_DEFAULT,
    options: [channelOption('Channel to post into (defaults to this channel).')]
  },
  {
    name: 'buildboardrebuild',
    description: 'Recreate a profession section’s board message if it was deleted.',
    type: 1,
    default_member_permissions: MANAGE_GUILD_DEFAULT,
    options: [
      { name: 'profession', description: 'Which section to rebuild.', type: OPT.STRING, required: true, choices: professionChoices },
      channelOption('Channel to post into (defaults to the section’s previous channel).')
    ]
  },
  {
    name: 'squadboardsetup',
    description: 'One-time: post the squad board into a channel.',
    type: 1,
    default_member_permissions: MANAGE_GUILD_DEFAULT,
    options: [channelOption('Channel to post into (defaults to this channel).')]
  },
  {
    name: 'squadboardrebuild',
    description: 'Recreate the squad board message if it was deleted.',
    type: 1,
    default_member_permissions: MANAGE_GUILD_DEFAULT,
    options: [channelOption('Channel to post into (defaults to its previous channel).')]
  },
  {
    name: 'buildboardconfig',
    description: 'Configure board permissions and the approval workflow.',
    type: 1,
    default_member_permissions: MANAGE_GUILD_DEFAULT,
    options: [
      {
        name: 'setpermission',
        description: 'Require a role to add/edit/remove/move board entries.',
        type: OPT.SUB_COMMAND,
        options: [
          { name: 'boardtype', description: 'Which board.', type: OPT.STRING, required: true, choices: boardTypeChoices },
          { name: 'action', description: 'Which action to gate.', type: OPT.STRING, required: true, choices: actionChoices },
          { name: 'role', description: 'Role required to perform it.', type: OPT.ROLE, required: true }
        ]
      },
      {
        name: 'approvalmode',
        description: 'Switch between changes applying immediately and requiring approval.',
        type: OPT.SUB_COMMAND,
        options: [{ name: 'mode', description: 'Automatic or Manual.', type: OPT.STRING, required: true, choices: approvalModeChoices }]
      },
      {
        name: 'setapproverrole',
        description: 'Set the role that can approve/reject pending requests (Manual mode).',
        type: OPT.SUB_COMMAND,
        options: [{ name: 'role', description: 'Role allowed to approve/reject.', type: OPT.ROLE, required: true }]
      },
      {
        name: 'approvalschannel',
        description: 'Set the channel where pending-approval cards are posted (Manual mode).',
        type: OPT.SUB_COMMAND,
        options: [
          { name: 'channel', description: 'Channel for pending-approval cards.', type: OPT.CHANNEL, channel_types: [GUILD_TEXT_CHANNEL], required: true }
        ]
      }
    ]
  }
]
