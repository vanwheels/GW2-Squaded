# TODO

Completed work is tracked in COMPLETED.md, not here — this file only holds what's still open.

## Next up

- [ ] `skill-variants.ts`'s Elite/Utility/Heal picker filters (`stripNonEquippableSubAbilities`,
      `stripFlipTargets`) don't catch every non-equippable "sub-skill" — found while curating
      `CURATED_DAMAGE_COEFFICIENTS`'s Elementalist Elite-slot entries 2026-08-04. Elementalist's
      Lesser Fiery Eruption (id 44918), Conjure Fiery Greatsword's auto-triggered passive proc (wiki
      `parent = Conjure Fiery Greatsword`, `Category:Lesser skills` — not something a player binds
      directly), has neither a `toolbeltSkill` link (the signal `stripNonEquippableSubAbilities`
      keys off) nor a `flipSkill` link from its parent (the signal `stripFlipTargets` keys off), so it
      likely still shows up in the live Elite picker as if it were its own independently-bindable
      skill. Needs: (1) live verification in the running app (Electron sandbox limitation — see
      `electron_sandbox_limitation` memory) that this actually reproduces; (2) if confirmed, a new
      signal for `skill-variants.ts`, probably wiki-sourced like `skillVariantExclusions` since
      neither the API's local `skills.json` nor any other structural field marks a "Lesser" skill as
      non-equippable — worth first checking how many other "Lesser"-titled skills exist across
      `skills.json` (a quick grep on `name` starting with "Lesser ") to see if this is a one-off or a
      whole category worth excluding by name-prefix convention (would need wiki spot-checks first —
      "Lesser" doesn't guarantee non-equippable, e.g. some elite specs have legitimately-bound
      skills named that way).
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
        "Damage"; Spear of Archemorus — 3-way split 5.0/2.67/2.33). 1 left uncurated: **Chaotic
        Release (id 28075)**, Legendary Dragon Stance's elite facet's "release" damage — the
        equipped elite-slot id (Facet of Chaos, 27760, per `legends.json`) carries zero Damage fact
        of its own; the fact lives only on 28075, reachable exclusively via that skill's `flipSkill`
        link. `skillFactLines`/`SkillsEditor.tsx` never follow `flipSkill` for Damage-fact rendering
        (only `boon-calc/sources.ts`'s `withFlipChain` does, for its own boon-aggregation purpose) —
        curating 28075 would be dead data no UI path reaches, an architecture gap not a data gap
        (same bucket as the Mesmer Troubadour Heal-skill follow-up below). Worth checking whether
        other legends' elite facets have this same on/release fact split when Utility-slot is swept —
        each legend's 3 utility facets follow the identical toggle+flipSkill shape. Ranger done
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
        same non-player-scaling trap seen elsewhere as a `power=` override; Tailored Victory (44637),
        Weave Self's `flipSkill` release effect (Weave Self itself, 43638, carries zero Damage fact of
        its own) — same "Damage fact unreachable via the current UI" architecture gap as Revenant's
        Chaotic Release above; Lesser Fiery Eruption (44918), Conjure Fiery Greatsword's auto-triggered
        passive proc (wiki `parent = Conjure Fiery Greatsword`, `Category:Lesser skills`) — not
        independently equippable, but **unlike Tailored Victory this one isn't caught by
        `skill-variants.ts`'s existing filters** (no `toolbeltSkill`/`flipSkill` link back to its
        parent for `stripNonEquippableSubAbilities`/`stripFlipTargets` to key off), so it likely still
        leaks into the live Elite picker as its own bindable-looking skill — see the new follow-up
        item below. Mesmer done (2026-08-04), the last profession — **Elite-slot sweep is now
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
      - **Utility-slot (220 raw candidates): in progress, started 2026-08-04, same
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
        (Glyph of the Tides/Alignment/Equality's damage-dealing casts) — a new variant of the
        "Damage fact unreachable via the current UI" architecture gap already seen with Revenant's
        Chaotic Release/Elementalist's Tailored Victory, this time via `glyphFormVariants` rather than
        `flipSkill`: each Glyph's actually-equippable canonical id carries zero facts of its own,
        since `glyphFormVariants` strips its two context-dependent "cast while not/while in Celestial
        Avatar form" ids (which carry the real facts) out of the picker entirely, and no rendering
        path stitches those facts back onto the canonical id's tooltip (`relatedVariantSkills` only
        follows `flipSkill`/attunement). **Also worth noting**: `CURATED_HEALING_COEFFICIENTS`
        already curated 2 of this same family's celestial-form casts (Ranger's Glyph of Alignment
        31348, Glyph of Burgeoning 31888) during the 2026-08-02 Healing sweep without flagging this
        gap — those entries are almost certainly equally unreachable dead data today, worth
        revisiting alongside a real fix (e.g. teaching `relatedVariantSkills` to also surface
        `glyphFormVariants` siblings) rather than leaving them silently inert. See `damage-calc.ts`'s
        Ranger Utility-slot block comment for the full writeup. Thief done 2026-08-04: 20 raw
        candidate ids (6 shared racial ones already curated under Warrior, not re-curated), 11
        distinct Thief-only skills curated (Scorpion Wire; Daredevil's Impairing Daggers, Reflexive
        Strike, Distracting Daggers, Palm Strike — 2 independently-split Damage facts, "Damage" and
        "Second Strike Damage" — Fist Flurry; Deadeye's Shadow Flare, Binding Shadow, Shadow Gust;
        Specter's Well of Sorrow, Well of Tears). **New "priming" variant of the flip-architecture gap
        found**: Thief's 2 Preparation skills (Prepare Pitfall id 13057, Prepare Thousand Needles id
        13026) are the actually-equippable ids per `skill-variants.ts`'s `stripFlipTargets` (which
        drops their differently-named `flipSkill` targets, Pitfall 56880/Thousand Needles 56898, from
        the picker), but unlike every earlier flip-gap case (Chaotic Release, Tailored Victory, Weave
        Self) the equippable id here carries ZERO facts of its own — not even a placeholder — so
        there's no substitute id to curate under; both Pitfall and Thousand Needles excluded outright,
        a strictly worse case than a partial gap. Deadeye's Shadow Flare hits a related but survivable
        version: it also has a differently-named flip target (Shadow Swap, 45672) stripped by the same
        signal, but Shadow Flare itself already carries its own Damage fact (the initial throw,
        independent of the swap-back detonation) so it's curated normally; only Shadow Swap's own
        separate Damage fact is the excluded unreachable one. Also worth noting: Well of Sorrow/Well of
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
        skill from any profession the same way without re-deriving this from scratch. 1 more excluded
        as a new flip-architecture-gap instance: Holosmith's Photon Wall (43739, the actually-
        equippable id) carries zero Damage fact of its own — the fact lives only on its `flipSkill`
        target Launch Wall (40533), unreachable via the current UI, same "real fact, dead data" shape
        as Chaotic Release/Tailored Victory/Weave Self earlier in this sweep. **Next up: Necromancer's
        Utility-slot leg.**
      - Weapon-slot (919 raw candidates): not started, last category in the sweep order.
