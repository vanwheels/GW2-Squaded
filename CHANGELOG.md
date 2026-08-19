# Changelog

User-facing release notes. For the detailed development log, see `COMPLETED.md`.

## 1.1.0 — 2026-08-18

### Appearance

- New **Light / Dark / System** theme toggle in Settings, backed by a full color-palette rework —
  the app follows your OS theme by default, or you can pin one.
- Build cards now show a colored accent stripe matching the build's profession/elite spec, drawn
  from real GW2 in-game class colors; hovering animates it into a full rotating ring.
- Squad cards show a small colored dot per roster slot per party (a "mosaic") so a squad's overall
  composition shape reads at a glance without opening it.
- Profession and elite-specialization icons switched to the wiki's community-drawn Tango icon set
  (properly reusable art — see Settings > Credits).
- Settings toggles restyled as compact pill switches.

### Gear Optimizer

- Moved from a full-width panel below the editor to an inline "Gear Optimizer" button next to
  Equipment that opens a centered dialog, so it no longer competes for space with the rest of the
  editor.
- Results now include a live "Current vs. proposed" stat comparison table instead of just the raw
  suggested gear.

### Build & Squad editors

- Builds tab: delete is now a hover-reveal "X" icon instead of a full-width Delete button, the
  favorite star moved to the top-left corner, and the profession/elite-spec filter row collapses
  behind a popover instead of always showing every icon.
- Squad editor: slot borders removed for a cleaner look, the saved-builds sidebar is now
  sticky/scrollable, and both sidebar cards and party-line slots support right-click →
  Preview/Edit. Header and tag layout now match the Build editor.
- Trait rows reserve their full height immediately, so picking a specialization no longer shifts
  the surrounding layout.
- Fixed 3 Build editor display bugs: inconsistent trait-box heights before a specialization is
  chosen, a trait-connector line drawing before any trait was actually picked, and Light Aura not
  showing consistently between the Build editor and Squad builder.

### Screenshots

- Build editor screenshot output redesigned end-to-end (equipment text manifest, weapon-type bar,
  combat-state strip, reflowed Boons/Stats/Skills) so a full build now fits on one screenshot
  without scrolling.
- Squad screenshots no longer include the sidebar, "Remove line" buttons, or the per-slot boon
  dropdown, and squads with more than 4 lines now correctly capture every line via a new
  scroll-and-stitch capture (previously cut off past line 4).

### Boon/Condition accuracy

- Full audit of all 112 Relics: every relic whose proc fires on a trigger this app can already
  model (Elite/Heal skill use, ability type, etc.) with a real boon/aura/cleanse/strip payload now
  counts toward your totals. Also fixed roughly 10 duplicate relic catalog entries.
- Guardian Luminary: F1-F4 (Radiant Justice/Resolve/Courage/Forge) now show real tooltip facts, and
  entering Radiant Forge (F4) is modeled as a full weapon-bar swap, matching how other shroud-style
  mechanics already work.
- Engineer Turrets' flip skills (Overcharge/Detonate) now display correctly, and a broader gap is
  fixed where standard-profession Heal/Utility/Elite flip-chain skills (e.g. Firebrand's Mantra
  final charges) were missing from the aggregate Boon/Condition panel.
- Revenant fixes: Sword 4's flip icon (was pointing at a removed skill), Facet of Elements' flip
  icon, Draconic Fortitude's Health bonus (wasn't affecting Health at all), Draconic Echo's
  per-facet bonus text, Elevated Compassion's WvW boon (Vigor, not Quickness), Icerazor's Ire's
  missing Immobile, and Renegade's "Band Together" skills double-counting facts they share with
  their base skill.
- Fixed a stacking-sigil stepper bug where it ignored stacks that should still count from a stowed
  weapon set.

### Reliability

- A build's "Updated" timestamp/staleness flag now only changes on a real edit, not just from
  opening and closing the editor; a new "Mark as up to date" button lets you manually confirm a
  build still holds up after a balance patch.
- Fixed name/tag text inputs not picking up the app's themed input styling.

## 0.3.0 — 2026-08-06

### Favorites
- Middle-click any build/squad card, or any Food/Utility option in the gear picker, to pin it to
  the top with a gold star badge. Builds/Squads favorites are saved with the build; Food/Utility
  favorites are a per-install preference and sort ahead of the rest of that picker's list.

### Faster editing workflow
- The Build/Squad editors no longer have a separate Save button — leaving the editor now saves
  your changes automatically.
- Switching tabs no longer resets the Builds/Squads views: in-progress edits, scroll position,
  and filters are preserved when you come back.

### Settings
- New Display toggles (off by default) to show underwater equipment/skills and racial skills in
  the build editor, for players who want them. When off, underwater skills are treated as
  unequipped in Stats/boon-condition totals, and existing underwater builds are unaffected.

### Search
- The gear-upgrade pickers (stat prefixes, runes, sigils, relics, food, utility) now support
  keyword search: plain text matches an item's name or full tooltip text (e.g. searching "Stun"
  finds sigils/relics that apply it); prefixing with `#` (e.g. `#power`) searches by which stat
  it affects instead, including "+N to All Stats" and conversion effects like "Gain Condition
  Damage Equal to 3% of Your Precision".

### Weaver
- Weapon skill 3 ("Dual Attack") now correctly reflects Weaver's dual-attunement mechanic —
  the skill it resolves to depends on both your current *and* previous attunement, with a new
  "Previous Attunement" toggle next to the skill bar. Boon/condition totals now account for
  every reachable Dual Attack skill.

