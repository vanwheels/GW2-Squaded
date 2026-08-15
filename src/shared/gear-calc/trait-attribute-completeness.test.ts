import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact } from '../types'
import { CURATED_CONVERSIONS, CURATED_FLAT_BONUSES, ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES, WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES } from './trait-attributes'
import {
  FURY_ATTRIBUTE_TRAIT_BONUSES,
  FURY_CRIT_CHANCE_TRAIT_BONUSES,
  HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES,
  MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES,
  MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES,
  MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_BONUSES,
  QUICKNESS_ATTRIBUTE_TRAIT_BONUSES,
  REGENERATION_ATTRIBUTE_TRAIT_BONUSES,
  REVEALED_ATTRIBUTE_TRAIT_BONUSES
} from './combat-state'

/**
 * Trait attribute-bonus completeness scan — TODO.md's "Automated testing strategy" #1 (agreed
 * 2026-08-12): every trait/family in `trait-attributes.ts`/`combat-state.ts` was hand-populated by
 * a one-off "scan traits.json for this shape" sweep done in its own session, with nothing forcing a
 * new or previously-missed conditional trait into any of them. This test turns that into a
 * permanent CI-enforced invariant: for every trait in `data/game-data/traits.json` whose `facts` or
 * `traitedFacts` include an `AttributeAdjust`/`BuffConversion` fact (the two shapes that can encode
 * "this trait touches a character attribute" — see `trait-attributes.ts`'s file-header comment),
 * its id must appear either (a) in the union of every curated table below, or (b) in
 * `EXCLUDED_TRAIT_IDS` with a stated reason. A future balance patch adding a new attribute-touching
 * trait, or a previously-missed one, fails this test immediately instead of silently producing a
 * wrong in-game stat that only surfaces months later when a user hand-checks against gw2skills.net.
 *
 * This is a structural/coverage test, not a value-correctness one — it doesn't re-verify that any
 * curated table's *values* are right (that's what each table's own wiki-verification comments are
 * for), only that every candidate trait has been *looked at* and a decision recorded somewhere.
 *
 * Built 2026-08-12 by running exactly this scan by hand: 187 traits carry a qualifying fact; 90 were
 * already covered by the 12 curated tables below; of the remaining 98 candidates, 1 (Kinetic
 * Accelerators, id 2052) turned out to be a genuine miss and was wiki-verified and added to
 * `CURATED_CONVERSIONS`; 2 (Power Overwhelming id 334, Deadly Strength id 855) were genuine stat
 * gains this codebase had no infra for yet (new conditional-gate shapes) and were logged as TODO.md
 * follow-ups; the other 95 are proc/skill-tooltip coefficients (heal-on-X, barrier-on-X,
 * life-siphon-on-hit, pet-only stats, a temporary on-cast buff value, a condition-tick-damage
 * coefficient, and one `requires_trait` cross-reference) — same "fact type reused for skill-tooltip
 * math" shape the file-header comment on `trait-attributes.ts` already documents for Healer's Gift,
 * the original example that motivated this whole curated-whitelist design. Power Overwhelming (334)
 * was later built (2026-08-15, `MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_BONUSES` in
 * `combat-state.ts`) and moved from the exclusion list below into the covered-ids union; Deadly
 * Strength (855) remains excluded, still blocked on a new `CombatState.deathsCarapaceStacks` field.
 */