- [ ] Mesmer Troubadour's Heal skill, "Tale of the Second Scion" (id 76695), shows no Healing numbers
      at all in this app (user screenshot comparison, 2026-08-02) — confirmed root cause: the GW2 API
      returns only 3 facts for this skill (`Recharge`, `Number of Targets`, `Radius`) with **zero**
      `AttributeAdjust`/Healing facts, unlike every other Heal-slot skill checked this session. The
      in-game tooltip and gw2skills.net both show real "Self-Healing"/"Ally Healing" numbers plus a
      "Scion's Reprieve" buff (+15% Heal Effectiveness) that the API doesn't expose either. This
      isn't a missing `CURATED_HEALING_COEFFICIENTS` entry — `healingLinesForSkill` only ever renders
      a number when a matching real API fact exists to gate it (deliberate, see that function's doc
      comment), and there's no fact here to match against at all. Fixing this needs a new mechanism
      that doesn't require a backing API fact (e.g. a wiki-only synthetic-fact table, injected the
      way `wvw-fact-overrides.json` patches values but for facts that don't exist yet) — scoped as
      its own follow-up rather than folded into the Heal-skill sweep above, since it's an
      architecture change, not a data-curation one. Likely worth checking whether other very recent
      (Janthir Wilds-era) skills have the same API gap before building a one-off fix just for this
      skill.
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
- [ ] Barrier is an entirely unmodeled resource bar, surfaced clearly by the Utility-skill sweep
      2026-08-02: of 40 Utility-slot skills the GW2 API tags with a Healing-type `AttributeAdjust`
      fact, 17 turned out to actually be Barrier facts (the API mislabels Barrier's `target` as
      "Healing" too, not just genuine heals) — e.g. Barrier Signet, Banner of Defense, "Brace
      Yourselves!", Bulwark Gyro, Utility Goggles, Serpent Siphon, Imminent Threat, and more. The
      Elite-skill sweep (also 2026-08-02) hit the same trap once more: Warrior's "We Will Never
      Yield!" (id 76562) tags its "Minimum Barrier"/"Maximum Barrier" facts as Healing too — same
      exclusion applied, not curated. Barrier
      scales off Healing Power with the exact same `base + coefficient * HealingPower` shape as a real
      heal (confirmed on several of these skills' wiki pages), but this app has no Barrier-amount UI
      or formula anywhere — `CURATED_HEALING_COEFFICIENTS`/`healingLinesForSkill` only ever renders
      real Health-restoring heals, and Barrier facts are deliberately excluded from it (same call
      already made for Necromancer's Sand Flare in the original Heal-slot sweep). Given how common
      this turned out to be in the Utility category specifically (nearly half the candidates), a
      genuine `CURATED_BARRIER_COEFFICIENTS`/`barrierLinesForSkill` pair (mirroring
      `healing-calc.ts`'s shape) displayed as its own tooltip line — not folded into the Healing
      number, since Barrier and Health are different bars — is probably worth scoping as its own
      category sweep at some point, now that the Heal/Utility/Elite/Weapon Healing-coefficient sweep
      itself is complete (see the item above).
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

## Feature feedback pass (2026-08-01) — scoped 2026-08-01

Feedback list from the user; scoped below with concrete implementation approach and open decisions.
Nothing here is implemented yet.

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
