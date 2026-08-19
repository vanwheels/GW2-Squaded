-- Adds the elite specialization a build uses (trait line slot 2, `null` for a core build),
-- derived from the share data the same "never typed by hand" way `profession` already is (see
-- `share-validate.ts`'s `LikelyBuildFields`). Feeds the board list's per-build emoji
-- (`render/board.ts`) — e.g. a Necromancer build running the Reaper line shows Reaper's icon
-- rather than the plain profession one. Existing rows backfill to NULL (core), which just falls
-- back to the profession emoji until the build is next edited with a link that has a spec chosen.
ALTER TABLE builds ADD COLUMN specialization_id INTEGER;