### Bug fixes
- Fixed sigils not contributing to the Stats panel (e.g. Superior Sigil of Concentration's +10%
  Boon Duration wasn't being counted). Passive sigil bonuses only apply from your active weapon
  set, matching in-game behavior.
- Fixed most Utility consumables (Superior Sharpening Stone, Tuning Crystals, and other "Gain X
  Equal to N% of Your Y" items — the shape most WvW players actually use) silently doing nothing
  to the Stats panel.
- Feast/Station items (shareable, placed consumables — the majority WvW Food/Utility choice) now
  correctly show their real buff instead of raw flavor text, including the full "Ascended Gourmet
  Feast" tier hand-curated from wiki data.
- Fixed `#stat` search matching substrings across unrelated attribute names.

## 0.2.0 — 2026-08-05

### Gear Optimizer
- New Gear Optimizer panel embedded directly in the build editor: set stat floors (shown as
  their translated Health / Armor / Critical Chance / Critical Damage equivalents rather than
  raw Vitality/Toughness/Precision/Ferocity), pick up to 3 ranked stats to maximize, and it
  searches the full legal gear stat-combo pool — derived from the game's own Legendary Armory
  data — for the best prefix per slot. Optional toggle to also search food/utility choices.
- **Early stage — not yet reliable.** This is a first pass at the feature and doesn't function
  correctly yet; treat its suggestions as experimental rather than trustworthy until a
  follow-up fixes it.

### Stats accuracy
- Traits that grant a flat attribute bonus or convert one attribute into another (e.g.
  Revenant/Salvation's Life Attunement) are now factored into the Stats panel and the Gear
  Optimizer — closes a real gap found while cross-checking builds against gw2skills.net.
- Fixed the stat-prefix picker occasionally saving the wrong item stat on armor/weapon slots
  (it could silently substitute a shared-name stat combo's trinket variant instead).
- Fixed two-handed weapon tooltips computing their displayed value with the one-handed constant.
- Equipped items now show their real numeric attribute contribution on hover, matching
  gw2skills.net's item tooltips.

### Real Healing / Damage / Barrier numbers
- Every equipped skill's tooltip now shows its actual Healing, Damage, or Barrier magnitude
  scaled to your build's current stats, instead of just the API's static reference value — the
  result of a full wiki-verification pass across every profession and every skill slot
  (Heal/Utility/Elite/Weapon).
- Barrier is now modeled as its own fact type, separate from Healing (the GW2 API mislabels
  every Barrier value as a Healing fact).
- Traits and food/utility consumables now show structured, numeric hover tooltips instead of
  raw API description text.

### Flip-skill & toggle-form display
- Skills with a flip/activation-chain target (Mesmer's Chaotic Release, a Firebrand mantra's
  final charge, etc.) now render each target as its own gw2skills.net-style stacked icon with
  an independent tooltip, instead of nested text inside one shared tooltip.
- Druid Glyphs and Vindicator's Legendary Alliance Stance now swap their displayed icon and
  facts to match the build's active form/aspect toggle.
- Elementalist's attunement toggle is now built into the F1-F4 mechanic row instead of a
  separate, duplicate row above the skill bar.

### Builds & Squads
- Builds/Squads lists are now a compact card grid instead of a plain list.
- Drag-to-reorder cards, user-created tags with filter/search chips (builds also auto-tag by
  profession + elite spec), and a "last updated" timestamp per card.
- Tag filtering reworked to a profession/elite-spec icon picker plus a tag dropdown, with OR
  semantics (previously AND, which made selecting 2 professions always show nothing).
- The Conditions/Boons summary panel is now a 2-column layout, freeing up room for the Skills
  section below it.

### Bug fixes
- Fixed Evoker's F5 "Familiar" slot rendering nothing until a familiar had ever been chosen.
- Fixed Catalyst's Deploy Jade Sphere tooltip repeating the same facts multiple times.
- Fixed Druid Glyph's equipped-slot icon not swapping with the Celestial Avatar toggle.
- Excluded a non-equippable proc (Lesser Fiery Eruption) that was leaking into the
  Elementalist Elite picker as if it were its own bindable skill.
- Full skill-picker duplicate-id audit: corrected 28 skills that were silently resolving to a
  stale or wrong duplicate id somewhere in a profession's Heal/Utility/Elite picker.

## 0.1.2 — 2026-08-01

- Fixed a bug from 0.1.1 where every local gw2skills icon (equipment-slot glyphs, stat-prefix
  art, weapon-type art) failed to load in the packaged app, showing as broken images throughout
  the gear editor.
- In-app updates now install silently in the background and auto-relaunch, instead of showing
  the full installer wizard every time.

## 0.1.1 — 2026-08-01

- Added gw2skills.net-licensed equipment-slot and stat-prefix icons throughout the gear editor
  (used with permission — see Settings > Credits).
- Added a corner-icon overlay on stat-prefix pickers identifying which slot/weapon type each
  one belongs to.
- Fixed land weapon options incorrectly excluding/including Aquatic-flagged weapons (Spear is
  usable on land as of Janthir Wilds; Trident/Speargun are not).
- Fixed Warrior's Spear Burst Skill always resolving to the underwater version regardless of
  environment or equipped elite spec.
- Known issue (fixed in 0.1.2): local icons didn't load in this build.

## 0.1.0 — 2026-08-01

Initial beta build.
