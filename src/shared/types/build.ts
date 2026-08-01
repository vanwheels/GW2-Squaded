import type { LocalId, Timestamp } from './common'
import type { ProfessionId } from './game-data'

/**
 * A player's chosen major traits for one equipped specialization line.
 * Minor traits are automatically granted and aren't tracked here.
 */
export interface TraitLineSelection {
  specializationId: number
  /** Chosen major trait id for tiers 1-3, in order. `null` = not yet chosen. */
  chosenTraitIds: [number | null, number | null, number | null]
}

/**
 * A build's 3 trait lines, indexed by fixed position (0-2; line 2 is conventionally the elite
 * spec line). `null` = no specialization chosen for that line. Always exactly 3 entries so a
 * line's array index is a stable identity — a picker targeting "line 3" can write `slots[2]`
 * directly without the array shifting when an earlier line is empty.
 */
export type TraitLineSlots = [TraitLineSelection | null, TraitLineSelection | null, TraitLineSelection | null]

export interface StandardSkillSelection {
  kind: 'standard'
  heal: number | null
  utility: [number | null, number | null, number | null]
  elite: number | null
}

/**
 * Revenant's skill mechanic is fundamentally different from every other profession: instead of
 * independently choosing a Heal/Utility/Elite skill, a Revenant equips 2 Legends (by `Legend.id`,
 * see game-data.ts), each of which is a *fixed* kit (its own heal/3 utility/elite skills, not
 * player-selectable) that can be swapped between in combat. `null` = that legend slot not yet
 * chosen.
 */
export interface RevenantSkillSelection {
  kind: 'revenant'
  legends: [string | null, string | null]
  /** Which equipped legend's fixed skill bar is currently displayed in the editor — display-only,
   *  doesn't affect computed boon/condition totals since both legends' kits always contribute. */
  activeLegendIndex: 0 | 1
}

export type SkillSelection = StandardSkillSelection | RevenantSkillSelection

export type EquipmentSlotKey =
  | 'helm'
  | 'shoulders'
  | 'chest'
  | 'gloves'
  | 'leggings'
  | 'boots'
  | 'backpiece'
  | 'accessory1'
  | 'accessory2'
  | 'ring1'
  | 'ring2'
  | 'amulet'
  | 'weaponA1'
  | 'weaponA2'
  | 'weaponB1'
  | 'weaponB2'
  | 'weaponU1'
  | 'weaponU2'

export interface EquipmentSlot {
  itemStatId: number | null
  /** Key into `Profession.weapons` (e.g. `"Greatsword"`). Only meaningful for the 6 weapon slot
   *  keys above — armor/trinket slots never populate this. */
  weaponType?: string | null
  /** Rune id. Only meaningful for the 6 armor slot keys (helm/shoulders/chest/gloves/leggings/
   *  boots) — see `RUNE_SLOT_KEYS` in `src/shared/gear-calc/upgrade-slots.ts`. */
  runeId?: number | null
  /** Sigil ids, one per sigil slot. Only meaningful for weapon slot keys — length matches that
   *  slot's sigil capacity (see `weaponUpgradeCapacity` in upgrade-slots.ts: 2 for a two-handed
   *  weapon, 1 for a one-handed main/off-hand or underwater weapon). */
  sigilIds?: (number | null)[]
  /** Infusion ids, one per infusion slot. Meaningful for every slot key — length matches that
   *  slot's infusion capacity (see `infusionCapacity`/`weaponUpgradeCapacity` in
   *  upgrade-slots.ts). */
  infusionIds?: (number | null)[]
}

/** Whether a build is currently theorycrafted for land or underwater combat — scopes both the
 *  weapon-skill bar and the boon/condition calculator's weapon-derived sources, since a build
 *  can't be in both contexts at once (unlike the land weapon-swap sets, which are both always
 *  equipped — see `Build.activeWeaponSet`). */
export type Environment = 'land' | 'underwater'

/**
 * A theoretical stat build: profession + specialization/trait choices + skills +
 * equipment stat selections. Comparable in scope to a gw2skills.net build link.
 */
