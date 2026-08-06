# Changelog

User-facing release notes. For the detailed development log, see `COMPLETED.md`.

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
