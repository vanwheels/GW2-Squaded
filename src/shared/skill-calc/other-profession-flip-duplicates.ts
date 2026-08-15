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
 * grants extra might / grants resistance / grants blur." These are the "additive enhancement" shape
 * TODO.md's "same-name flip pair" classification sweep (2026-08-13, see `revenant-flip-duplicates.ts`'s
 * own Band Together note) tracked as divider-merge candidates — **resolved 2026-08-15**, but not via
 * `additive-flip-pairs.ts` like the other 10 (see that file's own Evoker paragraph for why): its own
 * `evoker-familiar-facts.ts` swaps the base id's tooltip to the target's real content instead, with
 * only the StunBreak fact split into a gated bonus divider (the only one of each skill's gated bonuses
 * that's actually present as a discrete API fact — the rest are a documented gap, not guessed at). No
 * longer a plain 2nd stacked icon.
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
 *
 * 2026-08-14 addition — Warrior leg of the same-name flip-pair classification sweep (TODO.md's
 * "Next leg" note), the largest single-profession pool at the time (14 candidate pairs, all its
 * adrenaline-gated Burst Skills). Overturns the sweep's own working hypothesis for this pool
 * ("mutually EXCLUSIVE power tiers gated by current adrenaline, not additive... needs its own
 * render treatment") — every Burst Skill here already reports all 3 adrenaline-tier "Level 1/2/3"
 * facts together on ONE id (confirmed against the live wiki for Eviscerate: one fact block listing
 * Level 1/2/3 damage together, not 3 separate skill entries), so the tiering itself was never the
 * flip pair's shape at all. The `flipSkill` target in each pair is simply a 2nd id carrying the
 * identical (or reordered-but-identical) fact set — the same "2nd id, not 2nd effect" pattern as
 * this file's other entries, not a genuinely different tier. 11 of the 12 same-name Warrior pairs
 * fit this shape cleanly (byte-identical or reordered-only facts, cross-checked against each
 * source/target pair's raw facts directly):
 *
 * 2026-08-14 addition — Mesmer leg of the same-name flip-pair classification sweep, the LAST
 * unclassified pool from the original ~50-pair scan (4 pairs: Mind Wrack, Axes of Symmetry, Split
 * Second, Bladesong Harmony). All 4 excluded — this leg surfaced a 4th shape, distinct from the
 * prior 3 (byte-identical/reordered 2nd id, PvE-vs-competitive mode split via 2nd id, and
 * genuine-multi-stage-action out-of-scope):
 *   - **"With Master of Misdirection" trait-recharge variant, wiki-confirmed via the shared id=
 *     comment.** Mind Wrack (10191->49068), Split Second (56930->56925), and Bladesong Harmony
 *     (62617->62586) each carry the wiki's own `id = X,Y <!-- normal, with Shatter Storm -->`
 *     annotation (the live wiki still uses the trait's old dev-era name "Shatter Storm"; its current
 *     name is Master of Misdirection, id 731, an Illusions Grandmaster MINOR trait — always active
 *     once that tier is slotted, not a pick — "Shatter skills gain recharge reduction" 15%, and its
 *     `improves type` field explicitly lists Shatter/Bladesong/Instrument, matching all 3 skills
 *     here). The flip target represents the recharge-reduced state: `Recharge` drops (12->1) and
 *     `Count Recharge`/`Maximum Count` charge-mechanic facts appear, but no new Damage/Buff/Condition
 *     fact type appears anywhere the source doesn't already have one — recharge/charges aren't combat
 *     facts this app's calculators read, so there's no new content to merge. Bladesong Harmony's
 *     Infinite Forge (trait 2206) trait-conditional facts differ in count (source has 3 damage-value
 *     entries, target 2) but both are still bare `Damage` facts under the same trait — a game-mode-
 *     split representation quirk, not a qualitatively new effect.
 *   - **Axes of Symmetry (43761->69385): byte-identical facts, description-only difference.** Same
 *     Damage(1.25/1.75)/4x Confusion-apply/breaks-targeting/leap-finisher facts on both ids; only the
 *     flavor text differs ("you and your axe clones shadowstep and strike" vs "shadowstep and strike
 *     ... apply extra stacks of confusion per active clone" — two descriptions of the same net
 *     already-combined-into-facts effect), same "flavor text differs, no new fact" shape as Warrior's
 *     Whirling Strike. The live wiki infobox for Axes of Symmetry lists only `id = 43761` (69385 not
 *     mentioned at all), consistent with it being a non-canonical internal duplicate rather than a
 *     documented 2nd effect.
 * This completes the ~50-pair scan (Revenant + Elementalist + Warrior + Guardian + Mesmer legs) —
 * confirmed-additive pool stays at 10 (Revenant's Band Together family x4, Elementalist's attunement
 * familiars x4, Guardian's Crashing Courage x2); divider-rendering design is unblocked.
 *
 * 2026-08-14 addition — Guardian leg of the same-name flip-pair classification sweep (TODO.md's
 * "Next leg" note), 15 raw pairs after excluding the 12 Spirit Weapon pairs already handled above.
 * Mixed bag, NOT a single shape like Warrior's:
 *   - 9 byte-identical/reordered-only pairs (2nd id, no new content), same shape as everything else
 *     in this file: Virtue of Courage, Virtue of Resolve, Wings of Resolve, Tome of Resolve, Tome of
 *     Courage, Tome of Justice, Radiant Courage, Radiant Resolve, and one of the 4 Glaring Burst
 *     pairs (77058->78674).
 *   - 1 more PvE/PvP-vs-WvW mode split via 2nd id, wiki-confirmed (`id = 30039, 30029`,
 *     `split = pve pvp, wvw`, Duration 3s vs 2s + WvW-only 60s recharge vs 45s): Shield of Courage.
 *   - 2 pairs deliberately NOT excluded — genuine trait-conditional additive enhancement, the
 *     target shape this whole sweep is hunting for: both Crashing Courage pairs (62555->62596 and
 *     the ground-targeted 62648->62532) gain StunBreak + extra Stability/Resistance/Protection only
 *     with the Indomitable Courage trait equipped (wiki-confirmed: "The active effect of Virtue
 *     skill 3 breaks stun and grants stability to nearby allies"). The API represents this trait's
 *     bonus as a full 2nd skill id linked via `flipSkill` instead of `requires_trait`-gated facts on
 *     one id (unlike most trait bonuses elsewhere in this data). Left as 2 icons today, real
 *     divider-merge candidates once the rendering is built, alongside Revenant's Band Together
 *     family and Elementalist's attunement familiars.
 *   - 4 pairs also NOT excluded but for a 3rd, different reason — not a duplicate, not additive
 *     stacking, genuinely out of scope: Shield of Absorption (9091->9224) is a real cast-then-
 *     detonate 2-stage skill (cast forms a knockback/projectile-block dome; detonating it early
 *     swaps to an entirely different heal effect, not a superset of the cast's facts) — same
 *     "genuine multi-stage action" bucket as Thief's Deathstrike, just replace-not-append. The 3
 *     remaining Glaring Burst pairs (76982->77058, 78730->77058) are weapon-conditional mutually
 *     exclusive variants — Guardian's Radiant Forge transform swaps which of ~5 differently-facted
 *     skills "Glaring Burst" resolves to depending on which radiant weapon is currently equipped
 *     (wiki: "Apply an additional effect to Glaring Burst until a new weapon is chosen"), all
 *     sharing one tooltip name by design even though the facts are unrelated (heal burst vs damage
 *     burst) — same "legend/mode-select button, not a boon/condition duplicate" category as
 *     Revenant's Legendary Renegade Stance.
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
  77003, // Innervate Anguish — identical to its source (77050)
  // Warrior Burst Skills (2026-08-14 addition, flip-pair sweep's Warrior leg) — identical or
  // reordered-only fact sets, no genuinely new content over the source id
  14422, // Eviscerate (Axe) — identical facts, reordered
  14545, // Arcing Slice (Greatsword) — identical facts (same Damage/Fury/DamageU50% set), reordered
  14512, // Earthshaker (Hammer) — byte-identical facts
  14473, // Kill Shot (Rifle) — identical facts, reordered; first hop of the core (spec-less) chain
  14474, // Kill Shot (Rifle) — identical facts, reordered; 2nd hop of the core chain AND the direct
  // flip target of the Spellbreaker-specific entry id (42041) — excluding it collapses both
  // entry paths, since `flipTargetSkills`' walk stops at the first excluded id it hits
  14475, // Kill Shot (Rifle) — identical facts, reordered; 3rd/terminal hop, unreachable once 14474
  // is excluded but included for clarity/defensiveness
  14425, // Skull Crack (Mace) — byte-identical facts
  14549, // Whirling Strike (Spear) — identical facts; only the flavor-text description differs
  // ("stunning them" appended), no new fact
  14469, // Forceful Shot (Speargun) — byte-identical facts, same order
  69433, // Breaching Strike (Dagger) — byte-identical facts, same order
  72029, // Path to Victory (Staff) — identical facts (self-heal + ally-heal Level 1/2/3 sets), reordered
  72911, // Harrier's Toss (Spear) — identical facts, reordered
  80263, // Bloodthirster (Sword) — byte-identical facts, same order
  // Berserk (Warrior Berserker Profession_2 "Rage" toggle) — the 12th Warrior pair, a DIFFERENT
  // shape from the 11 above: wiki-confirmed 2026-08-14 as a genuine PvE-vs-competitive mode split
  // via a 2nd id (30435 PvE: 8s recharge; 30185 PvP/WvW: 15s recharge + StunBreak), same "mode
  // split represented as a 2nd id instead of an override" category as Utility Goggles/Guardian
  // Spirit Weapons above, not a duplicate-content case
  30185, // Berserk — PvP/WvW-recharge variant, flip target of the PvE entry id (30435)
  // Guardian (2026-08-14 addition, flip-pair sweep's Guardian leg) — identical/reordered-only
  // facts, no genuinely new content over the source id
  9268, // Virtue of Courage — byte-identical facts and traitedFacts
  9250, // Virtue of Resolve — byte-identical facts and traitedFacts
  30225, // Wings of Resolve — byte-identical facts and traitedFacts
  68648, // Tome of Resolve — byte-identical facts and traitedFacts
  68650, // Tome of Courage — byte-identical facts and traitedFacts
  68647, // Tome of Justice — byte-identical facts and traitedFacts
  78674, // Glaring Burst — byte-identical facts (Range/Damage/Vulnerability), one of 4 same-name
  // Glaring Burst pairs; the other 3 are a different, NOT-excluded shape, see file doc comment
  78770, // Radiant Courage — byte-identical facts (Recharge/StunBreak)
  78514, // Radiant Resolve — byte-identical facts (Recharge)
  // Guardian mode split (2026-08-14 addition) — same "2nd id instead of an override" shape as
  // Utility Goggles/Spirit Weapons/Berserk above
  30039, // Shield of Courage — wiki-confirmed `id = 30039, 30029`, `split = pve pvp, wvw`
  // Mesmer (2026-08-14 addition, flip-pair sweep's Mesmer leg — the LAST unclassified pool)
  49068, // Mind Wrack — "with Master of Misdirection" (wiki: "Shatter Storm") recharge-reduced
  // variant, wiki id comment confirms `10191,49068 <!-- normal, with Shatter Storm -->`; only
  // Recharge/Count Recharge/Maximum Count differ, no new Damage/Buff/Condition fact
  56925, // Split Second — same Master of Misdirection recharge-reduced variant, wiki id comment
  // `56930,56925 <!-- normal, with Shatter Storm -->`
  62586, // Bladesong Harmony — same Master of Misdirection recharge-reduced variant, wiki id comment
  // `62617, 62586 <!-- id with Shatter Storm -->`; Infinite Forge trait facts differ in count
  // (3 vs 2 entries) but both are bare Damage values under the same trait, not a new effect
  69385 // Axes of Symmetry — byte-identical facts to its source (43761); only the flavor-text
  // description differs, no new fact; live wiki infobox lists only `id = 43761`, 69385 absent
])