export interface Build {
  id: LocalId
  name: string
  notes: string
  profession: ProfessionId
  /** The 3 equipped specialization lines (fixed positions; `null` = not chosen yet). */
  specializations: TraitLineSlots
  skills: SkillSelection
  equipment: Partial<Record<EquipmentSlotKey, EquipmentSlot>>
  /** Exactly 1 relic equipped per build (not per-slot — see `Relic` in game-data.ts). */
  relicId: number | null
  /** At most 1 food and 1 utility consumable active at a time (not per-slot). */
  foodId: number | null
  utilityId: number | null
  environment: Environment
  /** Which land weapon-swap set's skill bar is currently displayed — display-only, both sets'
   *  skills always contribute to boon/condition totals since a player carries both and can swap
   *  anytime (same reasoning as `RevenantSkillSelection.activeLegendIndex`). */
  activeWeaponSet: 'A' | 'B'
  /** Same as `activeWeaponSet`, for the 2 underwater swap sets. */
  activeUnderwaterSet: 'U1' | 'U2'
  /**
   * Ranger only (meaningless, always `[null, null]`/`0`, for every other profession): the 2
   * equipped pets (by `Pet.id`, see game-data.ts) and which one's skill is currently displayed —
   * same "always present, both slots always contribute" shape as
   * `RevenantSkillSelection.legends`/`activeLegendIndex`, but kept as top-level `Build` fields
   * rather than folded into `SkillSelection`: unlike a Revenant's legends, a Ranger's pets are
   * *additive* to its normal Heal/Utility/Elite picks, not a full-kit replacement, so they don't
   * belong in that union.
   */
  equippedPetIds: [number | null, number | null]
  activePetIndex: 0 | 1
  /**
   * Engineer Kits, Firebrand Tomes, and Druid's Celestial Avatar form all temporarily swap the
   * displayed weapon-skill bar (1-5) for their own fixed 5-skill "bundle" while active — this is
   * the id of whichever equipped bundle-capable skill is currently toggled to show that bar, or
   * `null` to show the normal weapon skills. Display-only, same "toggle doesn't gate boon/condition
   * totals" reasoning as `activeWeaponSet`/`activeLegendIndex`/`activePetIndex`: every equipped
   * kit/tome/Celestial-Avatar's skills always contribute regardless of which (if any) is currently
   * shown, since a player can open any of them at will mid-fight. For Engineer, must be one of
   * `skills.utility`'s 3 chosen ids whose `Skill.bundleSkills` is non-null (see
   * `skill-calc/bundle-skills.ts`); for Guardian/Firebrand, one of the 3 Tome ids
   * `skill-calc/profession-mechanic.ts` resolves onto F1/F2/F3; for Ranger/Druid, the fixed
   * Celestial Avatar id itself (Druid's `Profession_5`).
   */
  activeBundleSkillId: number | null
  /**
   * Ranger only (meaningless, always `false`, for every other profession): whether the displayed
   * weapon bar shows the "Unleashed" (empowered) autoattack instead of the normal one — Untamed's
   * profession mechanic swaps *both* the Ranger and the pet between an "Unleashed"/normal state on
   * a 1-second cooldown in real combat (confirmed via the wiki's own Unleash Ranger/Unleash Pet
   * pages 2026-07-30 — this does NOT replace the full weapon bar like a Kit/Tome/Celestial Avatar,
   * only the weapon's own autoattack, i.e. slot 1). Display-only, same "both states always
   * contribute" reasoning as every other toggle on this type — see
   * `skill-calc/untamed-unleash.ts`.
   */
  rangerUnleashed: boolean
  /**
   * Elementalist Evoker only (meaningless, always `null`, for every other build): the chosen
   * familiar (`Familiar.id` in game-data.ts — Fox/Otter/Hare/Toad), set by clicking the F5
   * "Familiar" icon in `ProfessionMechanicBar` (cycles through `gameData.familiars` in order).
   * Determines which of the Heal skill "Rejuvenate"'s 4 identical-effect ids is bound (icon changes
   * to match) and which F5 skill icon is shown (`evokerFamiliarBar` in profession-mechanic.ts). The
   * familiar's own active/passive combat effects aren't modeled — see `Familiar`'s doc comment.
   */
  familiarId: string | null
  /**
   * Elementalist only (meaningless, always `'Fire'`, for every other profession): which attunement's
   * weapon-skill bar (Weapon_1-5) is currently displayed — display-only, same "toggle doesn't gate
   * boon/condition totals" reasoning as `activeWeaponSet`/`activeLegendIndex`/`activePetIndex`,
   * since a real Elementalist cycles through all 4 attunements at will mid-fight and every
   * attunement's skills always contribute regardless of which is shown here. See
   * `weapon-calc/weapon-skills.ts`'s `attunement` parameter.
   */
  activeAttunement: 'Fire' | 'Water' | 'Air' | 'Earth'
  createdAt: Timestamp
  updatedAt: Timestamp
}
