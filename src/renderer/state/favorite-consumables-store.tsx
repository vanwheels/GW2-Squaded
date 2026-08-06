import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface FavoriteConsumableIds {
  food: number[]
  utility: number[]
}

const DEFAULT_FAVORITES: FavoriteConsumableIds = { food: [], utility: [] }

const STORAGE_KEY = 'gw2squaded.favoriteConsumables'

function loadFavorites(): FavoriteConsumableIds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FAVORITES
    const parsed = JSON.parse(raw) as Partial<FavoriteConsumableIds>
    return { food: parsed.food ?? [], utility: parsed.utility ?? [] }
  } catch {
    return DEFAULT_FAVORITES
  }
}

interface FavoriteConsumablesValue {
  isFoodFavorite: (id: number) => boolean
  isUtilityFavorite: (id: number) => boolean
  toggleFoodFavorite: (id: number) => void
  toggleUtilityFavorite: (id: number) => void
}

const FavoriteConsumablesContext = createContext<FavoriteConsumablesValue | null>(null)

/**
 * Favorited food/utility catalog item ids — like `AppSettingsProvider`, plain `localStorage`, not
 * `gw2Storage`'s SQLite tables: food/utility are the shared game-data catalog (`useGameData`), not
 * a per-build or per-squad record, so "favorite" here is a per-install UI preference (which items
 * to always show first in the picker grid — `EquipmentEditor`'s Food/Utility `UpgradePicker`s) with
 * nothing to save/share/round-trip. See `renderer/lib/favorites.ts`'s `sortFavoritesFirst`.
 */
export function FavoriteConsumablesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteConsumableIds>(loadFavorites)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  }, [favorites])

  function toggle(kind: keyof FavoriteConsumableIds, id: number): void {
    setFavorites((prev) => {
      const set = new Set(prev[kind])
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...prev, [kind]: [...set] }
    })
  }

  const value: FavoriteConsumablesValue = {
    isFoodFavorite: (id) => favorites.food.includes(id),
    isUtilityFavorite: (id) => favorites.utility.includes(id),
    toggleFoodFavorite: (id) => toggle('food', id),
    toggleUtilityFavorite: (id) => toggle('utility', id)
  }

  return <FavoriteConsumablesContext.Provider value={value}>{children}</FavoriteConsumablesContext.Provider>
}

export function useFavoriteConsumables(): FavoriteConsumablesValue {
  const ctx = useContext(FavoriteConsumablesContext)
  if (!ctx) throw new Error('useFavoriteConsumables must be used within a FavoriteConsumablesProvider')
  return ctx
}
