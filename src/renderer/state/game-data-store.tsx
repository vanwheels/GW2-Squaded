import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GameData, ProfessionId, Skill, Specialization, Trait } from '@shared/types'

interface GameDataStore extends GameData {
  loading: boolean
  specializationsById: Map<number, Specialization>
  traitsById: Map<number, Trait>
  specializationsForProfession: (profession: ProfessionId) => Specialization[]
  majorTraitsForSpecialization: (specializationId: number) => Trait[]
  minorTraitsForSpecialization: (specializationId: number) => Trait[]
  skillsForProfessionAndSlot: (
    profession: ProfessionId,
    slot: 'Heal' | 'Utility' | 'Elite',
    equippedSpecializationIds: ReadonlySet<number>
  ) => Skill[]
}

const EMPTY_GAME_DATA: GameData = {
  professions: [],
  specializations: [],
  traits: [],
  skills: [],
  itemStats: [],
  eliteSpecSkills: {}
}

const GameDataStoreContext = createContext<GameDataStore | null>(null)

export function GameDataStoreProvider({ children }: { children: ReactNode }) {
  const [gameData, setGameData] = useState<GameData>(EMPTY_GAME_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void window.gw2GameData.getAll().then((result) => {
      if (cancelled) return
      setGameData(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const store = useMemo<GameDataStore>(() => {
    const specializationsById = new Map(gameData.specializations.map((s) => [s.id, s]))
    const traitsById = new Map(gameData.traits.map((t) => [t.id, t]))

    return {
      ...gameData,
      loading,
      specializationsById,
      traitsById,
      specializationsForProfession: (profession) =>
        gameData.specializations.filter((s) => s.profession === profession),
      majorTraitsForSpecialization: (specializationId) =>
        gameData.traits
          .filter((t) => t.specializationId === specializationId && t.slot === 'Major')
          .sort((a, b) => a.tier - b.tier || a.order - b.order),
      minorTraitsForSpecialization: (specializationId) =>
        gameData.traits
          .filter((t) => t.specializationId === specializationId && t.slot === 'Minor')
          .sort((a, b) => a.tier - b.tier),
      skillsForProfessionAndSlot: (profession, slot, equippedSpecializationIds) =>
        gameData.skills.filter((s) => {
          if (s.slot !== slot || !s.professions.includes(profession)) return false
          const requiredSpecId = gameData.eliteSpecSkills[s.id]
          return requiredSpecId === undefined || equippedSpecializationIds.has(requiredSpecId)
        })
    }
  }, [gameData, loading])

  return <GameDataStoreContext.Provider value={store}>{children}</GameDataStoreContext.Provider>
}

export function useGameData(): GameDataStore {
  const store = useContext(GameDataStoreContext)
  if (!store) throw new Error('useGameData must be used within a GameDataStoreProvider')
  return store
}
