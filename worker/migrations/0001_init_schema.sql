-- Discord bot board state. Schema as designed in docs/discord-bot.md — see that doc for the
-- reasoning behind each table's shape (normalization choices, why board_messages exists, etc.).

-- One row per guild.
CREATE TABLE guild_settings (
  guild_id             TEXT PRIMARY KEY,
  approval_mode        TEXT NOT NULL DEFAULT 'automatic', -- 'automatic' | 'manual'
  approver_role_id     TEXT,                              -- required if approval_mode = 'manual'
  display_visibility   TEXT NOT NULL DEFAULT 'public',     -- 'public' | 'private'
  approvals_channel_id TEXT                                -- required if approval_mode = 'manual'
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
