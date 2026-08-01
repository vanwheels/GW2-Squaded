export type SlotIconKind =
  | 'helm'
  | 'shoulders'
  | 'chest'
  | 'gloves'
  | 'leggings'
  | 'boots'
  | 'back'
  | 'accessory'
  | 'ring'
  | 'amulet'

interface Props {
  kind: SlotIconKind
}

/**
 * Equipment-slot icons, used with permission from gw2skills.net (see Settings > Credits).
 * Cropped from their `ui-ico-armor-56x56.v5.png` sprite sheet.
 */
export function SlotTypeIcon({ kind }: Props) {
  return <img className="gear-slot-type-icon" src={`/icons/equip-slot/${kind}.png`} alt="" />
}
