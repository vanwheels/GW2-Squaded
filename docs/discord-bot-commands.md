# Discord bot — command reference

A guide for using GW2-Squaded's Discord bot in your own server. For how the bot is built
internally, see [discord-bot.md](./discord-bot.md) — this page is just usage.

Every command replies privately to you (only you see the response), except the two board-message
channels the bot itself posts/updates (visible to everyone, per normal setup).

In every command below, `<name>` means required, `[name]` means optional. Any `name` argument
autocompletes against existing board entries as you type it.

You can also get this same reference inside Discord any time with **`/help`**.

## Quick start (server admin)

1. **`/buildboardsetup [channel]`** — one-time. Posts 9 messages, one per profession, into the
   given channel (or the current channel if you omit it). This is where builds will be listed.
2. **`/squadboardsetup [channel]`** — one-time. Posts a single squad-composition list message.
3. Anyone can now run `/buildadd`/`/squadadd` to start populating the boards (see below) — unless
   you want to restrict who can, see [Permissions](#permissions-admin) below.

If a board message ever gets deleted by accident, `/buildboardrebuild`/`/squadboardrebuild`
recreates it (existing entries are preserved — they live in the bot's own database, not in the
Discord message itself).

## Builds

| Command | What it does |
| --- | --- |
| `/buildadd <link> [name]` | Add a build to the board from a GW2-Squaded share link. Name defaults to the build's own name. |
| `/buildedit <name> [newname] [newlink]` | Rename a build and/or point it at a different share link. |
| `/buildremove <name>` | Remove a build from the board. |
| `/buildmove <name> <position>` | Move a build within its profession section (`1` = top). |
| `/builddisplay [name] [link]` | Post an image preview of a build — give a name already on the board, *or* a link (not both). |

A build's name on the board is a clickable link. Clicking it opens a page with a **Copy** button
for the share link, so anyone can pull it into their own copy of the app.

## Squads

| Command | What it does |
| --- | --- |
| `/squadadd <link> [name]` | Add a squad composition to the board from a share link. Name defaults to the squad's own name. |
| `/squadedit <name> [newname] [newlink]` | Rename a squad and/or point it at a different share link. |
| `/squadremove <name>` | Remove a squad from the board. |
| `/squaddisplay [name] [link]` | Post an image preview of a squad composition — name or link, not both. |

There's no `/squadmove` — the squad board is one add-ordered list, not per-profession sections.

## Previewing without a command

Every board message (each profession section, and the squad list) has its own **"Preview a
build…"** / **"Preview a squad…"** dropdown at the bottom. Pick an entry and the bot posts a
private screenshot — the same image `/builddisplay`/`/squaddisplay` produce, without having to
type a command.

## Permissions (admin)

By default, anyone in the server can run `/buildadd`/`/edit`/`/remove`/`/move` and their squad
equivalents. To require a specific role for one of those actions:

```
/buildboardconfig setpermission <boardtype> <action> <role>
```

- `boardtype`: **Build board** or **Squad board**
- `action`: **Add**, **Edit**, **Remove**, or **Move** (squads have no Move)
- `role`: the role required to perform that action

Run it once per (board, action) pair you want to gate — ungated actions stay open to everyone.
`/buildboardsetup`, `/squadboardsetup`, `/buildboardrebuild`, `/squadboardrebuild`, and
`/buildboardconfig` itself always require **Manage Server** (Discord's own built-in permission,
adjustable per-command from Discord's Integrations settings if you want to change that default).

## Approval workflow (admin)

By default, gated actions apply immediately once a permitted member runs them ("Automatic" mode).
Switch to "Manual" mode to require a second person's sign-off first:

```
/buildboardconfig approvalmode <Automatic|Manual>
/buildboardconfig setapproverrole <role>       — who can approve/reject
/buildboardconfig approvalschannel <channel>   — where pending requests get posted
```

In Manual mode, a gated `/buildadd`/`/edit`/`/remove`/`/move` (or squad equivalent) doesn't apply
right away — instead a card posts in the approvals channel with **Preview**, **Approve**, and
**Reject** buttons. Preview renders a screenshot of what the change would produce, so an approver
isn't deciding off a one-line text summary alone. Anyone can click Preview; only the approver role
(or a server admin) can Approve/Reject.

## Everything else

`/ping` is a plumbing healthcheck (replies "pong") — useful for confirming the bot is online and
responding, not something you'd normally need day-to-day.
