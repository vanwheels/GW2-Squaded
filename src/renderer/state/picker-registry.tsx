import { createContext, useContext, useId, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

interface PickerRegistryValue {
  openId: string | null
  setOpenId: Dispatch<SetStateAction<string | null>>
}

const PickerRegistryContext = createContext<PickerRegistryValue | null>(null)

/**
 * Wraps the build editor so every click-to-open picker popover in it — trait specialization,
 * weapon type, gear upgrades (stat/rune/sigil/infusion/relic/food/utility), skill/legend/pet
 * slots, Thief's Stolen Skill — shares a single "which one is open" slot instead of each managing
 * its own local `open` boolean. Confirmed 2026-08-01: having more than one open at once was pure
 * visual clutter, so opening any picker must close whichever other one was open.
 */
export function PickerRegistryProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return <PickerRegistryContext.Provider value={{ openId, setOpenId }}>{children}</PickerRegistryContext.Provider>
}

/**
 * One picker's slice of the shared registry, keyed by a stable per-instance id from `useId`.
 * `openThis` always wins the shared slot (closing any other picker); `close` only clears it if
 * this picker still owns it — so a stale close call (e.g. after the registry already moved on to
 * a different picker) can't accidentally clobber the new owner.
 */
export function usePickerOpen(): { open: boolean; openThis: () => void; close: () => void } {
  const id = useId()
  const ctx = useContext(PickerRegistryContext)
  if (!ctx) throw new Error('usePickerOpen must be used within a PickerRegistryProvider')
  const { openId, setOpenId } = ctx
  const open = openId === id
  return {
    open,
    openThis: () => setOpenId(id),
    close: () => setOpenId((current) => (current === id ? null : current))
  }
}