interface TraitDataFile {
  id: number
  name: string
  facts: Fact[]
  traitedFacts: Fact[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const traits: TraitDataFile[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'))

/** A trait "touches a character attribute" if either its `facts` or `traitedFacts` array carries an
 *  `AttributeAdjust` (flat point grant) or `BuffConversion` (percent-of-X-into-Y grant) fact — the
 *  two shapes `trait-attributes.ts`'s file header identifies as the ones that *can* encode a genuine
 *  stat grant, even though most turn out not to be one (see this file's own header comment). */
function touchesAttribute(trait: TraitDataFile): boolean {
  const isAttributeFact = (f: Fact): boolean => f.type === 'AttributeAdjust' || f.type === 'BuffConversion'
  return trait.facts.some(isAttributeFact) || trait.traitedFacts.some(isAttributeFact)
}

/** Every trait id already accounted for by a curated table this codebase actually consults when
 *  computing character stats — kept as one flat union since a trait only needs to be *somewhere*,
 *  not in a specific table (e.g. Life Attunement legitimately appears in both
 *  `CURATED_FLAT_BONUSES` and `CURATED_CONVERSIONS`). */
const COVERED_TRAIT_IDS = new Set<number>([
  ...CURATED_FLAT_BONUSES.map((b) => b.traitId),
  ...CURATED_CONVERSIONS.map((c) => c.traitId),
  ...Object.keys(WEAPON_EQUIPPED_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(ATTUNEMENT_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(FURY_CRIT_CHANCE_TRAIT_BONUSES).map(Number),
  ...Object.keys(FURY_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(MIGHT_STACK_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(MIGHT_THRESHOLD_ATTUNEMENT_DOUBLED_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(REGENERATION_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(QUICKNESS_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(MECHANIC_ACTIVE_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(REVEALED_ATTRIBUTE_TRAIT_BONUSES).map(Number),
  ...Object.keys(HEALTH_THRESHOLD_ATTRIBUTE_TRAIT_BONUSES).map(Number)
])

/**
 * Every trait reviewed by the 2026-08-12 completeness sweep and found NOT to be a genuine
 * character-stat grant (or, for the 2 `GENUINE STAT GAIN` entries, found to be one but not yet
 * modeled) — the "reviewed, intentionally excluded allowlist with a stated reason" TODO.md called
 * for. Adding a trait here is itself a reviewable decision (it's a code change, in a diff, same as
 * adding one to a curated table) — this is NOT a silent bypass, it's the documented alternative to
 * one. A future entry landing here should get the same one-line "why" every entry below has.
 */
const EXCLUDED_TRAIT_IDS: Record<number, string> = {
  // heal-proc (61)
  349: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Flow like Water
  351: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Healing Ripple
  549: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Pure of Heart
  551: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Selfless Daring
  558: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Writ of Persistence
  585: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Altruistic Healing
  586: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Monk's Focus
  587: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Glacial Heart
  628: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Renewing Splendor
  738: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Restorative Mantras
  778: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Transfusion
  789: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Life from Death
  964: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Windborne Notes
  1054: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Evasive Purity
  1072: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Natural Healing
  1089: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Rugged Growth
  1238: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Assassin's Reward
  1276: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Mug
  1294: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Merciful Ambush
  1297: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Shadow Savior
  1454: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Might Makes Right
  1474: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Soldier's Comfort
  1479: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Shrug It Off
  1481: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Mending Might
  1487: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Arcane Restoration
  1697: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Invigorating Bond
  1707: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Dual Wielding
  1720: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Fiendish Tenacity
  1743: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Shining Aspects
  1760: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Rapid Flow
  1784: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Glaring Resolve
  1815: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Generous Abundance
  1816: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Healer's Gift
  1819: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Words of Censure
  1834: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Soothing Detonation
  1862: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Live Vicariously
  1866: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Restorative Illusions
  1876: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Blood Renewal
  1908: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Hunter's Fortification
  1915: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Illusionary Inspiration
  1932: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Blighter's Boon
  1986: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Elemental Bastion
  1987: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // All's Well That Ends Well
  2002: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Dead or Alive
  2016: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Verdant Etching
  2023: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Escapist's Fortitude
  2057: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Cultivated Synergy
  2135: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Heat Therapy
  2155: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Eternal Bond
  2168: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Resolute Counter
  2182: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Righteous Rebel
  2228: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Redemptor's Sermon
  2254: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Balance in Discord
  2285: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Traversing Dusk
  2300: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Hungering Darkness
  2326: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Raconteur
  2354: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Spirit's Succor
  2358: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Expanded Consciousness
  2378: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Spirit's Gift
  2395: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Innervating Alloy
  2426: "Heal-on-X proc coefficient (same shape as Healer's Gift, see file header) — not a character-stat gain.", // Invigorating Tempo
  // barrier-proc (18)
  279: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Earthen Blast
  1060: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Allies' Aid
  1160: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Shielding Restoration
  1375: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Last Stand
  1817: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Resilient Spirit
  1854: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Chain Reactivity
  1971: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // System Shocker
  1981: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Ex Machina
  2059: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Feed from Corruption
  2080: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Desert Empowerment
  2152: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Crystal Configuration: Eclipse
  2180: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Master's Fortitude
  2253: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Unshakable Mountain
  2277: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Nature's Shield
  2280: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Panaku's Ambition
  2281: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Mech Core: Barrier Engine
  2337: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Magpie's Defense
  2362: "Barrier-on-X proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Enterprising Aristocrat
  // life-siphon-proc (11)
  783: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Vampiric
  788: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Overflowing Thirst
  909: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Signets of Suffering
  1130: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Leeching Venoms
  1300: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Cloaked in Shadow
  1705: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Shadow Siphoning
  1755: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Battle Scarred
  1844: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Vampiric Presence
  1974: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Augury of Death
  2161: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Predator's Cunning
  2290: "Life-siphon-on-hit proc coefficient (same shape as Healer's Gift) — not a character-stat gain.", // Larcenous Torment
  // pet-stat (3)
  1016: "Grants an attribute to the player's pet, not the player character — pet stats aren't modeled anywhere in this codebase's attribute-totals system.", // Fang and Claw
  1065: "Grants an attribute to the player's pet, not the player character — pet stats aren't modeled anywhere in this codebase's attribute-totals system.", // Pet's Prowess
  1900: "Grants an attribute to the player's pet, not the player character — pet stats aren't modeled anywhere in this codebase's attribute-totals system.", // Pack Alpha
  // condition-tick-proc (1)
  1696: "Condition-damage-per-tick proc coefficient (Terror's Fear damage-over-time), not a character-stat gain — same shape as Healer's Gift.", // Terror
  // buff-proc (1)
  263: "Value of a temporary on-cast buff (Arcane Lightning, a 15s Ferocity effect granted only while using an Arcane skill), not a passive stat.", // Arcane Lightning
  // gap-carapace-stacks (1)
  855: "GENUINE STAT GAIN, not yet modeled — +10 Power/+10 ConditionDamage per stack of Necromancer/Harbinger's own ‘Carapace’ resource (unrelated to Might), which no CombatState field tracks. A new conditional family needing its own stack-count input — found by this completeness scan 2026-08-12, logged in TODO.md as a follow-up to build.", // Deadly Strength
  // requires_trait cross-reference (1)
  1480: "Same Healing-970 heal-proc coefficient already curated as excluded on trait 1474 (Soldier's Comfort) — this trait's own traitedFacts entry is a requires_trait:1474 cross-reference showing their combined tooltip, not a separate stat gain on this trait itself.", // Marching Orders
}

describe('trait attribute-bonus completeness', () => {
  it('accounts for every attribute-touching trait in the curated tables or the exclusion list', () => {
    const uncovered: string[] = []
    for (const trait of traits) {
      if (!touchesAttribute(trait)) continue
      if (COVERED_TRAIT_IDS.has(trait.id)) continue
      if (trait.id in EXCLUDED_TRAIT_IDS) continue
      uncovered.push(`${trait.id} (${trait.name})`)
    }
    expect(uncovered, 'New/previously-missed attribute-touching trait(s) — add to a curated table in trait-attributes.ts/combat-state.ts, or to this test\'s EXCLUDED_TRAIT_IDS with a reason.').toEqual([])
  })

  it('has no exclusion entry for a trait that is already curated (dead/redundant entry)', () => {
    const redundant = Object.keys(EXCLUDED_TRAIT_IDS).map(Number).filter((id) => COVERED_TRAIT_IDS.has(id))
    expect(redundant, 'Trait id(s) covered by a curated table AND listed in EXCLUDED_TRAIT_IDS — remove the now-redundant exclusion entry.').toEqual([])
  })

  it('has no exclusion entry for a trait that no longer exists or no longer touches an attribute', () => {
    const traitsById = new Map(traits.map((t) => [t.id, t]))
    const stale = Object.keys(EXCLUDED_TRAIT_IDS)
      .map(Number)
      .filter((id) => {
        const trait = traitsById.get(id)
        return !trait || !touchesAttribute(trait)
      })
    expect(stale, 'Trait id(s) in EXCLUDED_TRAIT_IDS that no longer exist in traits.json or no longer carry an AttributeAdjust/BuffConversion fact — a balance patch likely reworked them; remove the stale entry.').toEqual([])
  })
})
