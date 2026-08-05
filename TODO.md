# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Next up

- [ ] **Racial skills should be toggleable (show/hide) in the skill pickers, eventually as a settings
      option** — noted by the user 2026-08-04 while doing the Elite-slot Damage sweep, using
      Artillery Barrage as the example (a Norn racial elite, not a real Guardian/Warrior/etc. skill —
      it just appears under 8 of the 9 professions' Elite lists, e.g. `skills.json` id 12343 lists
      `professions: [Guardian, Warrior, Engineer, Ranger, Thief, Elementalist, Mesmer, Necromancer]`
      with `specializationId: null`, missing only Revenant). This app has **no race concept
      modeled at all today** (confirmed: no `race` field anywhere in `src/shared/types`, no
      race-data JSON under `data/game-data/`), so this is new scope, not a tweak to existing
      filtering. The Mesmer Elite-slot scan for the Damage sweep surfaced the likely full racial-elite
      set riding along in every profession's picker: Artillery Barrage, Summon 7-Series Golem, Summon
      D-Series Golem, Summon Power Suit, Charrzooka, Warband Support (Charr); Hounds of Balthazar,
      Reaper of Grenth, Avatar of Melandru + Remove Avatar of Melandru (Human); Become/Release the
      Bear, Wolf, Snow Leopard, Raven (Norn); Summon Druid Spirit, Summon Sylvan Hound, Take Root
      (Sylvari); Mistfire Wolf (Asura?) — worth a full `skills.json` scan for the exact set (likely
      identifiable by `specializationId: null` + a `professions` array spanning most/all professions,
      cross-checked against the wiki's own "Racial skill" category page rather than guessed from
      flags). Needs scoping before implementing: (1) where the toggle lives (a new Settings panel
      doesn't exist yet either — check if one does before assuming); (2) default state (show or hide
      by default); (3) whether this also needs the Gear Optimizer / any other skill-consuming surface
      to respect the same toggle, not just the picker UI.
- [ ] Sigils aren't factored into the Stats panel yet (user report, 2026-08-01). Confirmed the
      `Sigil` type (`src/shared/types/game-data.ts`) has no structural `bonuses` field at all —
      unlike Rune/Consumable, it's free-text `description` only — so `computeGearAttributeTotals`
      has nothing to read for a sigil's stat contribution. The only sigil effect modeled anywhere
      is the 8 on-kill stacking sigils' flat-per-stack bonus, hand-curated in `combat-state.ts`'s
      `STACKING_SIGILS` table and applied via the `CombatState` stepper — that's a proc/combat-state
      mechanic, not a structural stat grant, so it doesn't cover sigils in general. Needs scoping:
      do any sigils grant an *unconditional* flat stat (rare — most are on-crit/on-swap/on-kill
      procs, which arguably belong in the same "not modeled, out of scope" bucket as other procs),
      or is this report specifically about the stacking sigils' current stack count not visibly
      moving the Stats panel numbers (a wiring bug, not a missing-data problem)? Check
      `StatsPanel.tsx`/`derived-stats.ts` for whether `combatStatePoints` (which is where
      `STACKING_SIGILS` contributions actually land) is even included in the panel's displayed
      totals before assuming new data modeling is needed.
- [ ] Food and utility aren't factored into the Stats panel yet (user report, 2026-08-01). This is
      surprising given the code: `EquipmentEditor.tsx` already has a build-level Food/Utility picker
      wired to `build.foodId`/`build.utilityId`, `computeGearAttributeTotals`
      (`attribute-totals.ts`) already reads both ids and applies their `Consumable.bonuses` via
      `addBonus`, and `data/game-data/food.json`/`utility.json` do carry populated `bonuses` arrays
      (spot-checked live, not empty). So the underlying math path looks wired correctly — next
      session should reproduce live (pick a food/utility with a clear flat bonus, e.g. a
      Healing-Power food, and watch the Stats panel) before assuming missing modeling; likely
      candidates if it really doesn't move: a stale-state bug where `StatsPanel` reads a different
      `build` reference than the Equipment editor's in-progress draft (not committed until saved?),
      or a bonus-attribute-name mismatch between `addBonus`'s expected keys and what
      food/utility's `bonuses[].attribute` actually contains for the specific items tested.
