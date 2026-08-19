/** Thrown by a command handler for an expected, user-facing failure (bad name, no permission, not
 *  found, etc.) — `dispatch.ts` catches this specifically and delivers `.message` verbatim as the
 *  ephemeral followup, no logging. Anything else thrown is an unexpected bug: `dispatch.ts` logs
 *  it and shows a generic "something went wrong" followup instead, so a raw error/stack trace
 *  never leaks to a Discord user. */
export class UserError extends Error {}
