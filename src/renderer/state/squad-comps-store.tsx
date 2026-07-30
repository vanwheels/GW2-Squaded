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
  return { buildId: null, placeholderLabel: null }
}

export function makeBlankParty(name: string): Party {
  return { name, slots: [blankSlot(), blankSlot(), blankSlot(), blankSlot(), blankSlot()] }
}

export function makeBlankSquadComp(): SquadComp {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Squad',
    notes: '',
    parties: [makeBlankParty('Party 1')],
    createdAt: now,
    updatedAt: now
  }
}

export function SquadCompsStoreProvider({ children }: { children: ReactNode }) {
  const [squadComps, setSquadComps] = useState<SquadComp[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.gw2Storage.squadComps.list()
      setSquadComps(result)
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
