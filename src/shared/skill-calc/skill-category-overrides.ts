/**
 * Curated `categories[0]` overrides for Heal/Utility/Elite skills the GW2 API returns with an
 * empty `categories` array — `SkillsEditor.tsx`'s `groupSkillsByCategory` reads that field to sort
 * a profession's skill picker into its native mechanic columns (Signet, Mantra, Well, ...), and an
 * empty array silently dumps a skill into the catch-all uncategorized bucket instead. Flagged in
 * TODO.md 2026-07-31 for Mesmer's Troubadour "Tale of..." skills and Mirage's "Mirror" skills; each
 * entry below is verified against sibling skills in the same mechanic family rather than guessed —
 * see the doc comment on each group. Add more here as specific pickers get checked, same
 * incremental-verification approach as every other curated table in this codebase (e.g.
 * `trait-attributes.ts`).
 */

/**
 * Troubadour's 6 "Tale of..." skills (specialization id 73) — every one of the elite spec's own
 * Heal/Utility/Elite skills comes back with `categories: []` from the API, so there's no sibling
 * skill to borrow a tag from (unlike the Mirage case below). "Tale" is the in-game mechanic noun
 * (every description literally starts "Tale.", same self-naming convention already relied on
 * elsewhere in this codebase — e.g. Celestial Avatar's skills starting "Celestial Avatar.", see
 * `bundle-skills.ts`) and matches this app's existing category strings, which are all singular
 * mechanic nouns (Signet, Mantra, Well, Manipulation, ...).
 */
const TROUBADOUR_TALE_SKILL_IDS: readonly number[] = [
  76611, // Tale of the Honorable Rogue
  76695, // Tale of the Second Scion
  76850, // Tale of the Soulkeeper
  76971, // Tale of the August Queen
  77066, // Tale of the Tortured Mastermind
  77178 // Tale of the Valiant Marshal
]

/**
 * Mirage's (specialization id 59) "Mirage Mirror" (44677) and "Mirage Retreat" (45666) utility
 * skills also come back with `categories: []`, but every *other* Mirage Heal/Utility/Elite skill
 * (False Oasis, Crystal Sands, Mirage Advance x2, Illusionary Ambush, Jaunt) is tagged
 * `["Deception"]` — a real, verified sibling tag to borrow rather than a guess. Not "Mirror": the
 * base Mesmer Heal-slot Manipulation skill (id 10177, also literally named "Mirror") already has
 * its own correct category and isn't affected by this override.
 */
const MIRAGE_DECEPTION_SKILL_IDS: readonly number[] = [
  44677, // Mirage Mirror
  45666 // Mirage Retreat
]

/**
 * Necromancer's "Necrotic Traversal" (10600, Summon Flesh Wurm's sacrifice-and-teleport flip skill)
 * has `categories: []` and no `flipSkill`/`bundleSkills` link back to Summon Flesh Wurm (10543) in
 * the raw API data to resolve automatically. Summon Flesh Wurm itself is tagged `["Minion"]`;
 * tagging its flip skill the same way keeps the two grouped together in the picker instead of
 * Necrotic Traversal landing in the uncategorized bucket alone, matching TODO.md's ask ("should be
 * associated with/grouped near Summon Flesh Wurm instead").
 */
const NECROTIC_TRAVERSAL_SKILL_ID = 10600

const SKILL_CATEGORY_OVERRIDES: ReadonlyMap<number, string> = new Map([
  ...TROUBADOUR_TALE_SKILL_IDS.map((id): [number, string] => [id, 'Tale']),
  ...MIRAGE_DECEPTION_SKILL_IDS.map((id): [number, string] => [id, 'Deception']),
  [NECROTIC_TRAVERSAL_SKILL_ID, 'Minion']
])

/** Resolves a skill's picker category, applying `SKILL_CATEGORY_OVERRIDES` for the known ids the
 *  API leaves uncategorized before falling back to the skill's own `categories[0]`. */
export function skillPickerCategory(skill: { id: number; categories: readonly string[] }): string | null {
  return SKILL_CATEGORY_OVERRIDES.get(skill.id) ?? skill.categories[0] ?? null
}
