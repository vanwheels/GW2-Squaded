import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Consumable,
  GameData,
  Infusion,
  Legend,
  Pet,
  ProfessionId,
  Relic,
  Rune,
  Sigil,
  Skill,
  Specialization,
  Trait
} from '@shared/types'
import { visibleSkillsForSlot } from '@shared/skill-calc/skill-variants'

export interface GameDataStore extends GameData {
  loading: boolean
  specializationsById: Map<number, Specialization>
  traitsById: Map<number, Trait>
  skillsById: Map<number, Skill>
  legendsById: Map<string, Legend>
  petsById: Map<number, Pet>
  runesById: Map<number, Rune>
  sigilsById: Map<number, Sigil>
  infusionsById: Map<number, Infusion>
  relicsById: Map<number, Relic>
  foodById: Map<number, Consumable>
  utilityById: Map<number, Consumable>
  specializationsForProfession: (profession: ProfessionId) => Specialization[]
  majorTraitsForSpecialization: (specializationId: number) => Trait[]
  minorTraitsForSpecialization: (specializationId: number) => Trait[]
  skillsForProfessionAndSlot: (
    profession: ProfessionId,
    slot: 'Heal' | 'Utility' | 'Elite',
    equippedSpecializationIds: ReadonlySet<number>
  ) => Skill[]
  /** Legends available given the currently-equipped specialization lines: the 4 core legends
   *  always, plus any elite-spec-gated legend whose specialization is equipped. */
  legendsForSpecializations: (equippedSpecializationIds: ReadonlySet<number>) => Legend[]
}

const EMPTY_GAME_DATA: GameData = {
  professions: [],
  specializations: [],
  traits: [],
  skills: [],
  itemStats: [],
  itemStatIcons: {},
  eliteSpecSkills: {},
  wvwFactOverrides: { skill: {}, trait: {} },
  legends: [],
  pets: [],
  runes: [],
  sigils: [],
  infusions: [],
  relics: [],
  relicEffects: {},
  food: [],
  utility: []
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
    const skillsById = new Map(gameData.skills.map((s) => [s.id, s]))
    const legendsById = new Map(gameData.legends.map((l) => [l.id, l]))
    const petsById = new Map(gameData.pets.map((p) => [p.id, p]))
    const runesById = new Map(gameData.runes.map((r) => [r.id, r]))
    const sigilsById = new Map(gameData.sigils.map((s) => [s.id, s]))
    const infusionsById = new Map(gameData.infusions.map((i) => [i.id, i]))
    const relicsById = new Map(gameData.relics.map((r) => [r.id, r]))
    const foodById = new Map(gameData.food.map((f) => [f.id, f]))
    const utilityById = new Map(gameData.utility.map((u) => [u.id, u]))

    return {
      ...gameData,
      loading,
      specializationsById,
      traitsById,
      skillsById,
      legendsById,
      petsById,
      runesById,
      sigilsById,
      infusionsById,
      relicsById,
      foodById,
      utilityById,
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
        visibleSkillsForSlot(
          gameData.skills.filter((s) => {
            if (s.slot !== slot || !s.professions.includes(profession)) return false
            const requiredSpecId = gameData.eliteSpecSkills[s.id]
            return requiredSpecId === undefined || equippedSpecializationIds.has(requiredSpecId)
          }),
          equippedSpecializationIds
        ),
      legendsForSpecializations: (equippedSpecializationIds) =>
        gameData.legends.filter(
          (l) => l.specializationId === null || equippedSpecializationIds.has(l.specializationId)
        )
    }
  }, [gameData, loading])

  return <GameDataStoreContext.Provider value={store}>{children}</GameDataStoreContext.Provider>
}

export function useGameData(): GameDataStore {
  const store = useContext(GameDataStoreContext)
  if (!store) throw new Error('useGameData must be used within a GameDataStoreProvider')
  return store
}
