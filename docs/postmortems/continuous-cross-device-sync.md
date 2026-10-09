# Continuous Cross-Device Sync — Post-mortem

Shipped 2026-10-09. Third of the 4-milestone web-transition initiative (full plan:
`C:\Users\vanny\.claude\plans\goofy-stirring-nautilus.md`) — client-side tombstone tracking, sync
API client, `useSync` hook, and Settings sign-in UI, all driven against the Worker side Sync
Backend Foundation already shipped.

## What shipped

- `{id, deletedAt}` tombstone retention in both storage layers (SQLite `<table>_tombstones`,
  IndexedDB `<store>_tombstones`), `replaceAll(records, tombstones)` on `Repository<T>`.
- `src/renderer/services/syncApi.ts` (signup/login/push/pull) and `useSync.ts` (mount/online/
  ~5min-poll/~5s-debounce triggers, one shared in-flight run).
- `SyncSection` in Settings — sign up/log in/log out, manual "Sync Now", last-synced time.
- Manual verification across two real sessions (desktop + browser tab): concurrent edit, reorder,
  delete, edit-after-delete resurrection all confirmed working.

## What went well

- Same incremental ChoiceBuds-porting approach as Milestone 2: merge logic, hook shape, and UI
  form all ported with only collection-shape edits, and a code review pass before the manual test
  found no logic issues in `merge.ts`/`useSync.ts`/`applySyncedState`'s replace-wholesale flow.
- `Build.order`/`SquadComp.order` being separate numeric fields from `updatedAt` meant list
  reordering needed no new sync-safety work — confirmed holding, not re-derived from scratch.

## What didn't go well

- The verification pass's first real run surfaced a signup failure (`username_taken` for an
  existing ChoiceBuds username) that traced back to a Milestone 2 mistake: the "Account Routes +
  KV Namespace" leg wired in ChoiceBuds' real, already-existing `SYNC_KV` namespace instead of
  provisioning a new one. Confirmed by reading the live KV data directly — the existing `vanny`
  account record had ChoiceBuds' `Account` shape (`email` field, numeric `createdAt`), not this
  app's. Consequence was more than cosmetic: both apps' tokens lived in the same KV store, so a
  ChoiceBuds-issued token for a username also passed this Worker's own token check for that
  username's `/sync/:username` route. Fixed by provisioning a genuinely new namespace
  (`gw2_squaded_sync_kv`, id `8f470569...`) and repointing `wrangler.toml`; ChoiceBuds' namespace
  and accounts were untouched. See `docs/postmortems/sync-backend-foundation.md`'s corrected "What
  didn't go well" section and commit `5599691`.
- Takeaway: a "wire in the already-existing namespace" step in a leg description deserves a second
  look before being treated as routine — it's exactly the phrasing that should prompt "already
  existing *for this project*, or already existing *from somewhere else*?"

## Scope creep observed

None. The namespace fix was a bug found mid-verification, not a new feature — handled inline
rather than deferred to TODO.md, consistent with "fix what verification surfaces" being in scope
for a verification leg.

## What changes next milestone

Milestone 4 (Polish/Parity) still needs its legs scoped out from the plan doc's milestone-level
description before it becomes current, same as Milestone 3 was before this one started. No
milestone is "current" in TODO.md until that scoping happens.
