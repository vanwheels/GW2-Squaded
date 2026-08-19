import type { Build, EquipmentSlotKey } from '@shared/types'
import { useGameData } from '@renderer/state/game-data-store'
import { useAppSettings } from '@renderer/state/app-settings-store'
import { UpgradePicker, type UpgradeOption } from './UpgradePicker'
import { AQUATIC_ONLY_WEAPON_NAMES, chooseSingleWeapon, weaponMiniIcon, weaponOptionsFor, weaponPairHandlers } from './weapon-slot-logic'

interface Props {
  build: Build
  onEquipmentChange: (equipment: Build['equipment']) => void
}

function toIconOptions(entries: [string, unknown][], isAquatic: boolean): UpgradeOption<string>[] {
  return entries.map(([name]) => ({ id: name, name, icon: weaponMiniIcon(name, isAquatic) ?? '' }))
}

/**
 * gw2skills.net-style top strip for weapon-*type* selection (2026-08-19), replacing an earlier
 * attempt to fold weapon type into a small badge overlaid on `EquipmentEditor`'s stat-prefix slot
 * — confirmed unintuitive and hard to click, whereas this bar/tab shape is the one interaction
 * gw2skills.net users already know from that reference site. Rendered in its own
 * `.build-editor-top-cell`, aligned via the shared `.build-editor-grid` directly above the
 * Equipment column below it (see `BuildEditorView`'s JSX comment on that grid) — Weapon I/II (and
 * the Underwater sets, when that Settings toggle is on) are always shown here regardless of which
 * one `EquipmentEditor`'s own land/underwater toggle currently has expanded below, matching
 * gw2skills' own bar. `EquipmentEditor`'s Weapon panel keeps only stat/sigil/infusion editing now;
 * weapon type is set exclusively from here (`weaponPairHandlers`/`chooseSingleWeapon`, shared so
 * both apply the identical two-handed-mirroring rule).
 */
export function WeaponTypeBar({ build, onEquipmentChange }: Props) {
  const { professions } = useGameData()
  const { showUnderwater } = useAppSettings()
  const profession = professions.find((p) => p.id === build.profession)
  const equipment = build.equipment

  function weaponSet(title: string, mainKey: EquipmentSlotKey, offKey: EquipmentSlotKey) {
    const mainOptions = weaponOptionsFor(
      profession,
      (name, w) => (w.flags.includes('Mainhand') || w.flags.includes('TwoHand')) && !AQUATIC_ONLY_WEAPON_NAMES.has(name)
    )
    const offOptions = weaponOptionsFor(profession, (_name, w) => w.flags.includes('Offhand'))
    const { mainSlot, offSlot, isTwoHanded, chooseMain, chooseOff } = weaponPairHandlers(
      profession,
      equipment,
      onEquipmentChange,
      mainKey,
      offKey
    )
    return (
      <div className="weapon-type-bar-set" key={title}>
        <span className="weapon-type-bar-title">{title}</span>
        <UpgradePicker
          label="Main hand"
          options={toIconOptions(mainOptions, false)}
          chosenId={mainSlot?.weaponType ?? null}
          onChoose={chooseMain}
          variant="badge"
          size="lg"
        />
        {isTwoHanded ? (
          <span className="weapon-type-bar-locked">2H</span>
        ) : (
          <UpgradePicker
            label="Off hand"
            options={toIconOptions(offOptions, false)}
            chosenId={offSlot?.weaponType ?? null}
            onChoose={chooseOff}
            variant="badge"
            size="lg"
          />
        )}
      </div>
    )
  }

  function underwaterSet(title: string, key: EquipmentSlotKey) {
    const options = weaponOptionsFor(profession, (_name, w) => w.flags.includes('Aquatic'))
    return (
      <div className="weapon-type-bar-set" key={title}>
        <span className="weapon-type-bar-title">{title}</span>
        <UpgradePicker
          label={title}
          options={toIconOptions(options, true)}
          chosenId={equipment[key]?.weaponType ?? null}
          onChoose={chooseSingleWeapon(equipment, onEquipmentChange, key)}
          variant="badge"
          size="lg"
        />
      </div>
    )
  }

  return (
    <div className="weapon-type-bar">
      {weaponSet('Weapon I', 'weaponA1', 'weaponA2')}
      {weaponSet('Weapon II', 'weaponB1', 'weaponB2')}
      {showUnderwater && (
        <>
          {underwaterSet('Underwater 1', 'weaponU1')}
          {underwaterSet('Underwater 2', 'weaponU2')}
        </>
      )}
    </div>
  )
}
