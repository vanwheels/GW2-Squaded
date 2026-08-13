/**
 * Hand-verified `flipSkill` targets, outside Revenant, that carry no genuinely new content over
 * their own source skill — the follow-up sweep TODO.md's "Follow-ups from the Revenant
 * flip-duplicate fix" logged (2026-08-13, see `revenant-flip-duplicates.ts` for the original find).
 * A full `skills.json` scan for same-name `flipSkill` pairs on Engineer/Guardian/Elementalist/Thief
 * Heal/Utility/Elite skills found 19 more pairs; each was checked against its raw + `synthetic-
 * facts.json`-merged facts and, for the ambiguous ones, the live wiki page, before deciding.
 *
 * Two different reasons, both distinct from Revenant's 3:
 *
 * 1. **PvE-vs-WvW/PvP mode split, represented as a second id instead of an override.** Confirmed
 *    directly for Utility Goggles — its own wiki infobox carries `split = pve, wvw pvp` AND
 *    `id = 5865,29591` (both ids on one page, the wiki's own documented-split convention this app
 *    otherwise handles via `wvw-fact-overrides.json` correcting the *same* id's values, not a second
 *    id). The 12 Guardian Spirit Weapon pairs (Hammer of Wisdom, Sword of Justice, Bow of Truth x2,
 *    Shield of the Avenger x2, "Feel My Wrath!", Dragon's Maw, Signet of Courage, Renewed Focus) and
 *    the Thief/Rejuvenate pairs below show the identical signature — byte-identical or
 *    near-identical facts, the "flip target" never a strict superset of its source — matching this
 *    same shape rather than Revenant's stale-orphan or PvP-duplicate cases.
 * 2. **A.E.D. (Engineer heal, 21659 -> 30881)**: the live wiki's current mechanic ("activate, heal
 *    after a delay; if you'd take lethal damage while active, it ends early and heals for more,
 *    clearing conditions") names nothing matching 30881's own extra "Shocking Aura" fact — the
 *    target doesn't match the skill's current documented behavior, so it reads as stale/superseded
 *    data rather than a real second effect (same "orphan carries wrong info" shape as Revenant's
 *    Centaur orphans).
 *
 * Deliberately NOT included: Elementalist Evoker's 4 familiar Utility skills (Fox's Fury, Otter's
 * Compassion, Toad's Fortitude, Hare's Agility) — each *does* carry genuinely new facts on its flip
 * target, and for Fox's Fury and Otter's Compassion this is wiki-confirmed as a real, current,
 * attunement-conditional enhancement ("if fire/water is your specialized element, this skill also
 * breaks stun / grants extra might / strikes nearby foes" — Fox's Fury last balance-patched
 * 2025-10-28). Toad's Fortitude and Hare's Agility weren't individually wiki-checked but show the
 * identical "target is a strict superset, matches the family's shape" signature, so they're assumed
 * to follow the same attunement-gated-enhancement pattern rather than excluded on a guess.
 */
export const NON_ACTIONABLE_OTHER_PROFESSION_FLIP_TARGET_IDS: ReadonlySet<number> = new Set([
  // Engineer
  29991, // Personal Battering Ram — wiki confirms no secondary/detonate mechanic at all
  29591, // Utility Goggles — wiki's own infobox: `split = pve, wvw pvp`, `id = 5865,29591`
  30881, // A.E.D. — target's "Shocking Aura" fact matches no part of the current wiki mechanic
  // Guardian Spirit Weapons (mode-split duplicates, no new content over their source)
  46170, // Hammer of Wisdom
  55053, // Hammer of Wisdom (2nd pair)
  68666, // Renewed Focus
  44846, // Sword of Justice
  55019, // Sword of Justice (2nd pair)
  43565, // Bow of Truth
  46750, // Bow of Truth (2nd pair)
  41571, // Shield of the Avenger
  55035, // Shield of the Avenger (2nd pair)
  68670, // "Feel My Wrath!"
  68686, // Dragon's Maw
  68676, // Signet of Courage
  // Elementalist Evoker
  79323, // Rejuvenate — identical duplicate; the 4 familiar-flavor Rejuvenate ids are already
  // handled via `Build.familiarId` (see that field's doc comment), not the flip-stack
  // Thief
  77092, // Stone Summit Cannon
  76784, // Emergency Jade Shield
  76744 // Canach-Coin Toss
])
