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
| `/buildAdd [Link] [Build Name?]` | `[Link]` must resolve via the existing `GET /shares/:id` and pass `isLikelyBuild` — rejected otherwise. Profession is derived from the fetched data, never typed by the user. `[Build Name]` is optional — if omitted, falls back to the fetched `Build`'s own `name` field (`src/shared/types/build.ts:111`), so a build that was already named in the desktop app needs no retyping. Appended to the end of that profession's section. |
| `/buildRemove [Build Name]` | |
| `/buildEdit [Build Name] [new name?] [new link?]` | Both optional. **Edge case**: if the new link resolves to a *different* profession than the original, the entry moves sections — removed from the old board message, appended to the new one, both `PATCH`ed. |
| `/buildMove [Build Name] [position]` | Numeric slot within that build's own profession section. Subject to approval gating in Manual mode, same as add/edit/remove — decided against treating it as always-immediate, for one consistent rule admins don't have to special-case. |

**Squads** — `/squadAdd [Link] [Squad Name?]`, `/squadRemove`, `/squadEdit`, same shape (name
optional, falls back to the fetched `SquadCompSharePayload.squadComp.name`), no `/squadMove`
(add-order stands for v1; the "one running list" layout was chosen over profession-style
categories or a freeform per-add tag, since squads have no natural fixed taxonomy the way
professions do).

**Display** — `/buildDisplay [Build Name?] [Link?]`, `/squadDisplay [Squad Name?] [Link?]`. Both
arguments optional, but exactly one must be given: `[Name]` looks up an existing board entry by
its stored `share_id`; `[Link]` renders an ad-hoc preview of *any* share link, including one
that was never added to the board at all — same rendering path either way, just a different
source for which share to fetch. Posts a text-only embed: profession/elite spec, weapons,
utility skills, trait lines + selected traits, gear stat/rune/sigil summary for builds;
roster-by-party breakdown for squads. No image, no hover — Discord has no tooltip mechanism, so
this is the honest flattened equivalent of the desktop app's tooltip content. See "Rendered
images" below for why a visual version isn't v1.

Because `/buildAdd`/`/buildDisplay` both start from "fetch and validate a share link," the
fetch+validate+shape-into-embed-fields logic is one shared function, not duplicated — `/buildAdd`
uses it to derive the default name/profession before writing a row, `/buildDisplay` uses it
straight through to render, whether or not that link is on the board.

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

## Phased build order

This is the largest single feature scoped in this project so far — closer to standing up a
small independent service than a typical feature session. Four phases, each independently
shippable/testable, matching this project's established pattern of doing one piece of a large
effort at a time rather than chaining straight through (see the "pacing large sweeps" memory
convention from other multi-part sweeps in this project). Each phase's own doc-comment/commit
should update this section's checkbox when done.

- [x] **Phase 1 — foundational plumbing.** Discord application registration (public key, bot
      token), the `/interactions` route with Ed25519 signature verification and the
      `PING`/`PONG` handshake (Discord won't accept the endpoint URL in its Developer Portal
      until this works), the D1 database and its bindings, and a command-registration script
      that keeps Discord's slash-command definitions in sync with what the bot actually handles.
      Nothing user-facing yet — this phase is done when Discord successfully validates the
      endpoint and an empty/no-op command round-trips. **Done 2026-08-19**: worker deployed to
      `https://gw2-squaded-share.vanwheelstheman.workers.dev`, `DISCORD_BOT_TOKEN` set as a
      production secret, Interactions Endpoint URL saved in the Developer Portal, `/ping`
      registered and confirmed working live in a real server.
