import { searchBuildNames, searchSquadNames } from '../db'
import type { Env } from '../env'
import type { InteractionOption } from './interaction-types'

/** Commands whose `name` argument refers to an *existing* build/squad on the board (as opposed to
 *  `buildadd`/`squadadd`'s `name`, which names a brand-new entry and has nothing to autocomplete
 *  against) — see docs/discord-bot.md's "autocomplete on every [Build Name] argument" note. */
const BUILD_NAME_COMMANDS = new Set(['buildremove', 'buildedit', 'buildmove', 'builddisplay'])
const SQUAD_NAME_COMMANDS = new Set(['squadremove', 'squadedit', 'squaddisplay'])

export interface AutocompleteChoice {
  name: string
  value: string
}

/** Answers an `APPLICATION_COMMAND_AUTOCOMPLETE` interaction — unlike a real command, this must
 *  respond synchronously within Discord's 3-second window (there's no deferred variant for
 *  autocomplete), which a single indexed `LIKE` query against D1 comfortably fits. Returns no
 *  choices for a DM invocation (`guildId` absent) or a command/option this bot doesn't autocomplete. */
export async function autocompleteChoices(
  env: Env,
  guildId: string | undefined,
  commandName: string,
  options: InteractionOption[] | undefined
): Promise<AutocompleteChoice[]> {
  if (!guildId) return []

  const focused = options?.find((o) => o.focused)
  if (!focused || focused.name !== 'name') return []
  const query = typeof focused.value === 'string' ? focused.value : ''

  let names: string[]
  if (BUILD_NAME_COMMANDS.has(commandName)) {
    names = await searchBuildNames(env, guildId, query)
  } else if (SQUAD_NAME_COMMANDS.has(commandName)) {
    names = await searchSquadNames(env, guildId, query)
  } else {
    return []
  }

  return names.map((name) => ({ name, value: name }))
}
