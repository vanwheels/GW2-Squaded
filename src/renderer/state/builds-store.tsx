import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Build } from '@shared/types'

interface BuildsStore {
  builds: Build[]
  loading: boolean
  refresh: () => Promise<void>
  createDummyBuild: () => Promise<void>
  removeBuild: (id: string) => Promise<void>
}

const BuildsStoreContext = createContext<BuildsStore | null>(null)

function makeDummyBuild(): Build {
  const now = new Date().toISOString()
  const ordinal = Math.floor(Math.random() * 1000)
  return {
    id: crypto.randomUUID(),
    name: `Untitled Build ${ordinal}`,
    notes: '',
    profession: 'Guardian',
    specializations: [],
    skills: { heal: null, utility: [null, null, null], elite: null },
    equipment: {},
    createdAt: now,
    updatedAt: now
  }
}

export function BuildsStoreProvider({ children }: { children: ReactNode }) {
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.gw2Storage.builds.list()
      setBuilds(result)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createDummyBuild = useCallback(async () => {
    await window.gw2Storage.builds.create(makeDummyBuild())
    await refresh()
  }, [refresh])

  const removeBuild = useCallback(
    async (id: string) => {
      await window.gw2Storage.builds.remove(id)
      await refresh()
    },
    [refresh]
  )

  return (
    <BuildsStoreContext.Provider value={{ builds, loading, refresh, createDummyBuild, removeBuild }}>
      {children}
    </BuildsStoreContext.Provider>
  )
}

export function useBuildsStore(): BuildsStore {
  const store = useContext(BuildsStoreContext)
  if (!store) throw new Error('useBuildsStore must be used within a BuildsStoreProvider')
  return store
}
