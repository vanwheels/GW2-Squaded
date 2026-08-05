import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Build } from '@shared/types'

interface BuildsStore {
  builds: Build[]
  loading: boolean
  refresh: () => Promise<void>
  createBuild: (build: Build) => Promise<void>
  updateBuild: (build: Build) => Promise<void>
  removeBuild: (id: string) => Promise<void>
}

const BuildsStoreContext = createContext<BuildsStore | null>(null)

/** Backfills fields absent on records saved before they existed — see `Build.tags`/`Build.order`
 *  doc comments. No storage migration; every read goes through this. */
function normalizeBuild(build: Build): Build {
  return { ...build, tags: build.tags ?? [], order: build.order ?? Date.parse(build.createdAt) }
}

export function makeBlankBuild(): Build {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Build',
    notes: '',
    profession: 'Guardian',
    specializations: [null, null, null],
    skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: null },
    equipment: {},
    relicId: null,
    foodId: null,
    utilityId: null,
    environment: 'land',
    activeWeaponSet: 'A',
    activeUnderwaterSet: 'U1',
    equippedPetIds: [null, null],
    activePetIndex: 0,
    activeBundleSkillId: null,
    rangerUnleashed: false,
    familiarId: null,
    activeAttunement: 'Fire',
    thiefStolenSkillId: null,
    vindicatorAspectFlipped: false,
    createdAt: now,
    updatedAt: now,
    tags: [],
    order: Date.now()
  }
}

export function BuildsStoreProvider({ children }: { children: ReactNode }) {
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.gw2Storage.builds.list()
      setBuilds(result.map(normalizeBuild).sort((a, b) => a.order - b.order))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createBuild = useCallback(
    async (build: Build) => {
      await window.gw2Storage.builds.create(build)
      await refresh()
    },
    [refresh]
  )

  const updateBuild = useCallback(
    async (build: Build) => {
      await window.gw2Storage.builds.update(build)
      await refresh()
    },
    [refresh]
  )

  const removeBuild = useCallback(
    async (id: string) => {
      await window.gw2Storage.builds.remove(id)
      await refresh()
    },
    [refresh]
  )

  return (
    <BuildsStoreContext.Provider value={{ builds, loading, refresh, createBuild, updateBuild, removeBuild }}>
      {children}
    </BuildsStoreContext.Provider>
  )
}

export function useBuildsStore(): BuildsStore {
  const store = useContext(BuildsStoreContext)
  if (!store) throw new Error('useBuildsStore must be used within a BuildsStoreProvider')
  return store
}