- [x] **Phase 2 — core CRUD + board sync, Automatic mode only.** `/buildAdd`/`Edit`/`Remove`/
      `Move`, `/squadAdd`/`Edit`/`Remove`, `/buildBoardSetup`/`Rebuild` + squad equivalents,
      `/buildBoardConfig setPermission`. No approval workflow, no `/*Display` — every mutating
      command executes immediately once the caller's role checks out. **This phase alone is a
      usable v1** — a curated, permissioned board with no display/approval polish. Good candidate
      for an actual release checkpoint before continuing. **Code complete and smoke-tested
      2026-08-19** (17-assertion local-D1 smoke test covering setup/idempotency, all build/squad
      CRUD including cross-profession moves, permission gating, autocomplete, and rebuild — all
      passing); not yet deployed to production or registered with Discord, see "Status" below.
      Notable implementation decisions beyond the design doc's own text:
      - Every mutating command uses Discord's **deferred response** pattern (ack immediately,
        edit the placeholder once D1 + the board-message PATCH finish via `ctx.waitUntil`) since
        that combined work isn't reliably under Discord's 3-second initial-response window.
        Autocomplete has no deferred variant and is answered synchronously (a single indexed
        `LIKE` query comfortably fits).
      - `action_permissions` with **no configured role for an action defaults to open** (any
        server member can do it) rather than locked down — an admin opts into gating via
        `/buildBoardConfig setPermission`. Guild admins (Discord's own resolved Administrator
        permission) always bypass every gate regardless, as a lockout safety valve.
      - `/buildBoardSetup`/`/squadBoardSetup` refuse to run a second time for a guild (use
        `/buildBoardRebuild`/`/squadBoardRebuild` instead) rather than silently reposting.
      - Discord requires slash command names to be all-lowercase, so the doc's camelCase names
        above are registered as e.g. `buildadd`, `buildboardconfig` — see
        `scripts/register-commands.ts`.
