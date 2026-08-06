import { useRef, useState } from 'react'
import { Tooltip, TooltipBody } from '@renderer/components/common/Tooltip'
import { FloatingPanel } from '@renderer/components/common/FloatingPanel'
import { usePickerOpen } from '@renderer/state/picker-registry'
import { middleClickToggle, sortFavoritesFirst } from '@renderer/lib/favorites'
import { readGearDragData, setGearDragData } from './gear-drag-payload'

export interface UpgradeOption<T extends number | string = number> {
  id: T
  name: string
  icon: string
  description?: string
  /**
   * Stats-panel display names (e.g. "Power", "Ferocity", "Concentration" — see
   * `ATTRIBUTE_DISPLAY_NAME` in `attribute-totals.ts`) this option affects, searched by the
   * picker's "#<stat>" filter syntax (2026-08-06, see `UpgradePicker`'s class doc comment). Omit
   * for categories with no attribute data at all (relics) — a "#" search on those just matches
   * nothing, which is correct since relic effects are procs, not stat levers.
   */
  statKeywords?: string[]
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
  /** `badge`-variant size — runes/sigils read as the more important upgrade (`lg`), infusions a
   *  step down (`md`), everything else unchanged (`sm`, the default). No effect on `slot` variant,
   *  which is always the fixed 48px skill-bar size. */
  size?: 'sm' | 'md' | 'lg'
  /** GW2 item-rarity border color for the chosen item, when this category has a single fixed
   *  rarity (e.g. every WvW infusion is Fine tier, every relic is Exotic-tier-but-shown-as-Fine —
   *  see TODO.md's item-rarity-color-coding scoping notes). Omit for categories with no single
   *  confirmed rarity (runes/sigils/food/utility). */
  rarity?: 'ascended' | 'fine'
  /**
   * Opts this picker into the copy/paste feature (2026-07-30): when set, a chosen value can be
   * dragged out of this button, and the button accepts drops from any other picker sharing the
   * same `dragCategory` string, replacing its own chosen value with the dropped one. Used to copy
   * a stat prefix/rune/sigil/infusion from `EquipmentEditor`'s template slots onto any matching
   * gear slot (or between two gear slots directly) without reopening the grid. `T` must be
   * `number` when this is set — every gear-upgrade category's id type, unlike the squad editor's
   * `string` build ids which never set this prop.
   */
  dragCategory?: string
  /** Small icon overlaid in the button's top-left corner — the gw2skills-style equipment-slot or
   *  weapon-type glyph identifying which slot this stat-prefix picker belongs to, since the big
   *  stat-prefix art itself (`option.icon`) doesn't otherwise say "this one's for the Helm". */
  cornerIcon?: string
  /** Art shown in place of the "?" empty-slot glyph when nothing is chosen yet — used for weapon
   *  stat-prefix slots to preview the selected weapon type's silhouette before a stat is picked. */
  emptyIcon?: string
  /**
   * Opts this picker's popover grid into the Favorites feature (2026-08-06): when both are set, a
   * favorited option sorts ahead of every non-favorited one and shows a gold star badge, and
   * middle-clicking any option toggles its favorite status without choosing it. Deliberately only
   * wired up for the Food/Utility pickers (`EquipmentEditor`) so far — favorite state for those is
   * per-install (`useFavoriteConsumables`), not tied to a saved `Build`/`SquadComp` record the way
   * `Build.favorite`/`SquadComp.favorite` are for the Builds/Squads card grids.
   */
  isFavorite?: (id: T) => boolean
  onToggleFavorite?: (id: T) => void
}

/**
 * Shared icon+name+search picker popover for every gear-upgrade category (runes, sigils,
 * infusions, relics, food, utility) plus squad-slot build assignment — all share the same "small
 * badge/slot opens a searchable grid, click an option to choose and close" interaction as the
 * existing skill/legend pickers, just parameterized over a generic `{id, name, icon}` option shape
 * instead of `Skill`/`Legend`. `T` defaults to `number` (every gear-upgrade category's item id);
 * the squad editor instantiates it with `string` (build ids are UUIDs).
 *
 * Search box (2026-08-06) supports two modes, both against the same input, disambiguated by a
 * leading `#`: plain text matches `name` OR `description` (the latter already holds the full
 * tooltip text for every category — runes' bonus lines, sigils'/relics' effect text, food/utility
 * buff text — so a keyword like "Stun" or "Heal" searches the actual tooltip, not just the item
 * name); `#<word>` instead matches only `statKeywords`, the caller-supplied list of stats-panel
 * attribute names (e.g. "Power", "Concentration") this option affects. The `#` mode exists
 * alongside plain search rather than being subsumed by it because `statKeywords` is resolved
 * through this app's own attribute-name conventions (e.g. a rune bonus's raw "+5% Boon Duration"
 * text resolves to "Concentration", matching the Stats panel) and catches bonuses no substring of
 * the tooltip text would ever reveal (e.g. a "+N to All Stats" rune affects Power without the word
 * "Power" appearing anywhere in its text) — see `bonusStatDisplayNames` in `attribute-totals.ts`.
 */
