import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Consumable,
  Familiar,
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
import { GUNSABER_SKILLS } from '@shared/skill-calc/gunsaber-skills'
import { DRAGON_SLASH_RIVERS_FLOW_SKILLS, DRAGON_SLASH_SHARP_AS_THE_WIND_SKILLS, DRAGON_SLASH_SKILLS } from '@shared/skill-calc/dragon-slash-skills'
import type { GameDataProvider } from '@shared/game-data/game-data-provider'

export interface GameDataStore extends GameData {
  loading: boolean
  specializationsById: Map<number, Specialization>
  traitsById: Map<number, Trait>
  skillsById: Map<number, Skill>
  legendsById: Map<string, Legend>
  petsById: Map<number, Pet>
  familiarsById: Map<string, Familiar>
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
    equippedSpecializationIds: ReadonlySet<number>,
    selectedFamiliarId?: string | null,
    chosenTraitIds?: ReadonlySet<number>
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
  itemStatLegalIds: { armorWeapon: [], trinket: [] },
  eliteSpecSkills: {},
  glyphFormVariants: {},
  skillVariantExclusions: [],
  wvwFactOverrides: { skill: {}, trait: {} },
  legends: [],
  pets: [],
  familiars: [],
  soulbeastBeastmode: {},
  runes: [],
  sigils: [],
  infusions: [],
  relics: [],
  relicEffects: {},
  food: [],
  utility: [],
  tomeChapters: {}
}

const GameDataStoreContext = createContext<GameDataStore | null>(null)

interface Props {
  children: ReactNode
  /** `@shared/game-data/game-data-provider.ts`'s `GameDataProvider` seam, per its own doc
   *  comment: "a future Capacitor build implements this against bundled assets instead of
   *  Electron IPC, and the renderer code doesn't change." Required (not defaulted to the
   *  Electron-only `window.gw2GameData` bridge here) so this file stays platform-agnostic — the
   *  Electron app's `App.tsx` passes `window.gw2GameData` explicitly; the Discord bot's
   *  web-preview render page (`src/web-preview/`) is the first other caller, passing a
   *  `fetch`-based provider instead since it runs in a plain browser tab with no Electron IPC. */
  provider: GameDataProvider
}

export function GameDataStoreProvider({ children, provider }: Props) {
  const [gameData, setGameData] = useState<GameData>(EMPTY_GAME_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void provider.getAll().then((result) => {
      if (cancelled) return
      setGameData(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [provider])

  const store = useMemo<GameDataStore>(() => {
    const specializationsById = new Map(gameData.specializations.map((s) => [s.id, s]))
    const traitsById = new Map(gameData.traits.map((t) => [t.id, t]))
    // Bladesworn's Gunsaber weapon-bar skills and Dragon Slash bundle skills don't exist in the
    // public API at all (see `gunsaber-skills.ts`/`dragon-slash-skills.ts`'s own doc comments) —
    // merged in here so every normal consumer of `skillsById` works unmodified, same as any other
    // skill.
    const skillsById = new Map(
      [...gameData.skills, ...GUNSABER_SKILLS, ...DRAGON_SLASH_SKILLS, ...DRAGON_SLASH_SHARP_AS_THE_WIND_SKILLS, ...DRAGON_SLASH_RIVERS_FLOW_SKILLS].map((s) => [
        s.id,
        s
      ])
    )
    const legendsById = new Map(gameData.legends.map((l) => [l.id, l]))
    const petsById = new Map(gameData.pets.map((p) => [p.id, p]))
    const familiarsById = new Map(gameData.familiars.map((f) => [f.id, f]))
    const familiarIdBySkillId = new Map(gameData.familiars.map((f) => [f.rejuvenateSkillId, f.id]))
    const runesById = new Map(gameData.runes.map((r) => [r.id, r]))
    const sigilsById = new Map(gameData.sigils.map((s) => [s.id, s]))
    const infusionsById = new Map(gameData.infusions.map((i) => [i.id, i]))
    const relicsById = new Map(gameData.relics.map((r) => [r.id, r]))
    const foodById = new Map(gameData.food.map((f) => [f.id, f]))
    const utilityById = new Map(gameData.utility.map((u) => [u.id, u]))
    const skillVariantExclusionIds = new Set(gameData.skillVariantExclusions)

    return {
      ...gameData,
      loading,
      specializationsById,
      traitsById,
      skillsById,
      legendsById,
      petsById,
      familiarsById,
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
      skillsForProfessionAndSlot: (
        profession,
        slot,
        equippedSpecializationIds,
        selectedFamiliarId = null,
        chosenTraitIds = new Set()
      ) =>
        visibleSkillsForSlot(
          gameData.skills.filter((s) => {
            if (s.slot !== slot || !s.professions.includes(profession)) return false
            const requiredSpecId = gameData.eliteSpecSkills[s.id]
            return requiredSpecId === undefined || equippedSpecializationIds.has(requiredSpecId)
          }),
          equippedSpecializationIds,
          gameData.glyphFormVariants,
          skillVariantExclusionIds,
          familiarIdBySkillId,
          selectedFamiliarId,
          chosenTraitIds
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
