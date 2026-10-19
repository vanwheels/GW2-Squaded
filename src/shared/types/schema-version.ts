/**
 * Current persisted-data shape version for `Build`/`SquadComp` records. Covers both the SQLite
 * `data` blob columns (`json-blob-repository.ts`) and sync payloads — the Worker's `SyncPayload`
 * treats both collections as opaque `HasIdAndUpdatedAt` blobs (`worker/src/sync-types.ts`), so
 * `schemaVersion` travels through sync as just another field with no worker-side mirror needed.
 *
 * Bump this and add a migration branch in `normalizeBuild`/`normalizeSquadComp` (the load-time
 * check every `list()` read already goes through) whenever either type's shape changes in a way
 * that needs more than an `?? default`. Records saved before this field existed have no
 * `schemaVersion` at all; they're treated as already-current, since no shape change has happened
 * yet between "field absent" and v1.
 */
export const CURRENT_SCHEMA_VERSION = 1
