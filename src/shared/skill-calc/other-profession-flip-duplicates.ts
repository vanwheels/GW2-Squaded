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
 * target, wiki-confirmed 2026-08-13 for all 4 (previously only Fox's Fury/Otter's Compassion were
 * individually checked, the other 2 "assumed") as a real, current, attunement-conditional
 * enhancement: "if fire/water/earth/air is your specialized element, this skill also breaks stun /
 * grants extra might / grants resistance / grants blur." These are the exact "additive enhancement"
 * shape TODO.md's "same-name flip pair" classification sweep (2026-08-13, see
 * `revenant-flip-duplicates.ts`'s own Band Together note) is tracking as future divider-merge
 * candidates — correctly still shown as a separate stacked icon today, pending that sweep deciding
 * how to render them differently.
 *
 * Also investigated 2026-08-13 as part of that same classification sweep, deliberately NOT
 * excluded here for a 3rd reason: **Thief's Deathstrike** (27074 -> 28625) is a genuine 2-hit combo
 * ("deliver a quick attack, then deliver a second devastating blow if it hits") — the 2nd hit's
 * damage is conditional on the 1st landing, not an unconditional addition, so it's correctly treated
 * like any other multi-hit attack chain (no different from a weapon autoattack's 2nd/3rd hit, none
 * of which get merged into one tooltip either).
 *
 * 2026-08-13 addition (7 more same-name pairs, found by the classification sweep above scanning
 * EVERY same-name flip pair in the game rather than just Engineer/Guardian/Elementalist/Thief
 * Heal/Utility/Elite): all 7 are byte-identical or near-identical (same substantive Damage/Buff
 * content, differing only in internal fact ordering/type representation or an unrelated numeric
 * field the boon/condition calculator doesn't read) — same "2nd id, not 2nd effect" shape as this
 * file's original 19.
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
  76744, // Canach-Coin Toss
  // Ranger
  46629, // Maul — same Damage(2.2)/Vulnerability(8s×5)/Attack of Opportunity(10s×1) content as its
  // source (12525), just represented with an internal duplicate fact on one side and a
  // Buff-vs-PrefixedBuff type difference on the other
  // Thief (2026-08-13 addition)
  59526, // Repeater — byte-identical to its source (13111): Damage/Bleeding(3s×5)/ComboFinisher
  71854, // Spinning Axe — identical Damage/Bleeding/Number-of-Targets/Pierces to its source (71967);
  // only its non-boon "Duration" (ground-effect lifetime, 4s vs 10s) differs, a PvE/WvW split the
  // boon/condition calculator doesn't read
  80278, // Death's Advance — byte-identical to its source (40436), wiki's own page confirms it's
  // simply the ground-targeted casting variant ("id = 40436, 80278 <!-- ground-targeted -->")
  // Necromancer/Ritualist (2026-08-13 addition) — all 3 Charged Souls "Innervate" mechanic-slot
  // skills share one wiki page per pair (`id = X, Y`) with byte-identical facts on both ids
  76602, // Innervate Preservation — identical to its source (76647)
  76732, // Innervate Wanderlust — identical to its source (76758)
  77003 // Innervate Anguish — identical to its source (77050)
])