- [ ] Gear Optimizer should also let rune and infusion choice be search variables (not just gear
      stat-prefix + optional food/utility, which is all it searches today) — noted 2026-08-01, scope
      to runes + infusions only for now, leave sigils out (sigils are procs, not a stat lever the
      optimizer's floor/maximize model fits — see the sigils item above). Currently
      `gear-optimize.ts`'s `optimizeGear` treats the build's equipped runes/infusions as **fixed**
      baseline contributions (see its "Baseline" comment — `computeGearAttributeTotals(fixedBuild,
      ...)` folds them in before the search ever runs) exactly like it treats food/utility when
      `optimizeFoodUtility` is off. Making runes/infusions searchable means: (1) new `OptimizerSlot`
      entries for rune choice (per equipped rune count/tier — WvW rune sets are usually 6x one
      rune, so likely a single "rune set" slot analogous to how weapon pairs collapse to one slot,
      not 6 independent slots) and each infusion slot already present on gear
      (`armorTrinketInfusionCapacity`/`weaponUpgradeCapacity` from `upgrade-slots.ts` already know
      capacity per slot); (2) `statOptionsFor`'s dedup-by-relevant-metric-delta pattern should
      extend cleanly to runes (`Rune.bonuses`, tiered 1pc/2pc/.../6pc like the existing rune bonus
      parsing in `attribute-totals.ts`) and infusions (`Infusion.attribute`/`.value`, already a
      single flat point). Needs a UI decision too: `GearOptimizerPanel.tsx` currently has one
      "optimize food/utility" checkbox — likely wants a parallel "optimize runes/infusions" toggle
      rather than always searching them, consistent with the existing opt-in pattern.
- [ ] Healing tooltip breakdown done 2026-08-02; Damage tooltip breakdown also done 2026-08-02
      (`src/shared/skill-calc/damage-calc.ts`, `CombatState.targetArmorClass` +
      `TARGET_ARMOR_VALUES` in `combat-state.ts`). Both briefly lived as their own aggregated row on
      `BoonConditionSummaryPanel` (Sessions 54-55) but moved into each skill's own tooltip instead
      per user feedback — a per-skill number read in place was easier to follow than a separate
      summary icon (Session 56, `SkillsEditor.tsx`'s `skillTooltipContent` now calls
      `skill-fact-lines.ts`'s `skillFactLines` instead of the generic `numericFactLines` for skills;
      traits are unchanged, still generic-only). See COMPLETED.md Sessions 54-56 for the full
      curation writeup. `CURATED_DAMAGE_COEFFICIENTS` was seeded 2026-08-02 with 1 skill per base
      profession, then taken to a full category sweep starting 2026-08-04, same policy as
      `CURATED_HEALING_COEFFICIENTS` — see the item below for the writeup and what's still
      uncurated in it. Neither table has been visually spot-checked in the running app yet (Electron
      sandbox limitation) — do that before extending `CURATED_DAMAGE_COEFFICIENTS` further, and
      before starting the tooltip-visual-pass item below. Condition-skill damage (coefficient against
      Condition Damage rather than Power) was not scoped as part of this work — the curated skills
      above are all direct-hit Power damage; a condition-damage skill would need its own
      wiki-verification pass (condition-per-stack-per-second base values are a separate,
      well-documented wiki constant table, not skill-specific coefficients) before extending
      `CURATED_DAMAGE_COEFFICIENTS` to cover one.
- [ ] **`CURATED_DAMAGE_COEFFICIENTS` full category sweep, in progress, started 2026-08-04** (see
      `heal_coefficient_curation_strategy` memory for the general policy). Raw candidate counts per
      category (full `skills.json` scan, before any trap-filtering): Heal 7, Elite 48, Utility 220,
      Weapon 919 — a very different size profile than Healing's 85/40/12/55, since almost every
      weapon skill deals damage while almost no Heal-slot skills do. Order: Heal → Elite → Utility →
      Weapon (smallest to largest), and per explicit user request 2026-08-04, each category (except
      Heal, small enough to do in one pass) is swept **one profession at a time** rather than all at
      once or via parallel background agents — land each profession's pass, stop, let the user decide
      when to continue, rather than chaining passes automatically. Profession order within a category
      follows the existing one-per-profession seed order in `damage-calc.ts`: Warrior, Guardian,
      Revenant, Ranger, Thief, Engineer, Necromancer, Elementalist, Mesmer.
      - **Heal-slot: COMPLETE** (2026-08-04). 5 of 7 candidates curated; 2 excluded as
        non-player-scaling (Engineer's Detonate Healing Turret has a wiki `power=` fixed override;
        Necromancer's Summon Blood Fiend scales off its pet's own fixed 0 Power — same reasoning
        already applied to this skill's Healing fact).
      - **Elite-slot: COMPLETE** (2026-08-04). Warrior done: all 3 candidates curated (Battle
        Standard id 14419 — 2 API ids share this name, the wiki infobox's own `id =` field resolved
        which is canonical, see the code comment; Head Butt; Winds of Disenchantment). Guardian done
        (2026-08-04): all 4 candidates curated (Artillery Barrage — no split; Dragon's Maw id 30273 —
        2 API ids share this name, wiki infobox `id =` field resolved 68686 as the stale duplicate;
        Heaven's Palm; Daring Advance id 76687 — 2 API ids share this name, wiki infobox lists both
        but only 76687 carries the `GroundTargeted` flag matching the live cast, 77198 treated as
        stale). All 4 Guardian entries are PvE/WvW+PvP splits with the WvW value steeply nerfed
        (0.01) vs. PvE (1.5-3.6), same "damage skill blunted hard in competitive modes" pattern as
        Warrior's Head Butt. Revenant done (2026-08-04): 4 of 5 candidates curated (Jade Winds —
        ids 28406/31294, the same unresolvable duplicate-id pair already noted in the Skill picker
        follow-ups section below, both curated identically since one wiki page covers both, 3-way
        PvE/WvW/PvP split 3.0/2.0/0.01; Embrace the Darkness id 28287 — 78191 is a stale duplicate, no
        split; Soulcleave's Summit — no split, fact text "Additional Strike Damage" not generic
        "Damage"; Spear of Archemorus — 3-way split 5.0/2.67/2.33). Chaotic Release (id 28075),
        Legendary Dragon Stance's elite facet's "release" damage — the equipped elite-slot id (Facet
        of Chaos, 27760, per `legends.json`) carries zero Damage fact of its own; the fact lives only
        on 28075, reachable exclusively via that skill's `flipSkill` link — was left uncurated at the
        time (an architecture gap, not a data gap) but **curated 2026-08-05** once the flip-skill
        stacked-icon display (Session 65) made 28075 independently reachable; PvE/WvW+PvP split
        4.0/0.01, WvW used, see `damage-calc.ts`. Ranger done
        (2026-08-04): 4 raw candidate ids, 3 distinct skills curated (Entangle — `strikes=4` already
        totaled to 0.8, no split; One Wolf Pack — PvE/WvW+PvP split 0.95/0.5; Perfect Storm — 2 API
        ids share this name (76979/79309), only 76979 carries the `GroundTargeted` flag matching the
        wiki infobox's own ground-target param so 79309 is a stale duplicate, 2 independently-split
        Damage facts: Traveling Tornado 2.0/0.01, Stationary Tornado (`strikes=12`, totaled) 8.4/6.0).
        The 4th raw id, Artillery Barrage (12343), is a cross-profession shared golem-summon skill
        already curated under Guardian, not a new Ranger entry. Thief done (2026-08-04): 6 raw
        candidate ids, 5 distinct skills curated (Dagger Storm — PvE/WvW+PvP split 1.33/0.4; Impact
        Strike — split 1.75/0.75; Finishing Blow, Impact Strike's chain follow-up — split 4.0/2.5;
        Uppercut, Impact Strike's other chain follow-up — split 2.25/0.01, wiki page title "Uppercut
        (Daredevil skill)" since the bare "Uppercut" title redirects to an unrelated Warrior Rampage
        transform skill; Shadowfall — split 1.5/0.01). The 6th raw id, again Artillery Barrage
        (12343), is the same cross-profession skill already curated under Guardian, not a new Thief
        entry. Engineer done (2026-08-04): 8 raw candidate ids, 3 distinct new skills curated (Supply
        Crate — 2 API ids share this name, 6183 discarded as a stale duplicate missing the
        `GroundTargeted` flag the wiki infobox's own `id =` field confirms as canonical (5868), PvE/
        WvW+PvP split 1.0/0.01; Holosmith's Prime Light Beam — 3-way split 3.0/1.0/1.5, plus a separate
        "Field Damage" fact PvE/PvP 0.5 vs WvW 0.4, API fact text carries wiki markup `<c=@abilitytype>
        Field Damage</c>`, matched verbatim; the new Amalgam spec's Flux State — PvE/WvW+PvP split
        2.0/0.01, plus a `strikes=12` "Storm Damage" fact already totaled, PvE 9.0/WvW+PvP 4.8). 1 raw
        id, Artillery Barrage (12343), is the same cross-profession skill already curated under
        Guardian. 2 more excluded as non-player-scaling — a new instance of the Heal-slot sweep's
        Detonate Healing Turret trap: Detonate Supply Crate Turrets (29518, wiki `power=2389` override
        + its own note "does not scale with player stats"; 38750 is its stale duplicate id) and
        Jade Buster Cannon (63374, the Mechanist's auto-triggered mech follow-up to Overclock Signet —
        wiki `weapon=pet|power=1250` override means this is the mech's own fixed Power, not the
        player's). Necromancer done (2026-08-04): 6 raw candidate ids, 3 distinct new skills curated
        (Plaguelands — no split, wiki's own `weapon=utility` param normalized to the Elite-slot
        convention; "Chilled to the Bone!" — PvE/WvW+PvP split 3.0/0.01; Ghastly Breach —
        `strikes=5` present -> wiki's 3.5 already totaled, verified against API's own hit_count 5 *
        dmg_multiplier 0.7 = 3.5). 1 raw id, Artillery Barrage (12343), is the same cross-profession
        skill already curated under Guardian. 2 more excluded as non-player-scaling: Summon Flesh
        Golem (10646) and its chain follow-up Charge (10647), both `type = minion` skills — the
        wiki's Minion page confirms minions "only inherit the player's Condition Damage, Condition
        Duration, and Boon Duration attributes... All other attributes, such as health, are
        determined by the minion type," the same reasoning already applied to the Heal-slot sweep's
        Summon Blood Fiend exclusion (Power isn't in that inherited list either). Elementalist done
        (2026-08-04): 8 raw candidate ids, 3 distinct new skills curated (Conjure Fiery Greatsword —
        no split, wiki's own `weapon=utility` param normalized to `unequipped`; Tornado — PvE/WvW+PvP
        split 1.1/0.01; Whirlpool, Tornado's underwater replacement, a separately-named id so it isn't
        collapsed by `skill-variants.ts`'s same-name dedup — PvE/WvW+PvP split 2.2/0.01). 1 raw id,
        Artillery Barrage (12343), is the same cross-profession skill already curated under Guardian.
        4 more excluded: Crashing Waves (25492) and Flame Barrage (25499), the Water/Fire Glyph of
        Elementals' summoned-elemental "command" follow-ups — both wiki pages explicitly state "the
        direct damage is unaffected by any modifiers such as power or might," a new phrasing of the
        same non-player-scaling trap seen elsewhere as a `power=` override; Lesser Fiery Eruption
        (44918), Conjure Fiery Greatsword's auto-triggered passive proc (wiki `parent = Conjure Fiery
        Greatsword`, `Category:Lesser skills`) — not independently equippable, and unlike Tailored
        Victory below **isn't caught by `skill-variants.ts`'s existing filters** (no
        `toolbeltSkill`/`flipSkill` link back to its parent for
        `stripNonEquippableSubAbilities`/`stripFlipTargets` to key off), so it likely still leaks into
        the live Elite picker as its own bindable-looking skill — see the follow-up item below.
        Tailored Victory (44637), Weave Self's `flipSkill` release effect (Weave Self itself, 43638,
        carries zero Damage fact of its own) — left uncurated at the time (same architecture gap as
        Revenant's Chaotic Release above) but **curated 2026-08-05** once 44637 became independently
        reachable via its own stacked flip icon; PvE/WvW+PvP split 0.75/0.01, WvW used, see
        `damage-calc.ts`. Mesmer done (2026-08-04), the last profession — **Elite-slot sweep is now
        COMPLETE**: 4 raw candidate ids, 3 distinct new skills curated (Thousand Cuts — `strikes=10`
        already totaled to 5.0, no split; Gravity Well — 2 independently-split Damage facts, Pulse
        Damage PvE/WvW+PvP 1.1/0.01 and Final Damage 2.1/0.01, both steeply nerfed in competitive
        modes like several other Elite-slot skills; Jaunt — PvE/WvW+PvP split 1.0/0.5, API represents
        the split as two identical-text "Damage" facts rather than distinct fact names). The 4th raw
        id, Artillery Barrage (12343), is the same cross-profession skill already curated under
        Guardian, not a new Mesmer entry. **Elite-slot sweep is now COMPLETE across all 9
        professions.**
      - New mechanics this sweep surfaced beyond the Healing-sweep's traps (Barrier-mislabeling,
        trait-duplicated formulas): (1) duplicate-name id resolution — the wiki infobox's own `id =`
        field states the canonical equippable id, don't guess from flags/recharge; (2) the Damage
        coefficient itself can have a PvE/WvW split (not just base-value splits like Healing), e.g.
        Supply Crate 1.0 PvE vs 0.01 WvW/PvP; (3) transformation skills (Tornado, Lich Form, Rampage,
        etc.) use their own special weapon-strength category from the wiki's Weapon Strength page's
        "non-weapons" table, not the generic `unequipped` (690.5) bucket every other slot skill uses.
      - **Utility-slot (220 raw candidates): COMPLETE, swept 2026-08-04, same
        profession-by-profession pacing as Elite-slot.** Warrior done: 21 raw candidate ids, 17
        distinct skills curated. 6 of the 21 are racial Utility skills (`professions.length === 8`,
        `specializationId` null — same shared-across-professions shape as Elite-slot's Artillery
        Barrage) curated once here and reused by reference for later professions rather than
        re-curated: Radiation Field, Shrapnel Mine, Hidden Pistol, Call Owl curated (no splits); Seed
        Turret and Grasping Vines excluded as non-player-scaling (Seed Turret's own wiki note: "damage
        ...is not affected by the creator's stats"; Grasping Vines' Damage fact has no `weapon=` param
        at all, same template shape as Seed Turret's, a new sub-variant of the turret/pet
        non-player-scaling trap — no `power=` override needed as the signal, absence of `weapon=`
        itself is suspect on an otherwise-uniform 21-candidate list). The other 15 raw ids are 13
        distinct Warrior-only skills (2 GroundTargeted duplicate-id pairs, Banner of Strength
        14405/14572 and Banner of Discipline 14407/14571 — `skill-variants.ts`'s own doc comment names
        "every Warrior Banner" as auto-resolving to the non-ground-targeted id via its GroundTargeted
        signal, so 14572/14571 are curated, not 14405/14407): Throw Bolas, Kick, Bull's Charge (all
        3 PvE/WvW+PvP split or no split), both Banners (no split), Berserker's Sundering Leap/Wild
        Blow/Shattering Blow (all PvE/WvW+PvP split), Spellbreaker's Break Enchantments (3-way
        PvE/WvW/PvP split, WvW value used), Bladesworn's Dragonspike Mine, and the new Paragon elite
        spec's "Find Their Weakness!"/"On Your Knees!" (both PvE/WvW+PvP split). Guardian done
        2026-08-04: 26 raw candidate ids (6 shared racial ones already curated under Warrior), 20
        distinct Guardian-only skills curated — Bane Signet, Signet of Judgment, Signet of Wrath,
        Smite Condition (2 split facts), Judge's Intervention; Dragonhunter's Test of Faith (2 split
        facts), Procession of Blades, Fragments of Faith, Light's Judgment; Firebrand's Flame Surge,
        Voice of Truth; Willbender's Roiling Light, Heel Crack, Whirling Light, Flash Combo;
        Luminary's Effulgent Stance (2 split facts), Piercing Stance; and all 3 Spirit Weapons (Sword
        of Justice, Shield of the Avenger, Hammer of Wisdom). **The 3 Spirit Weapons surfaced a real
        picker bug, not just a curation nuance**: `skill-variant-exclusions.json` never covers a
        group that the existing in-code signals (specifically the `GroundTargeted` collapse) already
        narrow to 1 id on their own, since `fetch-skill-duplicate-resolutions.ts` only re-checks
        groups `visibleSkillsForSlot` still returns >1 for — so it silently landed on a stale/defunct
        duplicate id for all 3 Spirit Weapons (`55027`/`55037`/`55040`) instead of the real
        currently-equippable one (`9168`/`9182`/`9125`), confirmed via each skill's wiki infobox
        `id=` field plus a wiki full-text search turning up zero hits for the stale ids. Fixed by
        adding the 6 stale ids to `skill-variant-exclusions.json` directly and re-verified against
        the real (not reimplemented) `visibleSkillsForSlot` via a throwaway tsx script — see
        docs/game-data.md for the full writeup. Worth auditing whether other professions' Utility/
        Heal/Elite groups have the same "signal-4-collapsed-before-the-wiki-check-ran" blind spot;
        none found elsewhere in this leg, but the rest of the roster (Revenant onward for Utility,
        plus Weapon-slot entirely) hasn't been checked for it yet (none found in Revenant's own leg
        below either). Revenant done 2026-08-04: 27 raw candidate ids, resolved via the real
        `visibleSkillsForSlot` (same throwaway-script verification as Guardian's Spirit Weapons) down
        to 12 distinct in-game skills — 9 fully curated (Vengeful Hammers, Forced Engagement,
        Impossible Odds — a 3-way PvE/WvW/PvP split; Elemental Blast — 3-strike total per the wiki's
        own note; Banish Enchantment and Call to Anguish, each curated under 2 ids since Conduit
        reworks both under separate spec-gated ids sharing the same wiki page; Phase Traversal,
        Inspiring Reinforcement — a rare PvE+PvP-grouped-vs-WvW-alone split, the reverse of the usual
        pattern; Nomad's Advance, Scavenger Burst, Reaver's Rage, all 3 Legendary Alliance/Vindicator
        skills), 1 partially curated (Beguiling Haze — only its "Follow-Up Damage" fact, no split; the
        main "Damage" fact's WvW+PvP side has no wiki `coefficient=` param to read, only a raw tooltip
        number that doesn't cleanly back-solve), 2 fully excluded (Hex-Eater Vortex, Gladiator's
        Defense — both wiki-stub-tagged for a missing damage coefficient outright). All 3 partial/
        excluded skills are Conduit's (this app's newest elite spec, released 2025-08-19) — the wiki
        apparently hasn't finished documenting that spec's coefficients yet, same "unfilled
        coefficient" bucket as Guardian's Repose. Also surfaced: Call to Anguish's auto-target id
        (the one the picker actually shows) carries a stale local `Damage` fact missing the WvW split
        its GroundTargeted sibling has — harmless for curation since only fact *presence* is needed to
        key off, not its cached value. Ranger done 2026-08-04: 25 raw candidate ids (6 shared racial
        ones already curated under Warrior, not re-curated), 10 distinct Ranger-only skills curated
        (Spike Trap, Signet of the Wild, Frost Trap, Lightning Reflexes, Viper's Nest, Flame Trap —
        the last one a genuine per-pulse fact, not totaled, since its local text literally says
        "Damage per Pulse"; Untamed's Exploding Spores; Galeshot's Mistral, Wind Shear, Piercing
        Gales). **Verifying against the real `visibleSkillsForSlot` surfaced a fresh instance of the
        Guardian Spirit Weapons picker bug**: "Mistral" has 2 API ids sharing one name (76757
        GroundTargeted/79324 not); the wiki infobox only documents 76757 (`id = 76757`, `ground
        target = line`) and a wiki full-text id search finds zero hits for 79324 anywhere — the app's
        default GroundTargeted-collapse signal was silently picking the undocumented stale duplicate
        (79324) as the picker's shown id. Fixed the same way as Guardian's fix: added 79324 to
        `skill-variant-exclusions.json` directly, re-verified via a throwaway tsx script that the
        real `visibleSkillsForSlot` now resolves to 76757. 1 excluded as non-player-scaling: Call
        Lightning (12598) — its own wiki page's Mechanics section states the damage "uses the [Storm
        Spirit]'s power (1580) and weapon strength," the summoned spirit's own fixed stats, not the
        player's, same trap as this sweep's other turret/pet/minion exclusions. 6 more left uncurated
        (Glyph of the Tides/Alignment/Equality's damage-dealing casts) — at the time, a "Damage fact
        unreachable via the current UI" architecture gap, same family as Revenant's Chaotic
        Release/Elementalist's Tailored Victory but via `glyphFormVariants` rather than `flipSkill`.
        **The rendering gap itself is now fixed** (Session 64, COMPLETED.md — `glyph-forms.ts`'s
        `glyphFormFactSourceSkill` + `SkillsEditor.tsx` now swap in the correct form's real facts
        based on the build's Celestial Avatar toggle); curating these 6 ids' Damage coefficients is
        still open, just no longer blocked — see the dedicated TODO item near the top of this file.
        `CURATED_HEALING_COEFFICIENTS`'s 2 pre-existing celestial-form entries (Ranger's Glyph
        of Alignment 31348, Glyph of Burgeoning 31888, from the 2026-08-02 Healing sweep) are
        confirmed reachable now too, verified directly rather than assumed. See `damage-calc.ts`'s
        Ranger Utility-slot block comment for the full writeup. Thief done 2026-08-04: 20 raw
        candidate ids (6 shared racial ones already curated under Warrior, not re-curated), 11
        distinct Thief-only skills curated (Scorpion Wire; Daredevil's Impairing Daggers, Reflexive
        Strike, Distracting Daggers, Palm Strike — 2 independently-split Damage facts, "Damage" and
        "Second Strike Damage" — Fist Flurry; Deadeye's Shadow Flare, Binding Shadow, Shadow Gust;
        Specter's Well of Sorrow, Well of Tears). A "priming" variant of the flip-architecture gap:
        Thief's 2 Preparation skills (Prepare Pitfall id 13057, Prepare Thousand Needles id 13026) are
        the actually-equippable ids per `skill-variants.ts`'s `stripFlipTargets` (which drops their
        differently-named `flipSkill` targets, Pitfall 56880/Thousand Needles 56898, from the picker),
        and unlike every earlier flip-gap case the equippable id here carries ZERO facts of its own —
        not even a placeholder — so there was no substitute id to curate under at the time; both left
        excluded, worse than a partial gap. Deadeye's Shadow Flare hits a related but survivable case:
        it also has a differently-named flip target (Shadow Swap, 45672) stripped by the same signal,
        but Shadow Flare itself already carries its own Damage fact (the initial throw, independent of
        the swap-back detonation) so it's curated normally; Shadow Swap's own separate Damage fact was
        the other excluded-at-the-time one. **All 3 curated 2026-08-05** once each became independently
        reachable via its own stacked flip icon: Pitfall (56880, 2 independently-split facts —
        "Initial Impact Damage" PvE/WvW+PvP 1.25/0.01, "Pulse Damage" 0.5/0.3, WvW used for both),
        Thousand Needles (56898, no split — "Damage" 0.5, "Pulsing Damage" 0.2), Shadow Swap (45672,
        no split — 1.0). See `damage-calc.ts`'s Thief Utility-slot block comment. Also worth noting:
        Well of Sorrow/Well of
        Tears both have a separate "Number of Impacts: 5" fact alongside their Damage fact, but neither
        wiki page's Damage fact carries a `strikes=` param and both local API `hit_count`s are 1 (not
        5) — confirmed via Well of Sorrow's own Mechanics note, which describes only a 5-pulse
        *condition* order, never a repeated direct-damage strike — so neither needed totaling, unlike
        Guardian's Symbol of Blades/Ranger's Flame Trap earlier in this sweep. Engineer done
        2026-08-04: 49 raw candidate ids (6 shared racial ones already curated/excluded under
        Warrior, not re-curated), 43 Engineer-only raw ids resolved via the real
        `visibleSkillsForSlot` (run once per Engineer elite spec — Scrapper/Holosmith/Mechanist/
        Amalgam — plus a spec-less baseline, same throwaway-tsx-script verification as earlier legs)
        down to 17 distinct in-game skills: 11 curated (Personal Battering Ram; Rocket Boots, 2
        genuinely-ambiguous ids 5910/29522 both curated identically per docs/game-data.md's own prior
        investigation of that pair; Throw Mine, same dual-id treatment for its Gadgeteer-trait-gated
        pair 6161/30337; Scrapper's Shredder Gyro; Blast Gyro; Holosmith's Laser Disk; Mechanist's
        Superconducting Signet, Force Signet; Amalgam's Liquid State, Solid State, Plasmatic State).
        **New non-player-scaling category found, generalizing what earlier legs had only excluded
        one skill at a time**: every base turret-*deploy* skill's own Damage fact carries the exact
        same `power=2389` override — Rifle Turret, Flame Turret, Thumper Turret, Rocket Turret,
        Harpoon Turret, all 5 excluded — confirmed by the wiki's general "Turret" page itself:
        "turrets are unaffected by character's stats and cannot critically hit," the same fixed-Power
        shape already seen on individual turret sub-abilities (Detonate Supply Crate Turrets, Jade
        Buster Cannon, both Elite-slot) now shown to cover the whole turret family's own attacks, not
        just their detonate/overcharge follow-ups — worth excluding any future turret-shaped summon
        skill from any profession the same way without re-deriving this from scratch. Holosmith's
        Photon Wall (43739, the actually-equippable id) carries zero Damage fact of its own — the fact
        lives only on its `flipSkill` target Launch Wall (40533), left uncurated at the time (same
        architecture gap as Chaotic Release/Tailored Victory above) but **curated 2026-08-05** once
        40533 became independently reachable via its own stacked flip icon; PvE/WvW+PvP split 1.5/0.5,
        WvW used, see `damage-calc.ts`. Necromancer done
        2026-08-04: 24 visible ids carry a Damage fact (6 shared racial already curated under
        Warrior, not re-curated), resolved via the real `visibleSkillsForSlot` run once per
        Necromancer elite spec (Reaper/Scourge/Harbinger/Ritualist — this app's newest elite spec,
        released 2025-08-19) plus a spec-less baseline; all 4 spec runs returned the identical 49-id
        visible set, no spec-gated duplicate groups this time. 18 Necromancer-only ids: 14 curated
        (Blood Is Power, Epidemic, Signet of the Locust, Signet of Spite; Well of Corruption/Well of
        Suffering, both id-fixed via wiki infobox `id=` the same way as earlier duplicate pairs, both
        genuine 3-way independent PvE/WvW/PvP splits with `strikes=6` already totaled, WvW value used;
        Reaper's 4 shouts "You Are All Weaklings!"/"Nothing Can Save You!"/"Suffer!"/"Rise!", all
        PvE/WvW+PvP split, WvW used, each also carrying an unmodeled "damage increase" melee-range
        bonus fact same as this table's existing "Your Soul Is Mine!" entry; Scourge's Trail of
        Anguish/Sand Swell/Desiccate; Ritualist's Splinter Weapon, another genuine 3-way independent
        split 0.4/0.25/0.5, WvW used, API representing it as 3 identical-text "Damage" facts same
        shape as Mesmer's Jaunt). **New minion sub-case of the established non-player-scaling trap**:
        all 4 base minion-summon skills (Summon Bone Fiend, Summon Bone Minions, Summon Flesh Wurm,
        Summon Shadow Fiend) are wiki `type = minion` and each states the summoned minion's own fixed
        Power at level 80 (e.g. Bone Fiend "1,500", Flesh Wurm "~1,650") — same "minion's own stats,
        not the player's" reasoning as Summon Flesh Golem/Charge (Elite-slot sweep); all 4 excluded.
        Elementalist done 2026-08-04: 19 visible ids carry a Damage fact after fixing 2 real picker
        bugs this leg surfaced (6 shared racial ones already curated/excluded under Warrior, not
        re-curated); all 5 spec runs (baseline + Tempest/Weaver/Catalyst/Evoker) returned the
        identical visible set. **Bug #1**: Lightning Flash and Signet of Water each have a
        GroundTargeted duplicate-id pair where, unlike every other such pair in this sweep, the
        *ground-targeted* id (5536, 5570) is the wiki's own documented canonical one and the
        auto-target id (50447, 49056) is a confirmed-stale duplicate (zero wiki search hits) — the
        app's usual auto-target-preferred signal picked the fake side, the reverse of every prior
        instance of this bug class (Guardian Spirit Weapons, Ranger Mistral). Fixed by adding
        50447/49056 to `skill-variant-exclusions.json`. **Bug #2**: `skill-variants.ts`'s
        attunement-collapse signal only fires within a same-named group, but Glyph of Storms and
        Glyph of Renewal each describe their 4 attunement variants under distinct flavor names (Ice
        Storm/Firestorm/Lightning Storm/Sandstorm; Renewal of Air/Earth/Fire/Water) rather than
        reusing the base skill's name, and Glyph of Elemental Power partially does the same for its
        Air/Fire variants — so 16 non-equippable variant ids were leaking into the Utility picker as
        singleton groups, 6 of them (the 4 Storms plus Glyph of Elemental Power's Air/Fire variants)
        carrying a Damage fact that was about to get curated as if independently equippable. Fixed by
        adding all 16 to `skill-variant-exclusions.json` (Glyph of Elementals, Elite-slot, shares its
        variants' exact name like Glyph of Lesser Elementals and was unaffected). 13 distinct skills
        curated (Lightning Flash, Arcane Blast, all 4 Signets, Arcane Wave — a rare *inverted*
        PvE/WvW split, 1.4/1.7, WvW higher — Arcane Shield; Tempest's 3 shouts; Weaver's Primordial
        Stance; Catalyst's Shattering Ice). Evoker's (this app's newest elite spec, released
        2025-08-19) 3 Meditations (Hare's Agility, Toad's Fortitude, Fox's Fury) hit a
        confirmed-correct instance of the flip-architecture gap (Chaotic Release/Tailored
        Victory/Launch Wall/Thief's Preparation skills) — the app's flip-root pick exactly matches the
        wiki's own documented id in all 3 cases, but the equippable id's local facts are sparse and
        never include the real Damage fact, which the API attaches only to the flip target. **All 3
        curated 2026-08-05** under their flip-target ids (76583/77247/77282) once independently
        reachable via their own stacked flip icons: Hare's Agility (PvE/WvW+PvP split 0.4/0.5 — a rare
        *inverted* split like Arcane Wave above, WvW used), Toad's Fortitude (1.5/0.5, WvW used),
        Fox's Fury (no split, but 3 independently-split-by-Might-stacks facts: 3.0 over 20 Might,
        2.25 at 10–20 Might, 1.5 under 10 Might). See `damage-calc.ts`'s Elementalist Utility-slot
        block comment. Mesmer done 2026-08-04, the last profession — **Utility-slot sweep is now
        COMPLETE across all 9 professions**: 61 raw candidate ids (6 shared racial ones already
        curated/excluded under Warrior), resolved via the real `visibleSkillsForSlot` run once per
        Mesmer elite spec (Chronomancer/Mirage/Virtuoso/Troubadour — this app's newest elite spec,
        released 2025-08-19) plus a spec-less baseline — all 5 runs returned the identical 49-id
        visible set, no spec-gated duplicate-id groups. 11 Mesmer-only skills curated: Phantasmal
        Disenchanter (2 independently-split Damage facts, "Damage without Boons"/"Damage with Boons"),
        Phantasmal Defender, Well of Senility, Well of Calamity (2 independently-split per-pulse
        facts, "Pulse Damage"/"Final Damage" — Final Damage is a rare *inverted* PvE/WvW split, WvW
        higher, same reverse-of-usual shape as Arcane Wave/Inspiring Reinforcement), Well of Action,
        Virtuoso's Sword of Decimation/Rain of Swords/Psychic Force, Mirage's Crystal Sands/Mirage
        Advance, and spec-less Mirage Mirror. Rain of Swords' wiki page flags a
        `<!-- GroundTargeted Version: 45425 -->` sibling id, same shape as every other GroundTargeted
        duplicate pair this sweep resolved — `visibleSkillsForSlot` already collapses to the
        non-ground-targeted 62553 on its own, no picker fix needed this time. **New trait-duplicated-
        fact wrinkle, distinct from the Healing sweep's Assassin's Reward/Transfusion shared-formula
        trap**: 5 of the 11 curated skills (Phantasmal Disenchanter, Phantasmal Defender, Sword of
        Decimation, Rain of Swords, Psychic Force) each carry 2-4 *extra* same-text "Damage" facts
        gated by `requires_trait` (a per-skill damage-boosting trait's own alternate value, not a
        cross-skill shared formula) — `damageLinesForSkill`'s `allFacts.find` matches same-text facts
        in local array order, and every one of these 5 skills' base (non-trait) fact sorts first
        locally, so keying on the base value always resolves to the ungated fact regardless of
        `activeIds`; verified directly via `damageLinesForSkill` with an empty `activeIds` set for all
        11 entries rather than assuming. The trait-gated duplicates aren't modeled, same "real bonus,
        not represented" treatment already applied to this table's "damage increase" fact omissions
        (Reaper's shouts, "Your Soul Is Mine!"). See `damage-calc.ts`'s Mesmer Utility-slot block
        comment for the full writeup.
      - **Weapon-slot (919 raw candidates), last category in the sweep order — started 2026-08-05,
        one profession leg at a time, stopping between legs for a check-in.** Unlike
        Heal/Elite/Utility, weapon skills resolve via a completely separate mechanism —
        `weapon-calc/weapon-skills.ts`'s `resolveSkillBarIds`/`weaponSkillIdsForPair`, not
        `skill-variants.ts`'s `visibleSkillsForSlot` — so the raw candidate count per profession is
        found by enumerating every `profession.weapons` entry across every land/underwater
        environment and every elite-spec combo (a throwaway script, same verification-against-the-
        real-resolver discipline as prior legs' `visibleSkillsForSlot` scans). Warrior done
        2026-08-05: 63 raw candidates, 62 curated (the 63rd, Whirling Axe id 14399, was already
        seeded 2026-08-02) — 1 research agent fetched all 61 remaining wiki pages via curl (not
        WebFetch's summarizing model). New mechanics this leg surfaced: (1) land Spear (added by the
        2025-08-19 Janthir Wilds "Weaponmaster Training" update) shares its `weapons.Spear` entry
        with the pre-existing aquatic-only Spear autoattack chain, disambiguated by the same
        `NoUnderwater`-flag land/water split as every other dual-environment weapon — both are
        independently curated; (2) Spear and Speargun use the wiki's own `weapon=spear`/`weapon=
        harpoon gun` template values as distinct `WEAPON_STRENGTH_MIDPOINTS` keys (both 1000,
        matching the wiki's own "all 3 aquatic types share this range" footnote) rather than the
        existing generic `aquatic` key; (3) a stale/live-tooltip-text mismatch on trait 1338
        (Forceful Greatsword) — its live description no longer states a damage percentage since a
        2018-12-11 rework replaced it with flat Power, but the live API's traited `dmg_multiplier`
        for every one of its 5 gated Spear/Rifle facts still empirically matches the old wiki-quoted
        +10% exactly, used as confirmed-correct despite the stale tooltip. Every trap family already
        established in this sweep was checked and none applied to Warrior's weapon skills (no
        non-player-scaling exclusions, no duplicate-id pairs, no flip-architecture gaps). See
        `damage-calc.ts`'s new Weapon-slot block comment for the full writeup. **Next up (not
        started): Guardian, Revenant, Ranger, Thief, Engineer, Necromancer, Elementalist, Mesmer, in
        that order** — stop after each leg for a check-in, don't chain them.
- [ ] Mesmer's Tale of the Second Scion (id 76695) also grants "Scion's Reprieve," a self-buff
      (+15% WvW/PvP Heal Effectiveness on the caster) that neither this skill's Healing tooltip line
      nor any other app mechanism accounts for — a genuinely separate gap from the zero-facts issue
      resolved 2026-08-04 (see `synthetic-facts.json`/COMPLETED.md), since the buff isn't itself a
      Healing fact, it modifies *other* incoming/outgoing heals. This app has no general "outgoing/
      incoming heal modifier" concept anywhere yet (distinct from the boon/condition uptime system) —
      needs scoping before fixing, not a one-off patch just for this skill.
- [ ] Healing-coefficient curation strategy changed 2026-08-02: user explicitly rejected build-by-
      build curation ("the spirit of theorycrafting is scouting all classes for unique optimizations,
      not just through builds") in favor of a full category sweep across all professions before
      moving to the next category. `CURATED_HEALING_COEFFICIENTS` (`healing-calc.ts`) is now a
      complete pass over every equippable Heal-slot skill with a qualifying `AttributeAdjust`/
      `target: 'Healing'` fact (85 candidates found via a full `skills.json` scan; parallel research
      agents per profession fetched each skill's raw wikitext directly via curl — never through
      WebFetch's summarizing model, which caused a real wrong-number error earlier this session, see
      `healing_damage_coefficient_curation` memory). Utility-slot skills were swept the same way
      2026-08-02 (40 candidates found via the same scan approach, but 17 were the API mislabeling a
      Barrier fact as Healing — see the new Barrier item below; of the 23 genuine Healing candidates,
      20 landed in the table, 3 stayed uncurated, see below). Elite-slot skills were swept 2026-08-02
      too (only 12 candidates — 1 was the same Barrier trap, excluded; of 11 genuine candidates, 10
      landed in the table, 1 stayed uncurated, see below). **Weapon-slot skills swept 2026-08-02,
      the last category in the agreed plan** — of 648 distinct weapon-skill ids across every
      profession's weapons (including the newer Janthir Wilds Spear), 110 carried a Healing-type
      fact; 17 were the Barrier trap (excluded) and a newly-found third trap surfaced too: 38
      candidates (nearly every initiative-costing Thief skill) turned out to be one shared trait,
      Assassin's Reward (id 1238, "heal per initiative spent"), duplicated onto each skill's own
      facts via `requires_trait` — a trait-bonus formula, not a per-skill design, so none of those
      38 are curated either (see the dedicated item below). Necromancer's Chillblains (id 10605) is
      a one-off instance of the same shape (only healing fact requires trait 778, Transfusion) and
      is excluded the same way. Of the remaining 55 genuine candidates, 49 landed in the table
      (`healing-calc.ts`'s new "Weapon-slot skills" section), 6 stayed uncurated — see below.
      `CURATED_HEALING_COEFFICIENTS` is now a complete pass over Heal + Utility + Elite + Weapon
      slots across every profession.
      1 Elite skill was investigated but left uncurated:
      - **Revenant 29114 (Energy Expulsion, Legendary Centaur Stance flip-skill)**: a fresh live
        `/v2/skills/29114` API pull (not just this app's cached `skills.json`) still returns a
        completely different fact set — a "Healing Fragment"/"Number of Fragments"/"Knockback"
        mechanic — than the wiki's current page describes (a single knockdown+heal, no fragments at
        all). A genuine, unresolved API/wiki mechanic mismatch, not a stale local cache — left
        uncurated rather than guessing which source to trust.
      3 Utility skills were investigated but left uncurated, same reasoning bar as the Heal-skill
      gaps below — don't just re-guess a coefficient:
      - **Guardian 31295 (Sanctuary, underwater/self-cast variant)**: shares its name with id 9128 but
        is a distinct, frozen-in-a-pre-2016-balance-pass copy (no `GroundTargeted` flag, half the
        radius) — the wiki's "Sanctuary" page only documents 9128's formula, no coefficient exists
        anywhere for 31295. Underwater is out of scope for WvW anyway (see the underwater-toggle
        nice-to-have below), so likely not worth chasing further.
      - **Guardian 62669 (Repose)**: the wiki page is literally tagged `{{stub|skill|heal coeff}}` —
        base values are documented (PvE 2595 vs WvW/PvP 1635) but the coefficient itself is an
        unfilled `?` placeholder on the wiki, not something this app can derive.
      - **Revenant 29082 (Natural Harmony, Ventari facet)**: wiki lists base value 1124, but a fresh
        `/v2/skills/29082` API pull independently confirmed this app's own known base value (1620) is
        current and correct — a real, reconfirmed wiki/API disagreement, not a stale read.
      A handful of Heal skills were investigated but left uncurated — each needs a fresh look before
      being added, don't just re-guess a coefficient:
      - **Elementalist 44239 (Aquatic Stance)**: wiki's current skill-fact template (base 6400)
        matches neither this app's own API base value (6480) nor the wiki's own most recent
        version-history text (which also says 6480) — looks like a stale/unedited wiki template.
      - **Engineer 63049 (Rectifier Signet)**: the Mech Core: J-Drive trait-upgraded pulse heal
        (`requires_trait` 2298) has no wiki skill-fact template at all, only incomplete prose in the
        Notes section that doesn't even cover all 3 game modes.
      - **Engineer 76738 (Mitotic State)**: this app's own API base value (305) doesn't reconcile with
        either wiki-listed value (7625 PvE/WvW, 5500 PvP) — 7625/305 = 25 exactly, suggesting 305 may
        be a per-tick amount from a 25-tick heal-over-time while the wiki fact is the pre-summed
        total, but no interval/tick-count fact confirms this on the wiki page.
      - **Necromancer 10547 (Summon Blood Fiend)**: the pet's heal scales off the pet's own fixed
        (permanently-0) Healing Power stat, not the player's — the wiki fact has no `coefficient=`
        param at all, consistent with this being a genuinely non-scaling number for this app's
        formula.
      - **Necromancer 10670 (2nd Well of Blood id)**: shares Well of Blood's wiki page/values with id
        10527 (already curated), but this app's own API base values for 10670 (5240/280) don't match
        either the PvE or WvW reading of that shared page — likely a Scourge-context variant the wiki
        doesn't separately document.
      - **Revenant 26937 (Enchanted Daggers)**: the "Initial Heal" fact has a wiki base value (1640)
        that doesn't match this app's own API base value (1560) — a real +80 wiki/API discrepancy
        (the same offset also shows up on this skill's Siphon Damage facts), so unclear which source
        is stale.
      5 Weapon-slot skills were investigated but left uncurated, same reasoning bar as above:
      - **Elementalist 72982 (Etching: Jökulhlaup, Spear)**: wiki's own `{{skill fact|healing|532}}`
        template has no `coefficient=` parameter at all.
      - **Necromancer 30860 (Death Spiral)**: wiki page is explicitly tagged
        `{{stub||missing siphon coefficients}}` — neither Life Siphon Healing fact has a documented
        coefficient.
      - **Necromancer 69302 (Life Siphon)**: wiki base values (450 PvE / 300 WvW+PvP) don't match
        this app's API values (537 / 238) under either mode ordering — a genuine, unexplained
        conflict.
      - **Ranger 31889 (Astral Wisp, post-2026-07-15 rework)**: wiki's rewritten page gives one base
        value (1288) across all modes with only the coefficient split, but the API shows two
        duplicate-text facts both valued 322 (~1288/4) — a pulse-count relationship neither source
        documents post-rework. Left uncurated rather than guessing the pairing.
      - **Thief 72991 (Shadow Veil, Spear)**: two facts share the identical factText "Healing" (2570
        and 1290) and the wiki only documents a coefficient for one of them (1290) — since this
        table matches facts by factText alone, curating it risks binding the coefficient to whichever
        fact `Array.find` happens to return first. Left entirely uncurated.
- [ ] Trait-bonus healing formulas smeared across many skills' own facts, surfaced by the weapon-skill
      sweep 2026-08-02: Thief's Assassin's Reward trait (id 1238, Deadly Arts, "heal yourself for
      each point of initiative spent") shows up as a `requires_trait`-gated Healing fact on ~38
      different weapon skills (nearly every initiative-costing one), and Necromancer's Transfusion
      trait (id 778) does the same to Chillblains (id 10605). Neither is curated in
      `CURATED_HEALING_COEFFICIENTS` — a shared trait formula duplicated per-skill by the API isn't a
      per-skill design, same reasoning already used to leave Signet of Courage's Perfect
      Inscriptions-boosted variant unreflected. If this app ever wants to show these, the right shape
      is a small generic trait-bonus table (like `FURY_CRIT_CHANCE_TRAIT_BONUSES`) — one entry per
      trait with its own wiki-verified per-point coefficient, applied to whichever skill's
      requires_trait-gated fact matches, rather than 38+ near-duplicate per-skill entries. Worth
      checking whether other professions have an equivalent "heal on X while this trait is active"
      trait before scoping — Assassin's Reward/Transfusion may not be the only two.
- [ ] Follow-up to the tooltip-overhaul items above, noted 2026-08-02, updated 2026-08-02: trait
      and food/utility tooltips now carry real structured content (traits: `numericFactLines` lines
      appended below the description via `factsBlock`, same as skills; food/utility:
      `formatConsumableDescription` in `format-description.ts` builds `bonuses[].raw` lines + a
      `Duration:` line from `durationMs`/`applyCount`, falling back to raw `description` only for
      buff-less consumables like Feast reagents — `effectName` deliberately left unused, it's just
      the buff category label ("Nourishment"/"Enhancement") and added no useful info next to the
      bonus lines already shown). The Healing/Damage tooltip breakdown item above has now landed
      (2026-08-02, both halves) — this visual pass is unblocked. Do a dedicated visual pass over
      **every** tooltip in the app — traits, skills, gear stat prefixes, runes, sigils, relics,
      food/utility, infusions — so they read like a single coherent design instead of whatever shape
      each one organically grew into while the content work landed. Target look: in-game GW2
      tooltip / gw2skills.net conventions (rarity-colored item name header, icon next to title, a
      divider between name and effect text, stat lines as a tidy list rather than a wrapped
      paragraph, muted/secondary color for flavor text vs. bright color for real numeric bonuses).
      Starting point already exists — `Tooltip.tsx`'s `TooltipBody` plus `global.css`'s
      `.tooltip-*` rules (`.tooltip-title`, `.tooltip-description`, `.tooltip-numeric-facts`,
      `.tooltip-boon-facts`, `.tooltip-skill-variant`) already give skills a semi-structured layout
      — extend that shared vocabulary to the newly-enriched tooltip types rather than inventing new
      one-off styling per content type.
- [ ] Curate more trait attribute bonuses (`trait-attributes.ts`, added 2026-08-02). Traits can
      grant a flat attribute bonus or an attribute-to-attribute % conversion — found via a user
      cross-check against gw2skills.net (Revenant/Salvation's "Life Attunement" was silently
      missing from our totals). Only that one trait is curated so far (verified: +120 Healing
      Power, 7% Healing→Concentration). A `traits.json` scan found **~190 more candidates**
      (168 traits with an `AttributeAdjust` fact, 25 with `BuffConversion`) but **the fact type
      alone doesn't mean "you passively gain this"** — confirmed live that "Healer's Gift" (also
      Revenant/Salvation) has an unambiguous single-value `AttributeAdjust` fact that's actually
      the base-heal coefficient for its own dodge-roll proc, not a stat grant at all. Each
      candidate needs its trait *description* read for genuine unconditional "gain X" language
      (not a skill/proc/conditional effect) before being added, same wiki-verification rigor as
      every other curated table in this codebase (`CURATED_RELIC_DAMAGE_BONUSES`,
      `FURY_CRIT_CHANCE_TRAIT_BONUSES`) — add entries incrementally as specific builds get tested,
      not as a bulk pass. A concrete second example surfaced 2026-08-02: Vindicator's "Empire
      Divided" (Power +240 / Healing Power +240) is **conditional** on being above/below a 50%
      health threshold, not unconditional like Life Attunement — that's a different shape than
      `CURATED_FLAT_BONUSES` handles (which assumes "always active once the trait is active") and
      would need its own `CombatState`-style toggle (like `furyActive`) before it could be modeled
      safely; don't force it into the unconditional table. Note: the *dominant* Stats-panel
      discrepancy the user was chasing across Sessions 49-51 turned out to be a separate, bigger
      bug (see COMPLETED.md Session 51, `itemStatId` category mismatch) — trait bonuses are a real
      but comparatively small remaining gap now.
- [ ] Discord bot (client of the backend API) — scoped 2026-08-01: the worker
      (`worker/src/index.ts`) is currently just an anonymous KV blob store with 2 endpoints —
      `POST /shares` (create) and `GET /shares/:id` (fetch by random id). There is **no** user-
      account concept and **no** "list a user's builds/squads" endpoint, so a bot can only do
      "given a share link/id, post an embed of that build/squad" today — it cannot browse or
      manage anyone's saved library. Real scoping blocked on: what should the bot actually do
      (post-a-share-as-embed only, vs. a fuller command set that would need new
      auth+listing endpoints on the worker, a bigger lift than the bot itself)? Needs a follow-up
      conversation on desired bot commands before this can be sized.
- [ ] Capacitor port for iOS/Android — scoped 2026-08-01: the seam is real but two-part, not just
      "swap storage adapter." (1) `StorageAdapter`/`Repository<T>` (`src/shared/storage/
      storage-interface.ts`) is already backend-agnostic — a Capacitor build needs a new
      implementation (e.g. `@capacitor-community/sqlite` or Preferences) satisfying the same
      interface, replacing `sqlite-storage.ts`. (2) The renderer never calls that interface
      directly — it goes through the Electron-only preload bridge (`window.gw2Storage`, wired in
      `src/preload/index.ts` + `src/main/ipc/storage-ipc.ts`), which has no Capacitor equivalent;
      a Capacitor build would call its storage plugin directly from the renderer instead of over
      IPC, so `window.gw2Storage`'s call sites need a platform-neutral seam (or a Capacitor-side
      shim that mimics the same shape) rather than assuming Electron IPC always exists.
  - Native HTML5 drag-and-drop (squad editor) has no touch-input equivalent yet — needs a touch
    fallback if/when this lands.
- [ ] Automatic game-data refresh mechanism (balance patches) — manual refresh only for now.
      Decided 2026-07-31: check for updates on app launch, prompt the user to refresh (not a silent
      scheduled background refresh) — user stays in control of when the fetch runs. Scoped
      2026-08-01, mechanism still undecided (needs a follow-up decision before implementing):
      `data/game-data/meta.json` currently only records `fetchedAt`, not a GW2 API build/version
      number, so "is there a new patch" isn't even detectable yet under either option below.
      - **Option A — live re-scrape in-app**: bundle the existing fetch/scrape pipeline
        (`scripts/fetch-*.ts`, currently dev-only Node/tsx scripts hitting the GW2 API + wiki) into
        the packaged app so it can re-pull data on demand. Bigger lift: those scripts assume a dev
        Node environment and write straight to `data/game-data/*.json` in the repo, not a
        packaged app's writable user-data directory, and wiki-scraping from a shipped consumer app
        is fragile (layout changes break it with no one watching).
      - **Option B — piggyback on the auto-updater**: "new data available" just means "new app
        version available" — reuse the Settings-tab update flow already shipped
        (`src/main/updater/auto-updater.ts`). Data only changes via a new release; no in-app
        scraping. Simpler, but means a data-only fix still requires a full version bump/release.
      - Detecting a patch either way likely means fetching GW2 API's `/v2/build` endpoint (a single
        integer) on launch and comparing to a stored last-known value — that part is small and
        needed regardless of which option is chosen.
      - **Curation-side change detection — separate question, direction chosen 2026-08-04.** The
        above is about getting fresh data *to users*; this is about how *we* know a balance patch
        changed a coefficient we've already curated, so `CURATED_DAMAGE_COEFFICIENTS`/
        `CURATED_HEALING_COEFFICIENTS`/`skills.json` don't silently go stale after every patch. The
        official forums are too vague to parse reliably (confirmed via the Renegade trait rework
        patch as an example — several changes there are prose-only, e.g. "moved the strike damage
        bonus into Heartpiercer," with no stated number at all). Better source: the wiki's own
        Game_updates page and its per-patch subpages, which wiki editors already transcribe into
        precise `"X coefficient from A to B"` deltas per skill/profession — mechanically diffable.
        Direction: fetch the Game_updates index, find patch pages newer than our last check, pull
        their raw wikitext, regex for "coefficient from," and cross-reference matched skill names
        against our curated tables to flag exactly which entries need re-verification — far cheaper
        than a periodic full resweep. **Known limitation, not solved by this**: prose-only reworks
        (moving a bonus between traits, changing a trait's own %, anything without an explicit
        "coefficient from X to Y" line) produce no diffable signal — those still need either a human
        reading the patch notes or the trait-bonus-table items above/below being kept current enough
        that a periodic trait re-review would catch drift. Not yet built — this is a direction, not
        an implementation.
- [ ] Stretch, deferred 2026-08-01: frame a build's "last updated" (now shown plainly as a relative
      timestamp on its card, see COMPLETED.md) relative to GW2 balance patches instead — e.g. "not
      reviewed since the last patch" — rather than just "3 days ago". Blocked on the same
      patch-build-number detection the item above needs (`/v2/build` polling + a stored
      last-known-build value don't exist yet); revisit once that mechanism is decided rather than
      building a second, parallel patch-tracking path here.

## Stats panel / boon-condition bar polish

- [ ] Boon tab / Squad tab: distinguish self-only vs. party-wide (up to 5) boon sources. Confirmed
      2026-08-01 the raw GW2 API data (already ingested into `data/game-data/skills.json`) carries
      this signal: a skill's `facts` array includes a `type: "Number"` fact with
      `text: "Number of Targets"` or `"Number of Allied Targets"` (`value` usually 5) alongside its
      `Buff` facts when the skill hits allies; purely self-targeted buffs (e.g. Signet of Fury/
      Signet of Might's passive/active) carry no such fact. `Fact` (`src/shared/types/game-data.ts`)
      already round-trips this via its index signature, but `extractFromFacts`
      (`src/shared/boon-calc/sources.ts`) currently ignores `Number` facts entirely — would need a
      `targetCount: number | null` (null = self only) added to `BoonConditionSource`, read from the
      first `Number` fact whose `text` contains "Target" among a skill's facts. Known caveats before
      building this: (1) the facts array is flat, so a skill with a self-only buff AND a separate
      ally-only buff in the same list (rare, not yet found a concrete example) can't be bound
      per-buff-line without a positional heuristic; (2) no WvW-style override table exists yet for
      target count the way `wvwFactOverrides` exists for duration, so any trait/WvW-driven target-
      count change would need the same manual wiki-verification pass docs/game-data.md describes for
      durations; (3) stationary sources (banners/wells/spirits) haven't been spot-checked for the
      same fact shape.
- [ ] Minor, unconfirmed: possible Ascended-vs-Exotic filter tabs on the itemstat-combo picker — no
      screenshot exists confirming this is real; leave as-is unless it resurfaces with a concrete
      example.

## Skill picker follow-ups

- [ ] 4 duplicate-named Heal/Utility/Elite skill groups still show duplicate entries in the picker
      with no resolving signal found yet: Engineer "Throw Mine" (Gadgeteer-trait-gated — would need
      the picker to know the build's chosen traits, an architecture change), Elementalist "Mist
      Form", Revenant "Protective Solace", Revenant "Jade Winds" (wiki lists all ids together with no
      distinguishing field).
- [ ] **Vindicator's 3 Legendary Alliance Stance utility skills (Nomad's Advance, Scavenger Burst,
      Reaver's Rage) each carry a same-spec non-`GroundTargeted` duplicate id whose relationship to
      the kept id isn't understood yet** — found by the full skill-picker duplicate-id audit
      (2026-08-04, see COMPLETED.md Session 62) but deliberately left un-excluded rather than guessed.
      **Narrowed 2026-08-04 while implementing the Aspect-swap toggle (see COMPLETED.md)**: the
      canonical `legends.json` ids and their real Aspect-of-Saint-Viktor `flipSkill` targets are now
      fully mapped and verified (`vindicator-aspect.ts`) — `62962` Scavenger Burst -> `62941` Tree
      Song, `62832` Nomad's Advance -> `62702` Battle Dance, `62878` Reaver's Rage -> `62796`
      Awakening, none of which involve `62841`/`62793` at all. So the "legend swap mid-cast changes
      this skill's name" framing this bullet used to carry was wrong — that's the Aspect toggle
      (F3 "Alliance Tactics", now implemented), and it's fully accounted for by the ids above. What's
      still unexplained is only the leftover plain non-ground orphans (`62841` Scavenger Burst /
      `62793` Tree Song specifically — Nomad's Advance/Reaver's Rage not yet checked for a same-shape
      orphan) that aren't referenced by `legends.json` and carry no `flipSkill` link to anything.
      Needs a dedicated look at whether they're genuine stale pre-rework duplicates (matching this
      audit's usual pattern elsewhere) or something else — don't just wiki-id=-exclude them like the
      rest of this audit did, that heuristic already produced false positives for this exact family
      once (see Session 62's write-up).
- [ ] Known limitation, documented in code (`weapon-calc/weapon-skills.ts`): Weaver's "Dual Attack"
      weapon-skill-3 replacements (e.g. 3 different Fire-tagged ids sharing `specializationId: 56`)
      can't be disambiguated — which one is live depends on Weaver's second active attunement, a
      combat-state axis this app's static loadout model has no equivalent for. Falls back to the
      first candidate deterministically.
- [ ] Ranger Profession_4 "Eternal Bond" F-skill stays unresolved — no per-pet data exists for it
      (unlike Soulbeast's F1-F3, which resolve from `soulbeast-beastmode.json`).
- [ ] Unconfirmed edge case: whether any skill has a distinctly different effect specifically on its
      last charge before recharging (vs. every charge being identical) — no concrete example found
      to verify against; revisit if one surfaces.

## Skill bar UI/UX feedback pass (2026-07-31)

Large feedback pass from a full skill-bar walkthrough (screenshots per profession/general). Nothing
below has been implemented yet — captured here for a future session to pick up. Two UX questions
were resolved while triaging this list (see the affected items): multi-option F-icon toggles
(Firebrand's 3 Tomes) switch directly to whichever icon is clicked rather than cycling in sequence,
and the Ranger pet-swap/Untamed-swap text buttons get replaced by the cycle icon rather than gaining
it alongside.

### Engineer
- [ ] Edge case, explicitly deferred: Engineer's weapon-skill kit-swap is tied to `Skills`
      (Heal/Utility/Elite choices), not to profession specialization, so the Firebrand-style F-icon
      click-toggle pattern doesn't map cleanly onto it. Keep the current text-toggle row for kits
      as-is for now; revisit later.

### Elementalist
- [ ] Weaver's weapon-skill-3 "Dual Attack" ambiguity — already tracked in "Skill picker follow-ups"
      above and in `weapon-calc/weapon-skills.ts`; flagged again here as still open, no new action.

### Mesmer
- [ ] Troubadour's "Tales" skills and Mirage's "Mirror" skills fall into the generic "Other" category
      bucket in the skill picker (`groupSkillsByCategory` in `SkillsEditor.tsx`, driven by
      `skill.categories[0]`) instead of their own "Tales"/"Mirror" headers — and this leaks into other
      Mesmer specs' pickers too, not just Troubadour/Mirage's. Needs investigation into why the
      category grouping isn't picking up the right `categories[0]` for these, and why it's
      cross-contaminating unrelated specs.

### Necromancer
- [ ] "Necrotic Traversal" (2nd half of Summon Flesh Wurm's flip-skill chain) is filed under "Other"
      in the skill picker category grouping — should be associated with/grouped near Summon Flesh
      Wurm instead.

## Nice-to-haves

- [ ] "Favorites" pin for frequently-used builds in the squad editor's build sidebar; the
      build-picker option's description only shows the profession name today, not a fuller
      spec/gear summary. Partially addressed 2026-08-01 by manual drag-to-reorder on the Builds
      view (`BuildsView.tsx`, `Build.order` — the sidebar now follows that same order), but that's
      a full custom ordering the user arranges by hand, not a lightweight "pin to top" independent
      of it — still a distinct nice-to-have if wanted.
- [ ] "Favorites" marker for food/utility consumables, to pin preferred choices to the top of the
      selection list (currently the full unfiltered catalog, by design).
- [ ] Settings toggle for underwater weapons/skills, defaulted **off**. Noted 2026-07-31 (UI polish
      session): underwater isn't frequently used in WvW and normally shouldn't factor into
      boon/condition output. When off, the Underwater weapon-set editor and its skill bar should
      stay hidden, and `sources.ts`'s boon/condition calculator should skip underwater skill ids
      the same way it would if nothing were equipped there.
- [ ] More curated fury-crit-chance traits in `combat-state.ts`'s `FURY_CRIT_CHANCE_TRAIT_BONUSES`
      (added 2026-08-01 for the Gear Optimizer's Critical Chance metric, seeded with only
      Revenant's Roiling Mists). A `traits.json` scan found 6 more profession traits with the same
      "extra crit chance while under Fury" shape — Engineer's Hematic Focus, Warrior's Furious
      Burst, Ranger's Vicious Quarry, Mesmer's Quiet Intensity, Revenant/Renegade's Brutal
      Momentum — each needs its current WvW-mode value confirmed against the wiki (same as Roiling
      Mists) before being added.
