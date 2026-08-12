# Discord bot — design (not yet built)

Mapped out 2026-08-12, in a design conversation, not a build session. Nothing described here
exists yet — no worker route, no D1 database, no Discord application registered. This doc is
the design-of-record so a future session can pick it up without re-deriving the reasoning.
`TODO.md`'s "Discord bot" entry points here instead of holding this detail inline.

## What it is

A guild-scoped, curated build/squad board, managed entirely through Discord slash commands.
Not a browser for a user's local GW2-Squaded library (that would require an account system
this app doesn't have — see "Explicitly out of scope" below) — the bot's data is new, separate
state that lives in the bot's own storage, seeded from existing GW2-Squaded share links.

Two channels, e.g. `#builds` and `#squads`. `#builds` holds 9 bot-managed messages, one per
profession, each a running list of named builds. `#squads` holds one running list. Server
members add/edit/remove/reorder entries via slash commands instead of anyone editing the
messages directly; the bot keeps the messages in sync.

## Why not just "post an embed of a link"?

That was the original, smaller scoping (see `COMPLETED.md`'s Session 32 note: "Unblocks the
Discord bot roadmap item"). This design supersedes it — everything that smaller version would
have done (fetch a share link, validate it, format an embed) is a subset of `/buildAdd`'s first
step here.

## Architecture

**Interactions-endpoint model, not a gateway bot.** Discord supports two integration styles:

1. A persistent gateway connection (`discord.js`-style) that can watch every message in a
   channel — needed for passive behavior like "auto-embed any pasted link," but requires an
   always-on process. This project has no such infra today (Electron desktop app + static
   Cloudflare Workers + local SQLite) and none of this design needs passive message-watching.
2. An HTTP interactions endpoint — Discord POSTs to a URL you register whenever a slash command
   or button is used; you verify an Ed25519 signature and respond within 3 seconds. Stateless,
   deploys the same way `worker/` already does.

Everything here is slash-command/button driven, so (2) applies cleanly. Recommendation: a new
route (`POST /interactions`) on a Cloudflare Worker — either the existing `worker/` project or a
sibling deployable following the same self-contained pattern (own `package.json`, no monorepo
tooling, per `COMPLETED.md`'s notes on why `worker/` is structured that way). Not yet decided
which; leaning toward the same worker, since it lets `/buildAdd` read the existing share KV
directly via binding instead of a network hop.

Discord requires `PING` (interaction type 1) to be answered with `PONG` before it'll accept the
endpoint URL in the Developer Portal — that's step zero of implementing this, before any real
command works.

## Storage

New Cloudflare **D1** database (SQLite-on-Workers) — not the existing KV share store, which
stays exactly as-is (anonymous blob store, read by `/buildAdd`/`/squadAdd` to validate a
submitted link and pull `profession`/name data off it). This is new state: ordered, relational,
with uniqueness constraints — a poor fit for KV.

```sql
-- One row per guild.
CREATE TABLE guild_settings (
  guild_id           TEXT PRIMARY KEY,
  approval_mode      TEXT NOT NULL DEFAULT 'automatic', -- 'automatic' | 'manual'
  approver_role_id   TEXT,                              -- required if approval_mode = 'manual'
  display_visibility TEXT NOT NULL DEFAULT 'public',     -- 'public' | 'private'
  approvals_channel_id TEXT                              -- required if approval_mode = 'manual'
);

-- Per-guild, per-board-type, per-action role gate. Normalized by board_type so build/squad
-- boards *could* diverge later even though v1 configures them identically.
CREATE TABLE action_permissions (
  guild_id   TEXT NOT NULL,
  board_type TEXT NOT NULL,   -- 'build' | 'squad'
  action     TEXT NOT NULL,   -- 'add' | 'edit' | 'remove' | 'move'
  role_id    TEXT NOT NULL,
  PRIMARY KEY (guild_id, board_type, action)
);

-- Tracks which channel+message the bot owns for each board section, so it can PATCH in place.
CREATE TABLE board_messages (
  guild_id   TEXT NOT NULL,
  board_type TEXT NOT NULL,        -- 'build' | 'squad'
  category   TEXT NOT NULL,        -- profession name, or a fixed constant for the squad board
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, board_type, category)
);

CREATE TABLE builds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  name        TEXT NOT NULL,       -- unique per guild (not per profession)
  share_id    TEXT NOT NULL,       -- id from the existing worker's share store
  profession  TEXT NOT NULL,       -- derived from the fetched share data, never typed by hand
  sort_order  INTEGER NOT NULL,    -- position within its profession's section
  added_by    TEXT NOT NULL,
  added_at    TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (guild_id, name)
);

CREATE TABLE squads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  name        TEXT NOT NULL,       -- unique per guild
  share_id    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,    -- add-order; no /squadMove in v1
  added_by    TEXT NOT NULL,
  added_at    TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (guild_id, name)
);

-- Only populated when a guild is in 'manual' approval mode.
CREATE TABLE pending_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id          TEXT NOT NULL,
  board_type        TEXT NOT NULL,   -- 'build' | 'squad'
  action            TEXT NOT NULL,   -- 'add' | 'edit' | 'remove' | 'move'
  target_id         INTEGER,         -- null for 'add'; references builds.id/squads.id otherwise
  proposed_name     TEXT,
  proposed_share_id TEXT,
  proposed_position INTEGER,
  requested_by      TEXT NOT NULL,
  requested_at      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  decided_by        TEXT,
  decided_at        TEXT
);
```

## Command reference

**Board admin** (setup/config, presumably gated to server admins by Discord's own native
per-command permission UI, not by `action_permissions`):

| Command | Effect |
| --- | --- |
| `/buildBoardSetup` | Posts the 9 empty profession messages into the target channel, records their ids in `board_messages`. One-time per guild. |
| `/buildBoardRebuild` | Recreates a board message if it was deleted out-of-band in Discord. |
| `/squadBoardSetup` / `/squadBoardRebuild` | Same pair, single message. |
| `/buildBoardConfig approvalMode [automatic\|manual]` | Sets `guild_settings.approval_mode`. |
| `/buildBoardConfig setPermission [add\|edit\|remove\|move] [role]` | Writes `action_permissions`. |
| `/buildBoardConfig setApproverRole [role]` | Sets `guild_settings.approver_role_id` — one global approver role for all actions (decided over per-action approvers, for a smaller config surface). |
| `/buildBoardConfig displayVisibility [public\|private]` | Sets `guild_settings.display_visibility`. Defaults to **public** — `/buildDisplay`/`/squadDisplay` post visibly to the channel unless an admin opts into private (ephemeral) responses. |
| `/buildBoardConfig approvalsChannel [channel]` | Where pending-request cards get posted in Manual mode. |

**Builds** (autocomplete on every `[Build Name]` argument, suggesting existing names):

| Command | Notes |
| --- | --- |
| `/buildAdd [Build Name] [Link]` | `[Link]` must resolve via the existing `GET /shares/:id` and pass `isLikelyBuild` — rejected otherwise. Profession is derived from the fetched data, never typed by the user. Appended to the end of that profession's section. |
| `/buildRemove [Build Name]` | |
| `/buildEdit [Build Name] [new name?] [new link?]` | Both optional. **Edge case**: if the new link resolves to a *different* profession than the original, the entry moves sections — removed from the old board message, appended to the new one, both `PATCH`ed. |
| `/buildMove [Build Name] [position]` | Numeric slot within that build's own profession section. Subject to approval gating in Manual mode, same as add/edit/remove — decided against treating it as always-immediate, for one consistent rule admins don't have to special-case. |

**Squads** — `/squadAdd`, `/squadRemove`, `/squadEdit`, same shape, no `/squadMove` (add-order
stands for v1; the "one running list" layout was chosen over profession-style categories or a
freeform per-add tag, since squads have no natural fixed taxonomy the way professions do).

**Display** — `/buildDisplay [Build Name]`, `/squadDisplay [Squad Name]`. Posts a text-only
embed: profession/elite spec, weapons, utility skills, trait lines + selected traits, gear
stat/rune/sigil summary for builds; roster-by-party breakdown for squads. No image, no hover —
Discord has no tooltip mechanism, so this is the honest flattened equivalent of the desktop
app's tooltip content. See "Rendered images" below for why a visual version isn't v1.

## Approval workflow (Manual mode)

1. Caller runs a mutating command. The bot checks `action_permissions` for that
   guild/board/action — same role gate applies in both modes, it only governs who can *submit*.
2. If `guild_settings.approval_mode = 'manual'`: instead of writing to `builds`/`squads`
   directly, insert a `pending_requests` row and post a card (embed describing the proposed
   change) to `approvals_channel_id`, with **✅ Approve / ❌ Reject** buttons — Discord message
   components, handled by the same `/interactions` endpoint as a `MESSAGE_COMPONENT` interaction
   type. Reply to the original caller ephemerally ("submitted for approval").
3. When a button is clicked, the bot verifies the clicker holds `approver_role_id` before doing
   anything (button visibility in Discord isn't restricted to a specific user, so this check is
   load-bearing, not just UX).
4. On Approve: apply the change to `builds`/`squads`, `PATCH` the affected board message(s),
   edit the approval card to show who decided it and remove the buttons.
5. On Reject: mark the card decided, no data change.

If `approval_mode = 'automatic'`, step 2 is skipped entirely — the role-gated caller's change
applies immediately, exactly as if Manual mode didn't exist.

## The game-data gap this surfaces

`/buildDisplay`/`/squadDisplay` need to turn raw skill/trait/item ids into names — something the
worker has never had to do (today it's a dumb opaque-JSON blob store, per `worker/src/index.ts`'s
own doc comments). This means the worker needs its own slice of the same lookup data the desktop
app ships in `data/game-data/*.json` (see `docs/game-data.md`), bundled in at deploy time. Not
yet decided how that slice gets kept in sync with the app's own copy when a balance patch lands —
extending `scripts/fetch-game-data.ts` to also stage a worker-side copy is the likely shape, but
unbuilt.

## Explicitly out of scope for v1

- **Rendered/screenshot-style display.** The existing `ScreenshotButton` only works because it
  captures pixels from a *running Electron window* on the user's own machine
  (`src/main/ipc/capture-ipc.ts`) — there's no server-side equivalent. A visual build card from
  the bot would mean a genuinely new headless-render or canvas pipeline. Text-only embeds are v1.
- **Passive link auto-embedding** (pasting a share link with no slash command). Would require a
  gateway bot and 24/7 hosting this project doesn't have — see "Architecture" above.
- **Browsing a user's own local GW2-Squaded library from Discord.** Would require an account
  system tying a Discord identity to app data; this design deliberately avoids that by making the
  board's data independent, guild-owned state seeded from share links instead.
- **Per-action approver roles.** One global approver role was chosen over a separately
  configurable approver per action, for a smaller admin config surface. Revisit if a real need
  for e.g. "only Guild Leader approves removes" shows up.
- **Squad reordering / categorization.** `/squadAdd` has no category argument and there's no
  `/squadMove`; the board is a single add-ordered list.

## Status

Designed 2026-08-12. Not started — no worker route, no D1 schema applied, no Discord
application registered yet.
