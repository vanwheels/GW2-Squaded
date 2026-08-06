import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Party, SquadComp, SquadSlot } from '@shared/types'

interface SquadCompsStore {
  squadComps: SquadComp[]
  loading: boolean
  refresh: () => Promise<void>
  createSquadComp: (squadComp: SquadComp) => Promise<void>
  updateSquadComp: (squadComp: SquadComp) => Promise<void>
  removeSquadComp: (id: string) => Promise<void>
}

const SquadCompsStoreContext = createContext<SquadCompsStore | null>(null)

function blankSlot(): SquadSlot {
  return { buildId: null, ghostPick: null, placeholderLabel: null }
}

export function makeBlankParty(): Party {
  return { slots: [blankSlot(), blankSlot(), blankSlot(), blankSlot(), blankSlot()] }
}

/** Backfills fields absent on records saved before they existed — see `SquadComp.tags`/
 *  `SquadComp.order` doc comments. No storage migration; every read goes through this. */
function normalizeSquadComp(squadComp: SquadComp): SquadComp {
  return {
    ...squadComp,
    tags: squadComp.tags ?? [],
    order: squadComp.order ?? Date.parse(squadComp.createdAt),
    favorite: squadComp.favorite ?? false
  }
}

export function makeBlankSquadComp(): SquadComp {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Squad',
    notes: '',
    parties: [makeBlankParty()],
    createdAt: now,
    updatedAt: now,
    tags: [],
    order: Date.now(),
    favorite: false
  }
}

export function SquadCompsStoreProvider({ children }: { children: ReactNode }) {
  const [squadComps, setSquadComps] = useState<SquadComp[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.gw2Storage.squadComps.list()
      setSquadComps(result.map(normalizeSquadComp).sort((a, b) => a.order - b.order))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createSquadComp = useCallback(
    async (squadComp: SquadComp) => {
      await window.gw2Storage.squadComps.create(squadComp)
      await refresh()
    },
    [refresh]
  )

  const updateSquadComp = useCallback(
    async (squadComp: SquadComp) => {
      await window.gw2Storage.squadComps.update(squadComp)
      await refresh()
    },
    [refresh]
  )

  const removeSquadComp = useCallback(
    async (id: string) => {
      await window.gw2Storage.squadComps.remove(id)
      await refresh()
    },
    [refresh]
  )

  return (
    <SquadCompsStoreContext.Provider
      value={{ squadComps, loading, refresh, createSquadComp, updateSquadComp, removeSquadComp }}
    >
      {children}
    </SquadCompsStoreContext.Provider>
  )
}

export function useSquadCompsStore(): SquadCompsStore {
  const store = useContext(SquadCompsStoreContext)
  if (!store) throw new Error('useSquadCompsStore must be used within a SquadCompsStoreProvider')
  return store
}
