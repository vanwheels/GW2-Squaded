import { describe, expect, it } from 'vitest'
import { withCurrentSchemaVersion } from './schema-migration'
import { CURRENT_SCHEMA_VERSION } from './schema-version'
import type { Build } from './build'
import type { SquadComp } from './squad-comp'

/**
 * `withCurrentSchemaVersion` is the load-time schema check `normalizeBuild`/`normalizeSquadComp`
 * (renderer/state) run on every persisted read. These fixtures simulate the real old-format case:
 * a record saved before `schemaVersion` existed, which `json-blob-repository.ts` casts straight
 * from parsed JSON to `T` (no `schemaVersion` key present at runtime despite the type requiring
 * one) — the same cast an `as unknown as Build`/`SquadComp` below stands in for.
 */
describe('withCurrentSchemaVersion', () => {
  it('backfills schemaVersion on an old-format (unversioned) Build fixture', () => {
    const legacyBuild = { id: 'legacy-build', name: 'Old Build' } as unknown as Build
    expect(legacyBuild.schemaVersion).toBeUndefined()

    const migrated = withCurrentSchemaVersion(legacyBuild)

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.id).toBe('legacy-build')
  })

  it('backfills schemaVersion on an old-format (unversioned) SquadComp fixture', () => {
    const legacySquadComp = { id: 'legacy-squad', name: 'Old Squad' } as unknown as SquadComp
    expect(legacySquadComp.schemaVersion).toBeUndefined()

    const migrated = withCurrentSchemaVersion(legacySquadComp)

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.id).toBe('legacy-squad')
  })

  it('leaves an already-current schemaVersion untouched', () => {
    const versioned = { id: 'b', schemaVersion: CURRENT_SCHEMA_VERSION } as unknown as Build
    expect(withCurrentSchemaVersion(versioned).schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})
