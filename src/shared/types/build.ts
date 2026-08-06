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
 * Returns `build` unchanged, or a shallow copy forced to `environment: 'land'` — the single seam
 * every display/calc call site uses to respect the Settings "Show underwater equipment & skills"
 * toggle (`useAppSettings().showUnderwater`, off by default) without needing its own
 * underwater-awareness: since `environment`'s doc comment above already says it alone scopes both
 * the weapon-skill bar and the boon/condition calculator's weapon-derived sources, forcing it to
 * `'land'` here reproduces "nothing equipped underwater" everywhere that matters, even for a build
 * that was saved with `environment: 'underwater'` before the toggle was turned off. Never use this
 * on a build about to be persisted (`onSave`/`onSaveBuild` etc.) — display/calc only, or a real
 * underwater build's own environment gets silently clobbered on save.
 */
export function withUnderwaterSetting(build: Build, showUnderwater: boolean): Build {
  return showUnderwater ? build : { ...build, environment: 'land' }
}

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
   * Revenant Vindicator only (meaningless, always `false`, for every other build): whether the
   * displayed Heal/Utility/Elite bar shows Legend7 (Legendary Alliance)'s "Aspect of Saint Viktor"
   * skills instead of its default "Aspect of the Archemorus" ones — live-verified 2026-08-04
   * against the wiki's own "Alliance Tactics" page (F3, "Swap your Legendary Alliance Stance
   * skills", 3s recharge): unlike every other Legend's `flipSkill` pairs (an on/release pair
   * touching one slot, shown as a stacked icon — see `multi-effect.ts`'s `flipTargetSkills`),
   * Legend7's heal +
   * all 3 utilities + elite each carry a `flipSkill` to a wholly different-named skill
   * *simultaneously*, the same "hit a button, the whole kit's display swaps" shape as a Kit/Tome/
   * Celestial Avatar toggling the weapon bar (`activeBundleSkillId`) rather than a stacked variant
   * — see `skill-calc/vindicator-aspect.ts`. Toggled by clicking the hand-injected "Alliance
   * Tactics" F3 mechanic-bar icon (`profession-mechanic.ts`'s `VINDICATOR_MECHANIC_SKILLS`).
   * Display-only, same "both states always contribute" reasoning as every other toggle on this
   * type — `boon-calc/sources.ts`'s `withFlipChain` already folds both aspects' boon/condition
   * sources into Legendary-Alliance builds' totals regardless of which is shown here (fixed
   * Session 31, before this toggle existed).
   */
  vindicatorAspectFlipped: boolean
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
  /**
   * Elementalist Weaver only (specialization id 56; `null` for every other build, including every
   * other Elementalist form): the second, "previous" attunement Weaver tracks alongside
   * `activeAttunement` ("current") — weapon skills 1-2 come from `activeAttunement`, 4-5 come from
   * this field, and weapon skill 3 is a "Dual Attack" determined by the unordered pair of the two
   * (order doesn't matter — Fire+Water and Water+Fire are the same skill; attuning to the same
   * element twice, e.g. Fire+Fire, gives the normal single-attunement skill 3). Display-only, same
   * "toggle doesn't gate boon/condition totals" reasoning as `activeAttunement` itself — a real
   * Weaver reaches every current/previous combo at will, so `boon-calc/sources.ts` unions all of
   * them into totals regardless of which pair is shown here. Has no toggle of its own: set as a
   * side effect of clicking `ProfessionMechanicBar`'s existing F1-F4 row that sets
   * `activeAttunement`/"current" — every click there also demotes whatever `activeAttunement` was
   * a moment ago into this field, modeling "attuning always pushes your current element to
   * previous" (confirmed 2026-08-06; an earlier dedicated "Previous Attunement" toggle row in
   * `WeaponSkillBar.tsx`'s `extras` section was removed in favor of this). Defaults to matching
   * `activeAttunement` when Weaver is newly equipped (current === previous, i.e. a normal-looking
   * single-attunement bar) and resets to `null` when Weaver is un-equipped, same pattern as
   * `familiarId`/`thiefStolenSkillId`. See `weapon-calc/weapon-skills.ts`'s `weaverWeaponThreeSkillId`
   * and `weaponSkillIdsForPair`'s `previousAttunement` param.
   */
  weaverPreviousAttunement: 'Fire' | 'Water' | 'Air' | 'Earth' | null
  /**
   * Thief only (meaningless, always `null`, for every other profession): the manually-chosen F2
   * "Stolen Skill" (`Skill.id`, one of `THIEF_STOLEN_SKILL_IDS` in `thief-stolen-skill.ts`), set by
   * opening the picker on the F2 mechanic-bar icon. Unlike every other `Build` field that mirrors a
   * live in-combat toggle, this one has no automatic resolution at all — which stolen skill is
   * "live" depends entirely on which enemy you steal from in a real fight, not on anything else in
   * the build — so the player picks one directly, same shape as `familiarId`. Meaningless (and
   * overridden by Specter's own Shroud-toggle F2, see `SPECTER_MECHANIC_SKILLS` in
   * `profession-mechanic.ts`) whenever Specter is equipped; cleared automatically in that case, see
   * `BuildEditorView`'s specialization-change handler.
   */
  thiefStolenSkillId: number | null
  createdAt: Timestamp
  updatedAt: Timestamp
  /**
   * User-defined labels for search/filtering (`BuildsView`, `BuildsSidebar`). Doesn't include the
   * profession/elite-spec labels shown alongside them in the UI — those are derived on the fly
   * from `profession`/`specializations` (see `shared/tags/auto-tags.ts`) rather than duplicated
   * here, so they can't drift out of sync with the build's actual profession/spec. Absent on
   * records saved before this field existed — read paths backfill `tags ?? []`, no storage
   * migration.
   */
  tags: string[]
  /**
   * Manual sort position for the Builds card grid's drag-to-reorder (`BuildsView`) — lower sorts
   * first. Deliberately separate from `updatedAt`: dragging a card to reorder it isn't a content
   * edit, and `updatedAt` is meant to reflect real build changes (see its use on the card's "last
   * updated" line). Absent on records saved before this field existed — read paths backfill
   * `order ?? Date.parse(createdAt)`, keeping legacy records in creation order relative to each
   * other until manually reordered. Only ever changes by one card at a time (new midpoint value
   * between its new neighbors, see `renderer/lib/reorder.ts`), so reordering never touches any
   * other build's fields.
   */
  order: number
  /**
   * Pins this build to the top of the Builds card grid (`BuildsView`), ahead of every non-favorite
   * card regardless of `order` — toggled via middle-click on the card, independent of dragging
   * (favorites keep their own relative `order` among themselves, same as non-favorites do among
   * theirs; see `renderer/lib/favorites.ts`'s `sortFavoritesFirst`). Not a content edit, so toggling
   * doesn't bump `updatedAt`, same reasoning as `order`. Absent on records saved before this field
   * existed — read paths backfill `favorite ?? false`, no storage migration. See
   * `SquadComp.favorite`.
   */
  favorite: boolean
}