export function UpgradePicker<T extends number | string = number>({
  label,
  options,
  chosenId,
  onChoose,
  variant = 'badge',
  size = 'sm',
  rarity,
  dragCategory,
  cornerIcon,
  emptyIcon,
  isFavorite,
  onToggleFavorite
}: Props<T>) {
  const { open, openThis, close } = usePickerOpen()
  const [search, setSearch] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const chosen = chosenId !== null ? options.find((o) => o.id === chosenId) : undefined
  const query = search.trim().toLowerCase()
  const statQuery = query.startsWith('#') ? query.slice(1).trim() : null
  const filtered =
    statQuery !== null
      ? statQuery === ''
        ? options
        : options.filter((o) => o.statKeywords?.some((k) => k.toLowerCase().includes(statQuery)))
      : query
        ? options.filter((o) => o.name.toLowerCase().includes(query) || o.description?.toLowerCase().includes(query))
        : options
  const ordered = isFavorite ? sortFavoritesFirst(filtered, (o) => isFavorite(o.id)) : filtered

  function choose(id: T | null): void {
    onChoose(id)
    close()
    setSearch('')
  }

  function handleDragStart(e: React.DragEvent): void {
    if (!dragCategory || chosenId === null) return
    setGearDragData(e, { category: dragCategory, id: chosenId as number, name: chosen?.name })
  }

  function handleDrop(e: React.DragEvent): void {
    if (!dragCategory) return
    const payload = readGearDragData(e)
    if (payload && payload.category === dragCategory) {
      e.preventDefault()
      // Prefer resolving by name against this picker's own (already category-scoped) options —
      // the dragged id alone can be wrong for this slot if the two pickers use different id spaces
      // for the same combo name (e.g. an armor/weapon "stat" id dropped onto a trinket slot). Falls
      // back to the raw id when no name match exists here, same as before `name` existed.
      const matched = payload.name ? options.find((o) => o.name === payload.name) : undefined
      onChoose((matched ? matched.id : payload.id) as T)
    }
  }

  const baseClass = variant === 'badge' ? 'upgrade-badge' : 'skill-slot-button'
  const sizeClass = variant === 'badge' && size !== 'sm' ? ` upgrade-badge-${size}` : ''
  const rarityClass = chosen && rarity ? ` rarity-${rarity}` : ''
  const buttonClass = `${baseClass}${sizeClass}${rarityClass}`

  return (
    <div className="upgrade-slot">
      <Tooltip
        content={chosen ? <TooltipBody title={chosen.name} description={chosen.description} /> : <TooltipBody title={label} />}
      >
        <button
          ref={buttonRef}
          type="button"
          className={buttonClass}
          onClick={() => (open ? close() : openThis())}
          draggable={Boolean(dragCategory) && chosenId !== null}
          onDragStart={handleDragStart}
          onDragOver={(e) => dragCategory && e.preventDefault()}
          onDrop={handleDrop}
        >
          {chosen ? (
            chosen.icon ? (
              <img src={chosen.icon} alt={chosen.name} />
            ) : (
              <span className="upgrade-badge-empty">?</span>
            )
          ) : emptyIcon ? (
            <img className="upgrade-badge-placeholder" src={emptyIcon} alt="" />
          ) : (
            <span className={variant === 'badge' ? 'upgrade-badge-empty' : 'skill-slot-placeholder'}>
              {variant === 'slot' ? label : ''}
            </span>
          )}
          {cornerIcon && (chosen || !emptyIcon) && <img className="upgrade-badge-corner" src={cornerIcon} alt="" />}
        </button>
      </Tooltip>
      <FloatingPanel open={open} anchorRef={buttonRef} onClose={close} className="skill-picker">
        <div className="skill-picker-header">{label}</div>
        {options.length > 12 && (
          <input
            type="text"
            className="upgrade-picker-search"
            placeholder="Search… (#stat for Power, Ferocity, …)"
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
          {ordered.map((o) => {
            const favorited = isFavorite?.(o.id) ?? false
            return (
              <Tooltip key={o.id} content={<TooltipBody title={o.name} description={o.description} />}>
                <button
                  type="button"
                  className={chosenId === o.id ? 'skill-option-button chosen' : 'skill-option-button'}
                  onClick={() => choose(o.id)}
                  {...(onToggleFavorite ? middleClickToggle(() => onToggleFavorite(o.id)) : undefined)}
                >
                  {onToggleFavorite && (
                    <span className={favorited ? 'favorite-star is-favorite' : 'favorite-star favorite-star-hint'}>
                      {favorited ? '★' : '☆'}
                    </span>
                  )}
                  {o.icon ? <img src={o.icon} alt={o.name} /> : <span className="skill-option-none">?</span>}
                  <span className="skill-option-name">{o.name}</span>
                </button>
              </Tooltip>
            )
          })}
        </div>
      </FloatingPanel>
    </div>
  )
}
