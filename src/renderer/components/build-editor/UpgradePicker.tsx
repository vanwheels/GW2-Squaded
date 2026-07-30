import { useState } from 'react'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'

export interface UpgradeOption<T extends number | string = number> {
  id: T
  name: string
  icon: string
  description?: string
}

interface Props<T extends number | string = number> {
  label: string
  options: UpgradeOption<T>[]
  chosenId: T | null
  onChoose: (id: T | null) => void
  /** `badge` is a small circular button for a per-item upgrade slot (rune/sigil/infusion),
   *  reusing the equipment paperdoll's visual density. `slot` is the larger square skill-bar-
   *  style button used for the build-level relic/food/utility picks. */
  variant?: 'badge' | 'slot'
  /** GW2 item-rarity border color for the chosen item, when this category has a single fixed
   *  rarity (e.g. every WvW infusion is Fine tier, every relic is Exotic-tier-but-shown-as-Fine —
   *  see TODO.md's item-rarity-color-coding scoping notes). Omit for categories with no single
   *  confirmed rarity (runes/sigils/food/utility). */
  rarity?: 'ascended' | 'fine'
}

/**
 * Shared icon+name+search picker popover for every gear-upgrade category (runes, sigils,
 * infusions, relics, food, utility) plus squad-slot build assignment — all share the same "small
 * badge/slot opens a searchable grid, click an option to choose and close" interaction as the
 * existing skill/legend pickers, just parameterized over a generic `{id, name, icon}` option shape
 * instead of `Skill`/`Legend`. `T` defaults to `number` (every gear-upgrade category's item id);
 * the squad editor instantiates it with `string` (build ids are UUIDs).
 */
export function UpgradePicker<T extends number | string = number>({
  label,
  options,
  chosenId,
  onChoose,
  variant = 'badge',
  rarity
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const chosen = chosenId !== null ? options.find((o) => o.id === chosenId) : undefined
  const query = search.trim().toLowerCase()
  const filtered = query ? options.filter((o) => o.name.toLowerCase().includes(query)) : options

  function choose(id: T | null): void {
    onChoose(id)
    setOpen(false)
    setSearch('')
  }

  const baseClass = variant === 'badge' ? 'upgrade-badge' : 'skill-slot-button'
  const buttonClass = chosen && rarity ? `${baseClass} rarity-${rarity}` : baseClass

  return (
    <div className="upgrade-slot">
      <Tooltip
        content={chosen ? <TooltipBody title={chosen.name} description={chosen.description} /> : <TooltipBody title={label} />}
      >
        <button type="button" className={buttonClass} onClick={() => setOpen(!open)}>
          {chosen ? (
            <img src={chosen.icon} alt={chosen.name} />
          ) : (
            <span className={variant === 'badge' ? 'upgrade-badge-empty' : 'skill-slot-placeholder'}>
              {variant === 'slot' ? label : ''}
            </span>
          )}
        </button>
      </Tooltip>
      {open && (
        <div className="skill-picker upgrade-picker-popover">
          <div className="skill-picker-header">{label}</div>
          {options.length > 12 && (
            <input
              type="text"
              className="upgrade-picker-search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          )}
          <div className="skill-picker-grid">
            <button
              type="button"
              className={chosenId === null ? 'skill-option-button chosen' : 'skill-option-button'}
              onClick={() => choose(null)}
            >
              <span className="skill-option-none">—</span>
              <span className="skill-option-name">None</span>
            </button>
            {filtered.map((o) => (
              <Tooltip key={o.id} content={<TooltipBody title={o.name} description={o.description} />}>
                <button
                  type="button"
                  className={chosenId === o.id ? 'skill-option-button chosen' : 'skill-option-button'}
                  onClick={() => choose(o.id)}
                >
                  <img src={o.icon} alt={o.name} />
                  <span className="skill-option-name">{o.name}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