- [x] **Phase 3 — approval workflow.** `pending_requests`, `/buildBoardConfig approvalMode` /
      `setApproverRole` / `approvalsChannel`, the Approve/Reject button interactions and the
      permission re-check on click. Layers entirely on top of Phase 2's write paths without
      changing them (Automatic mode keeps working exactly as before). **Code complete and deployed
      2026-08-19** (commit 83e8b48) — typecheck/lint/`wrangler deploy --dry-run` all clean, and
      **live-verified end-to-end in a real Discord server** (`approvalmode manual` →
      `setapproverrole` → `approvalschannel` → a gated `/buildadd` → both Approve and Reject
      confirmed working, board only updates on Approve). Implementation notes beyond the design
      doc's own text:
      - Every mutating build/squad command (`buildAdd`/`Edit`/`Remove`/`Move`,
        `squadAdd`/`Edit`/`Remove`) now does its full pre-flight validation (share resolved, name/
        profession derived, target found, board section exists) *before* branching on approval
        mode — `discord/approvals.ts`'s `checkApprovalGate` runs after that, so a bad `/buildAdd`
        in Manual mode still gets an immediate, specific error instead of creating a junk pending
        request. Automatic mode (or no `guild_settings` row at all) is untouched: `checkApprovalGate`
        returns `null` and the command applies exactly as it did before this phase.
      - `pending_requests` stores only `target_id` + the raw `proposed_*` columns, no snapshot
        text. Both the approval card's description and the eventual apply-on-Approve re-derive
        everything live (re-fetch the target build/squad by id, re-resolve a proposed share link)
        — `describePendingBuildRequest`/`applyPendingBuildRequest` in `commands/builds.ts` and
        their squad equivalents. This means a request can go stale between submission and decision
        (target renamed, board un-set-up) and Approve will surface that as a clear failure on the
        card rather than silently applying something wrong.
      - `decidePendingRequest` (`db.ts`) claims a request with a single `UPDATE ... WHERE status =
        'pending' RETURNING *` — race-safe against two people clicking Approve/Reject on the same
        card at once (Discord doesn't restrict button visibility to one user). If the apply step
        after a won claim throws, the row is left `status = 'approved'` with nothing actually
        changed, reported inline on the card (`⚠️ Approved, but applying it failed: ...`) rather
        than rolled back — accepted as a rare-failure-path simplification for v1.
      - `commands/builds.ts`/`squads.ts` import `checkApprovalGate` from `discord/approvals.ts`,
        but `approvals.ts` itself never imports those command modules back (it takes their
        describe/apply functions as plain parameters instead) — avoids a module cycle. The
        board-type → handler-pair wiring lives in `dispatch.ts`'s `BOARD_REQUEST_HANDLERS`, the one
        module that already legitimately imports both `approvals.ts` and every command module.
      - A button click is a hybrid interaction: `interactions.ts` checks the clicker's
        `approver_role_id` *synchronously* (cheap D1 read) before acking, since a failed check
        replies ephemerally without touching the card at all, while a real decision acks with
        `DEFERRED_UPDATE_MESSAGE` and does the actual apply + card edit in the background — same
        "defer the slow part, delegate delivery to `@original`" shape `runCommand` already used for
        slash commands, factored into a shared `deliverInteractionResult` both now call.
      - **Same-day follow-up (commit c668f39):** live-verify testing surfaced a real gap — the
        card's one-line text summary gave an approver nothing to actually inspect before deciding.
        Added a **Preview** button (`build` requests only; `squad` had no equivalent renderer yet
        at the time) that reuses `/builddisplay`'s `renderBuildScreenshot` pipeline,
        delivered as its own new ephemeral message (`DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`, same ack
        shape a slash command uses) rather than editing the card
        (`DEFERRED_UPDATE_MESSAGE`, what Approve/Reject use) — so the card and its buttons are never
        touched by a Preview click. No approver-role gate on Preview itself, since viewing a render
        isn't privileged the way deciding the request is. Deployed and confirmed working live
        2026-08-19.
      - **Squad-equivalent follow-up (2026-08-19, later session):** `decisionButtons` now puts the
        Preview button on `squad` requests too, and `runApprovalPreview` branches on `board_type` to
        pick `resolvePendingBuildPreviewShareId`+`renderBuildScreenshot` or the new
        `resolvePendingSquadPreviewShareId` (`commands/squads.ts`, mirrors the build resolver
        exactly)+`renderSquadScreenshot`. Closes one half of the "Follow-on integration" gap Phase 4
        leg 3 below left open.
- [x] **Phase 4 — display + game-data resolution.** Bundling a synced slice of
      `data/game-data/*.json` into the worker (the real unknown-sized piece of this whole
      project — see "The game-data gap this surfaces" above), then `/buildDisplay`/
      `/squadDisplay` built on top of it, including the link-only ad-hoc preview path.
      **Reordered ahead of Phase 3** (built next, not approval workflow) — a rendered preview was
      judged more valuable to ship first; Phase 3 layers cleanly on top of Phase 2's write paths
      whenever it's picked up, so nothing here blocks it. Landing in legs:
      - [x] **Leg 1 — web-preview render page + worker bindings** (commit 85c8488, 2026-08-19). A
            standalone Vite bundle (`src/web-preview/`) renders the exact `BuildScreenshotGrid`
            the desktop app's own screenshot button captures, fed by a fetch-based
            `GameDataProvider` instead of Electron IPC, off the newly-extracted
            `buildGameData()`. Signals readiness via `document.body.dataset.renderState`. The
            worker gained `[browser]` (Cloudflare Browser Rendering) and `[assets]` (serves the
            built page from the same deployable) bindings.
      - [x] **Leg 2 — screenshot render + `/builddisplay` command** (commit cf47d2d, 2026-08-19).
            `worker/src/render/build-screenshot.ts` drives Browser Rendering
            (`@cloudflare/puppeteer`) to the leg-1 page and screenshots `.build-editor-grid`;
            `worker/src/discord/api.ts`'s `editOriginalInteractionResponse` grew a
            `multipart/form-data` branch (`DiscordMessagePayload.file`) for delivering the PNG as
            a followup attachment, no changes needed to `dispatch.ts`'s generic followup path.
            `/builddisplay [name?] [link?]` (exactly one required, `name` autocompletes against
            existing board entries) is the command itself — no board write, so no
            `action_permissions` gate, same as autocomplete. Also required adding
            `compatibility_flags = ["nodejs_compat"]` to `wrangler.toml` (`@cloudflare/puppeteer`
            imports `node:buffer`; `wrangler deploy --dry-run` warned without it). **Deployed,
            registered, and live-verified working in a real Discord server 2026-08-19** — see
            "Status" below for the 4 real bugs the live-verify pass caught, none of which showed
            up in local typecheck/lint/dry-run. Squad display (`/squaddisplay`) is a later leg,
            not built here.
      - [x] **Leg 3 — `/squaddisplay`.** Same shape as leg 2, mirrored for squads rather than a new
            design: `SquadCompScreenshotGrid.tsx` (new) factors the party-rows-plus-Add-line markup
            out of `SquadCompEditorView.tsx`, the same "extract so a read-only caller can render the
            exact layout without a second copy drifting out of sync" move leg 1 made for
            `BuildScreenshotGrid`. A new `src/web-preview/SquadPreviewPage.tsx` +
            `squad-preview.html`/`main-squad.tsx` entry point (vite.web-preview.config.ts's
            `rollupOptions.input` now builds both HTML entries in one pass, sharing the `global.js`
            chunk) fetches the share, validates it's a `squadComp` (`isLikelySquadCompSharePayload`),
            and builds `buildsById` straight from the share payload's own bundled `builds` map — no
            store involved for roster content. One provider addition beyond `main.tsx`'s stack:
            `BuildsStoreProvider`, because `SlotTile`'s favorite-toggle affordance calls
            `useBuildsStore()` unconditionally even though it's dead code under
            `interactive={false}`'s `pointer-events: none` — same "missing provider crashes the
            whole tree silently" failure mode leg 2's live-verify pass caught for builds, avoided
            here by adding the provider up front rather than rediscovering the bug live.
            `worker/src/render/squad-screenshot.ts` mirrors `build-screenshot.ts` exactly (same
            1800px viewport, same `body[data-render-state]` wait, `.party-rows` instead of
            `.build-editor-grid` as the capture selector). `squadDisplay` (`commands/display.ts`)
            mirrors `buildDisplay`'s exactly-one-of-name/link shape, using `getSquadByName`/
            `asLikelySquadCompFields` (both already existed, unused until now). Wired into
            `dispatch.ts`'s `COMMANDS`, `autocomplete.ts`'s `SQUAD_NAME_COMMANDS`, and
            `register-commands.ts`. **Deployed, registered, and confirmed working end-to-end in a
            real Discord server 2026-08-19** — see "Status" below for the one real bug the
            live-verify pass caught (per-slot build icons not resolving) and its same-day fix.
      - [x] **Follow-on integration** (2026-08-19, later session): the two things explicitly
            deferred pending this leg landing are both wired now, reusing `renderSquadScreenshot`
            exactly as anticipated. The approval-card Preview button (`dispatch.ts`'s
            `runApprovalPreview`) now renders a squad screenshot for squad requests instead of the
            "isn't available yet" reply — see the Phase 3 same-day-follow-up note above. The board
            list's per-section "Preview a build…" select menu (`render/board.ts`) has a squad
            equivalent — see "Board list polish" item 2 below.

## Board list polish (raised 2026-08-19)

Three board-list improvements were raised in a follow-up conversation, before starting Phase 4
leg 3 (`/squaddisplay`): (1) a build's name as a hyperlink that gets the build into the user's
hands with as little friction as possible, ideally opening it straight in the desktop app; (2) a
Preview affordance directly on the board, not just via typing `/builddisplay`; (3) a
profession/elite-spec emoji next to each build's name. Feasibility + scope decisions:

1. **Hyperlink → clipboard / auto-open — the copy half built this session.** A raw Discord markdown
   link only navigates — it can't run JS to write the clipboard on click. The real version of
   "copy" is a small worker-hosted landing page with a one-click Copy button (cheap, no Electron
   changes): `render/board.ts`'s `renderBuildSection`/`renderSquadSection` now wrap each list entry's
   name in a masked link (`**[Name](url)**`, `escapeMarkdown` extended to also escape `[`/`]` so a
   name can't break out of the link label) pointing at a new `GET /shares/:id/open` route
   (`render/share-landing.ts`), instead of the raw `/shares/:id` JSON the desktop app's own import
   flow fetches. That page shows the build/squad's name (+ profession, reusing
   `share-validate.ts`'s existing field extraction — no new validation), a Copy button for the same
   `/shares/:id` link `ImportFromLinkButton`'s "Import from link" box already accepts, a manual-copy
   fallback input for browsers that block `navigator.clipboard`, and a GitHub Releases link for
   someone who doesn't have the app yet. Applies to squad board entries too, not just builds — the
   same landing page works for either share kind, and squads already carry a `share_id`. Self-
   contained, theme-aware (light/dark via `prefers-color-scheme`, matching the app's own palette
   tokens) HTML with a per-request CSP nonce gating its one inline `<script>`, no external requests.
   "Auto-open in the app" is a real, separate feature: a custom URL protocol
   (`app.setAsDefaultProtocolClient`, electron-builder's NSIS `protocols` config wires the Windows
   registry) that the landing page would try before falling back to the copy button, plus new
   main-process code to catch that URL and drive the import flow. **Still deferred** — the user
   chose to land the simple copy version first as its own session rather than bundle it with the
   bigger protocol-handler piece. **Deployed and live-verified 2026-08-19** (commit 38d0a51,
   Version ID `3046d3e9`) — confirmed via curl against the deployed worker (landing page 200s with
   correct CSP nonce + HTML escaping, raw `/shares/:id` JSON API unchanged, unknown id → 404 page).
2. **Preview select menu per section — built 2026-08-19.** Discord caps a message at 25 components
   (5 rows × 5) — one button per build in a busy profession section would hit that fast. A **select
   menu** per section ("Preview a build…", up to 25 options, `render/board.ts`'s
   `buildPreviewSelectRow`) was the user's chosen direction, reusing the same
   `renderBuildScreenshot` pipeline the approval card's Preview button already uses
   (`discord/dispatch.ts`'s new `runBoardBuildPreview`). Each option's value is the build's own
   `id` (not its name), so a rename between message render and click can't select the wrong build;
   `discord/interactions.ts` routes any `MESSAGE_COMPONENT` interaction whose `custom_id` matches
   the shared `BOARD_BUILD_PREVIEW_CUSTOM_ID` constant here — one literal reused across every
   profession's message, since the selected option value already identifies the build without
   needing the section threaded through. Same no-permission-gate, own-new-ephemeral-message shape
   as the approval card's Preview button (viewing a render isn't privileged); the board message
   itself is never touched by a preview pick. `renderBuildSection` now also sets `components: []`
   explicitly when a section is emptied out by a `/buildRemove`, clearing a stale select menu whose
   last option no longer exists — Discord's message-edit semantics only touch fields present in the
   PATCH body, same reasoning as the Approve/Reject card's own `components: []` on decision.
   A section past 25 builds silently only lists the first 25 in the dropdown rather than paging —
   no real section is close to that today, logged as an acceptable v1 gap rather than built out.
   Typecheck/lint/`wrangler deploy --dry-run` all clean; **deployed and confirmed working live in a
   real Discord server 2026-08-19** (Version ID `fb36fefb`). No `register-commands` step was
   needed — no new slash command, just a message-component route. Existing board messages won't
   show the new dropdown until they're next PATCHed (any `/buildAdd`/`Edit`/`Remove`/`Move`, or
   `/buildBoardRebuild` to force it without a real change).
   **Squad-equivalent follow-up (2026-08-19, later session):** `render/board.ts`'s
   `squadPreviewSelectRow` + `BOARD_SQUAD_PREVIEW_CUSTOM_ID` mirror the build ones exactly (one
   literal custom_id, option value is the squad's own `id`), `renderSquadSection` now sets the same
   `components: []`-clears-a-stale-menu behavior on an empty board, and
   `discord/dispatch.ts`'s new `runBoardSquadPreview` mirrors `runBoardBuildPreview` reusing
   `renderSquadScreenshot`. Closes the other half of Phase 4 leg 3's "Follow-on integration" gap.
3. **Profession/elite-spec emoji next to the name — built this session.** Uses Discord
   **application emojis** (bot-owned, usable in every guild the bot is in, don't consume a guild's
   own emoji slots), uploaded once from the already-curated, license-checked
   `data/game-data/tango-icons.json` via a new `worker/scripts/register-emojis.ts`
   (`npm run register-emojis`, idempotent — re-run whenever a new elite spec ships) that writes
   `worker/src/discord/emoji-map.json` (name/id pairs; starts out an empty-but-valid placeholder so
   the build doesn't depend on the script having run). `render/board.ts`'s `renderBuildSection`
   prefixes each list entry with `<:Name:id>` — the build's elite spec if it chose one, else its
   plain profession, else nothing if that icon hasn't been uploaded yet. **Elite-spec-aware** (the
   user's own example: a Reaper build shows Reaper's icon, not plain Necromancer's), which needed a
   new nullable `builds.specialization_id` column (migration `0002_add_build_specialization.sql`)
   derived from the share data at add/edit time the same "never typed by hand" way `profession`
   already is (`share-validate.ts`'s `LikelyBuildFields.specializationId`, trait line slot 2 —
   `commands/builds.ts`'s `applyAdd`/`applyEdit` and the pending-request apply paths all thread it
   through). Squad board entries deliberately get no emoji — a squad spans multiple professions,
   so no single icon applies the way it does for one build. **Not yet live**: needs
   `wrangler d1 migrations apply` for the new column and `npm run register-emojis` (a live write to
   the bot's Discord application) run by the user, then a deploy — none of those run yet as of this
   writing.

## Status

Designed 2026-08-12. Phase 1 (foundational plumbing) complete and live as of 2026-08-19. Phase 2
(core CRUD + board sync, Automatic mode) complete, deployed, registered, and **manually verified
live in a real Discord server 2026-08-19**: `/buildboardsetup`/`/squadboardsetup`, `/buildadd`/
`/squadadd`, `/buildremove`/`/squadremove` (including name autocomplete), `/buildedit`, and
`/buildmove` all confirmed working end-to-end by the user. Permission gating
(`/buildboardconfig setpermission` + the role-gate enforcement it configures) exercised only by
the local smoke test so far — live verification deferred by the user to a later session.

Live testing caught one real gap (not a registration/autocomplete problem, which turned out fine
on retest): the deferred-response followup PATCH had no error handling, so a transient failure
there could leave a command's D1 write successfully applied while the user saw Discord's "the
application did not respond" with no indication anything happened. Fixed same-day (commit
e0b7d52): one retry on that followup, with the second failure at least logged instead of
vanishing as a silent unhandled rejection.

Phase 4 (display) leg 2 (`/builddisplay`) is deployed, registered, and **confirmed working
end-to-end in a real Discord server as of 2026-08-19** (final Version ID `aa30c7d8`).

`/squaddisplay` (leg 3) is **deployed, registered, and confirmed working end-to-end in a real
Discord server as of 2026-08-19** (`wrangler deploy` Version ID `e5052a97...`, `npm run
register-commands` registered command id `1539741117862641765`). Live testing caught one real gap,
same-day fixed (commit `8a8d230`): party names and boon/condition summaries rendered correctly, but
every slot's own profession/elite-spec icon badge showed the empty-slot placeholder instead of the
real icon. Root cause — `SlotTile`'s icon badge is resolved by `UpgradePicker` matching `chosenId`
against its `options` list, built from the `builds` array *prop*, a separate list from
`buildsById`/`build` (used for the slot's name/summary, which is why those rendered fine).
`SquadPreviewPage` passed `builds={[]}`, assuming the assign-dropdown was fully dead code under
`interactive={false}` — true for interaction, but `options` still needs real entries for the icon
lookup itself to resolve. Fixed by deriving `builds` from `buildsById`'s own values instead of
hardcoding it empty; redeployed (Version ID `a68043a3...`), no command re-registration needed (no
command shape changed). Confirms the caution leg 2's own write-up gives: local typecheck/lint/
dry-run/`build:web-preview` all stayed clean through this bug — it only ever showed up live.

Phase 3 (approval workflow) is **deployed, registered, and confirmed working end-to-end in a real
Discord server as of 2026-08-19**: `/buildboardconfig approvalmode manual` →
`setapproverrole` → `approvalschannel` → a gated `/buildadd` → both Approve and Reject
confirmed on the resulting card, board message only updating on Approve. `wrangler d1 migrations
apply` wasn't needed (the schema shipped in Phase 1's single init migration already);
`npm run register-commands` was, to publish `buildboardconfig`'s three new subcommands (Discord's
**global** command registration can take up to an hour to propagate to a client — a same-session
"the new subcommands aren't showing up" turned out to be exactly that, confirmed by querying
Discord's REST API directly for the registered command definition rather than trusting the
client's cache).

Live testing caught one real gap, same-day fixed (commit c668f39, see Phase 3's own bullet list
above): the approval card gave an approver nothing to actually inspect beyond a one-line text
summary before deciding. Added a Preview button reusing `/builddisplay`'s render pipeline.

**Squad-equivalent follow-ons (2026-08-19, later session):** the two Phase 4 leg 3 "not built here"
items are wired — approval-card Preview button now covers squad requests too, and the board list
grew a squad-board "Preview a squad…" select menu, both reusing `renderSquadScreenshot`. No new
slash command (message-component routes only), so no `register-commands` step needed.
Typecheck clean, `wrangler deploy --dry-run` clean, and **deployed** (Version ID
`a286a027-8017-4249-b3b0-84caf437f637`) — not yet live-verified in a real Discord server (needs a
manual-mode squad add/edit/remove to exercise the approval-card Preview button, and a populated
squad board to exercise the select menu).

The live-verify pass caught 4 real bugs invisible to typecheck/lint/`wrangler deploy --dry-run`
(all local-only checks — none of them run the render page in an actual browser), diagnosed live
via `wrangler tail` piping the headless page's own `console`/`pageerror` events into the Worker's
log (now a permanent instrumentation in `build-screenshot.ts`, not removed after use):

1. **Game-data race.** The share fetch (small) reliably beat the ~8MB/26-file game-data fetch, so
   `BuildScreenshotGrid` mounted against `useGameData()`'s still-empty placeholder catalog and
   threw on the first undefined skill/trait/specialization lookup — with no error boundary, that
   silently killed the whole render tree, so `data-render-state` never got set and `/builddisplay`
   just hung until the timeout. Can't happen in Electron (game data loads from local disk via IPC,
   always finished before a user could have a build open). Fixed in `BuildPreviewPage.tsx`: gate
   mounting the grid on `!gameDataLoading` too, not just `build !== null`.
2. **Missing context providers.** `main.tsx` only wrapped `GameDataStoreProvider` — but
   `BuildScreenshotGrid`'s tree calls `usePickerOpen()` (`ProfessionSpecPicker`/`WeaponTypeBar`/
   etc.), `useAppSettings()` (6 components, `showUnderwater`/`showRacialSkills`/`partyWideOnly`),
   and `useFavoriteConsumables()` (`EquipmentEditor`) unconditionally, even with
   `interactive={false}`. Each missing provider threw synchronously, same silent-crash shape as
   #1. Fixed by wrapping `PickerRegistryProvider`/`AppSettingsProvider`/
   `FavoriteConsumablesProvider` around `BuildPreviewPage` too (confirmed via a full grep that
   nothing in the tree needs `DataUpdateStoreProvider`/`BuildsStoreProvider`/
   `SquadCompsStoreProvider` — all 3 depend on Electron-only `window.gw2*` IPC bridges that don't
   exist in a plain browser tab, so they're correctly left out rather than needing a web stub).
3. **Missing local icon assets + narrow CSP.** `vite.web-preview.config.ts`'s `root` is
   `src/web-preview`, which has no `public/` of its own — every relative `icons/weapon-mini/…`,
   `icons/slot-mini/…`, `icons/stat-prefix/…` reference (all sourced from `src/renderer/public/`,
   copied automatically for the *Electron* renderer build only) 404'd against this worker's
   origin. Fixed by pointing `publicDir` explicitly at `src/renderer/public`. Separately, the
   profession/elite-spec Tango icons (`tango-icons.json`, hotlinked from `wiki.guildwars2.com` —
   see the 2026-08-18 tango-icon-switch memory) were blocked outright by `build-preview.html`'s
   CSP, which only allowlisted `https://render.guildwars2.com` for `img-src`; added
   `https://wiki.guildwars2.com` alongside it.
4. **Viewport too narrow.** `.build-editor-grid`'s first two columns (Traits/Equipment) are
   `max-content`-sized (fixed regardless of viewport) and only the 3rd (Stats+Skills, `1fr`)
   absorbs whatever width is left over. At the original 1400px viewport that column collapsed to
   ~280px, forcing `BoonConditionSummaryPanel`'s icon rows to wrap onto dozens of lines each and
   blowing the screenshot's height out past 1800px of mostly dead space below the visible content
   — diagnosed by a one-off `getBoundingClientRect()` dump piped through the same console-tap
   mechanism as #1/#2 (removed after use, unlike the tap itself). Fixed by widening
   `page.setViewport` from 1400 to 1800, giving that column roughly the room a normally-sized
   desktop window would.

None of these were registration/D1/permission problems — Phase 2's infrastructure held up
unchanged; every gap was specific to this new render path.
