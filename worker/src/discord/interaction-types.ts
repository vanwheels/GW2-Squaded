/** Subset of Discord's InteractionType enum this bot handles.
 *  https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type */
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4
} as const

/** Subset of Discord's InteractionResponseType enum. */
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  /** Acks a `MESSAGE_COMPONENT` interaction (a button click) without changing the message yet —
   *  the eventual `PATCH .../messages/@original` (`editOriginalInteractionResponse`) resolves to
   *  the message the button is attached to for this interaction type, same "defer now, deliver via
   *  @original later" shape `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` gives commands. Used by the
   *  Approve/Reject buttons (`discord/approvals.ts`) since deciding a request involves a D1 write
   *  that can exceed the 3-second window. */
  DEFERRED_UPDATE_MESSAGE: 6,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8
} as const

/** Subset of Discord's Message Component Types enum — just enough to build the Approve/Reject
 *  buttons `discord/approvals.ts` posts. */
export const ComponentType = { ACTION_ROW: 1, BUTTON: 2 } as const

/** Subset of Discord's Button Style enum. */
export const ButtonStyle = { SUCCESS: 3, DANGER: 4 } as const

/** Discord's "ephemeral" message flag — only the invoking user sees the reply. Every command
 *  followup in this bot is ephemeral: the *board message* is the public artifact a command
 *  mutates, the followup is just a private "it worked"/"here's why it didn't" receipt for the
 *  caller, same visibility split as a form submission's own confirmation toast. */
export const EPHEMERAL = 1 << 6

/** Subset of Discord's Application Command Option Type enum actually used by this bot's commands.
 *  https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type */
export const OptionType = {
  SUB_COMMAND: 1,
  STRING: 3,
  INTEGER: 4,
  CHANNEL: 7,
  ROLE: 8
} as const

export interface InteractionOption {
  name: string
  type: number
  value?: string | number | boolean
  options?: InteractionOption[]
  focused?: boolean
}

export interface InteractionMember {
  user: { id: string; username: string }
  roles: string[]
  /** Resolved total permission bitfield for the invoking user in the invoking channel, as a
   *  decimal string (too large for a JS number in general — compare via BigInt). Already accounts
   *  for role overrides, channel overrides, and guild ownership/Administrator, per Discord's own
   *  docs — this bot doesn't need to compute permissions itself. */
  permissions: string
}

export interface DiscordInteraction {
  type: number
  id: string
  application_id: string
  token: string
  guild_id?: string
  channel_id?: string
  member?: InteractionMember
  data?: {
    name: string
    options?: InteractionOption[]
    /** Only present on a `MESSAGE_COMPONENT` interaction — the `custom_id` of the button that was
     *  pressed (e.g. `approve:42`, built by `discord/approvals.ts`'s `decisionButtons`).
     *  `interactions.ts` parses this via that file's `parseDecisionCustomId`. */
    custom_id?: string
  }
}

const ADMINISTRATOR = 0x8n

/** Guild admins (or anyone Discord itself resolves as having the Administrator permission) always
 *  pass every `action_permissions` role gate this bot enforces — a safety valve so a
 *  misconfigured/never-configured role gate can't lock an admin out of their own board, and so
 *  Automatic-mode boards work immediately for the person who ran `/buildBoardSetup` even before
 *  `/buildBoardConfig setPermission` is ever touched. */
export function isAdministrator(member: InteractionMember): boolean {
  try {
    return (BigInt(member.permissions) & ADMINISTRATOR) !== 0n
  } catch {
    return false
  }
}

/** Finds a top-level option by name. For a command with a subcommand (e.g. `/buildBoardConfig
 *  setPermission`), pass `interaction.data.options[0].options` instead of the top-level list. */
export function findOption(options: InteractionOption[] | undefined, name: string): InteractionOption | undefined {
  return options?.find((o) => o.name === name)
}

export function stringOption(options: InteractionOption[] | undefined, name: string): string | undefined {
  const value = findOption(options, name)?.value
  return typeof value === 'string' ? value : undefined
}

export function integerOption(options: InteractionOption[] | undefined, name: string): number | undefined {
  const value = findOption(options, name)?.value
  return typeof value === 'number' ? value : undefined
}

/** The single subcommand of a command that has one (e.g. `/buildBoardConfig setPermission`) —
 *  `null` if this command has no subcommand layer at all. */
export function subcommand(options: InteractionOption[] | undefined): InteractionOption | null {
  const first = options?.[0]
  return first && first.type === OptionType.SUB_COMMAND ? first : null
}
