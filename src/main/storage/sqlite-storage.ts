import Database from 'better-sqlite3'
import type { Build, SquadComp } from '@shared/types'
import type { StorageAdapter } from '@shared/storage/storage-interface'
import { applySchema } from './schema'
import { JsonBlobRepository } from './json-blob-repository'

export function createSqliteStorage(dbPath: string): StorageAdapter {
  const db = new Database(dbPath)
  applySchema(db)

  return {
    builds: new JsonBlobRepository<Build>(db, 'builds'),
    squadComps: new JsonBlobRepository<SquadComp>(db, 'squad_comps')
  }
}
