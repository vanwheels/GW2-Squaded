import { CURRENT_SCHEMA_VERSION } from './schema-version'

/**
 * The load-time schema check `normalizeBuild`/`normalizeSquadComp` (renderer/state) run on every
 * persisted read, including a post-sync refresh. Records saved before `schemaVersion` existed have
 * no such field at runtime despite the type requiring it (`json-blob-repository.ts`'s `list`/`get`
 * cast parsed JSON straight to `T`) — treated as already-current rather than rejected, since v1
 * added only the field itself, no shape change. An already-versioned record's `schemaVersion` is
 * left untouched; this is the hook a future shape change's migration branch keys off of, not a
 * replacement for one.
 */
export function withCurrentSchemaVersion<T extends { schemaVersion: number }>(record: T): T {
  return { ...record, schemaVersion: record.schemaVersion ?? CURRENT_SCHEMA_VERSION }
}
