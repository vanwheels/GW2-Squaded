# Sync Backend Foundation — Post-mortem

Shipped 2026-10-08. Second of the 4-milestone web-transition initiative (full plan:
`C:\Users\vanny\.claude\plans\goofy-stirring-nautilus.md`) — account + sync API on the existing
`gw2-squaded-share` Worker, no client wiring yet (Milestone 3).

## What shipped

- `worker/src/crypto.ts`/`merge.ts` — ported from ChoiceBuds unchanged except `merge.ts`'s
  `updatedAt: number` → `Timestamp` (ISO 8601 string), with 28 ported/adapted unit tests.
- `worker/src/sync-types.ts` — `SyncPayload` (`builds`/`buildTombstones`/`squadComps`/
  `squadCompTombstones`, `savedAt`), no singleton like ChoiceBuds' `playerProfile`.
- `POST /signup`, `POST /login` — real username + password accounts, server-issued opaque bearer
  token, only the token's hash stored. New `SYNC_KV` namespace for account/token/lockout state.
- `PUT|GET /sync/:username` — new `gw2-squaded-sync` R2 bucket for the per-account sync blob.
  Bearer-token auth, per-account write throttle via R2 `customMetadata`, merge via
  `mergeCollection`. No legacy-KV-blob fallback (unlike ChoiceBuds) since this was a new feature,
  not a migration.

## What went well

- Incremental, leg-by-leg porting off ChoiceBuds' already-shipped, already-tested implementation
  meant each leg landed clean — crypto/merge logic needed zero changes beyond the `Timestamp` type
  swap, and the account/sync routes ported with only the collection-shape and type-guard edits
  `SyncPayload`'s own shape required.
- The manual round-trip test (signup → push → push overlapping payload → GET) caught nothing wrong
  on the first run — the ported merge/throttle logic behaved identically to ChoiceBuds' own tested
  behavior.

## What didn't go well

- **Correction (found during Milestone 3, 2026-10-09):** the `SYNC_KV` binding added here did not
  create a fresh namespace — it reused ChoiceBuds' real, already-existing `SYNC_KV` namespace id,
  so both apps' accounts/tokens lived in the same KV store (a ChoiceBuds-issued token for a
  username also passed this Worker's token check for that username). Not caught at the time
  because the manual round-trip test below used usernames that happened not to collide. Fixed in
  Milestone 3; see `docs/postmortems/continuous-cross-device-sync.md`. `wrangler r2 bucket create`
  and the R2 binding were unaffected — those were a genuinely new, correctly-isolated bucket.

## Scope creep observed

None — each leg stayed to its own single porting decision (crypto+merge, then account routes,
then sync routes+bucket).

## What changes next milestone

Milestone 3 (Continuous Cross-Device Sync) is the first of the four that touches live client
code paths (`builds-store.tsx`/`squad-comps-store.tsx`, both storage adapters) rather than only
the Worker — its legs need to be scoped out from the plan doc's milestone-level description before
it becomes the current milestone, the same way Milestone 1's four legs were scoped before that
milestone started.
