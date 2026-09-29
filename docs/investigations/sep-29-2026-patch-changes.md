# Sep 29, 2026 patch — change list

Source: https://wiki.guildwars2.com/wiki/Game_updates/2026-09-29 (fetched 2026-09-29).

This app is WvW-only (see README). The patch is overwhelmingly PvP-only splits — those are listed
here for completeness/audit trail but are **out of scope**. Only WvW-only and "PvP and WvW" rows
need any work.

Legend: **[WvW]** = in scope, WvW-only split. **[Both]** = in scope, applies to PvP and WvW.
**(PvP)** = out of scope, PvP-only.

## General / Relics
- Relic of the Pirate Queen: cooldown 1s -> 5s **(PvP)**
- Relic of Karakosa: healing now triggers at blast finisher location rather than player location —
  no mode qualifier given; treat as **[Both]** (global mechanic change, not a numeric split)

## Elementalist
- Healing Rain: healing power scaling 0.1 -> 0.3 **[WvW]**
- Healing Ripple: healing power scaling 0.5 -> 0.75 **[WvW]**
- Stone Heart: damage reduction 25% -> 15% while specialized in earth **(PvP)**

### Tempest
- Overload Water: pulse healing power scaling 0.1 -> 0.3 **[WvW]**
- Latent Stamina: endurance amount 10 -> 15 **[WvW]**

### Evoker
- Altruistic Aspect: stability/resistance durations 5s -> 3s **(PvP)**
- Toad's Fortitude: cooldown 25s -> 30s **(PvP)**
- Specialized Elements: empowered recharge 20% -> 33% **[WvW]**

## Engineer
- Napalm: power coefficient per hit 0.28 -> 0.24 **(PvP)**
- Chain Reactivity: 3rd-trigger base barrier 1,500 -> 1,000 **(PvP)**
- Elixir C: healing per boon 450 -> 350 **(PvP)**
- Galvanic Bomb: no longer dazes **(PvP)**
- Sapping Device: added 8s internal cooldown per target — no mode qualifier; treat as **[Both]**
- Essence of Animated Sand: barrier healing power scaling 0.5 -> 0.65 **[WvW]**
- Bandage Blast: now prioritizes damaged allies; increased healing to allies below 50% health — no
  mode qualifier; treat as **[Both]**

### Scrapper
- Bulwark Gyro: pulse barrier healing power scaling 0.1 -> 0.25 **[WvW]**

### Amalgam
- Mercurial Tendencies: cooldown reduction 4s -> 2s **(PvP)**
- Solid State: cooldown 25s -> 30s; stability duration 5s -> 3s **(PvP)**
- New Genes: stability duration 4s -> 2s **(PvP)**

## Necromancer

### Reaper
- Blighter's Boon: base healing 133 -> 101 **(PvP)**

### Ritualist
- Weapon of Warding: cooldown 30s -> 35s; protection duration 4s -> 3s **(PvP)**
- Weapon of Remedy: cooldown 25s -> 30s **(PvP)**

## Ranger
- Dash (Juvenile Phoenix): fixed issue causing skill to strike more targets than intended — bug
  fix, no mode qualifier; treat as **[Both]**

### Druid
- Natural Mender: outgoing healing effectiveness increase 15% -> 10% **[WvW]**
- Seed of Life: conditions removed 2 -> 1 **[WvW]**
- Cultivated Synergy: conditions removed by Lesser Seed of Life 2 -> 1 **[WvW]**
- Grace of the Land: might stacks 2 -> 1 **[WvW]**

### Galeshot
- Feel the Rush: swiftness duration 5s -> 3s **(PvP)**
- Soothing Breeze: superspeed duration 4s -> 3s **(PvP)**
- Whirlwind: cooldown 25s -> 30s **(PvP)**

## Revenant

### Vindicator
- Tree Song: energy cost 25 -> 15 **[WvW]**
- Drop Urn of Saint Viktor: healing power scaling 0.22 -> 0.5 **[WvW]**
- Saint's Shield: healing power scaling 0.2 -> 0.3 **[WvW]**
- Reaver's Curse: healing/barrier increase 100% -> 200% **[WvW]**

### Conduit
- Release Potential: Assassin: power coefficient per hit 0.45 -> 0.35 **(PvP)**
- Release Potential: Mesmer: torment duration 6s -> 4s **(PvP)**
- Release Potential: Warrior: damage/barrier increase per affinity 15% -> 10% **(PvP)**
- Enhanced Embodiment: recharge reduction 20% -> 15% **(PvP)**
- Expanded Consciousness: energy gained 10 -> 5 **(PvP)**
- Numinous Gift: fury/might durations 10s -> 6s; resistance/resolution/protection/quickness
  durations 5s -> 3s **(PvP)**

## Warrior
- Call of Valor: cooldown 20s -> 25s **(PvP)**

### Paragon
- Adrenal Health: paragon chants now grant only one stack **[Both]** (PvP and WvW per patch notes)
- Cleansing Ire: paragon chants now cleanse only one condition **[Both]** (PvP and WvW per patch
  notes)

## In-scope summary (16 changes)

**[WvW]** numeric splits: Healing Rain, Healing Ripple, Overload Water, Latent Stamina,
Specialized Elements, Essence of Animated Sand, Bulwark Gyro, Natural Mender, Seed of Life,
Cultivated Synergy, Grace of the Land, Tree Song, Drop Urn of Saint Viktor, Saint's Shield,
Reaver's Curse (15)

**[Both]** changes: Relic of Karakosa, Sapping Device, Bandage Blast, Dash (Juvenile Phoenix),
Adrenal Health, Cleansing Ire (6)

## Scoping addendum — code cross-reference (2026-09-29)

Per-name check of whether each changed value is already curated somewhere in this codebase (raw
API fact that auto-updates on refetch, hand-curated coefficient/table, or not modeled at all).

**Auto** (raw API fact, verify after a plain refetch, no code change expected):
- Seed of Life — conditions removed 2->1 (trait 31406/32242)
- Cultivated Synergy — Lesser Seed of Life conditions removed 2->1 (trait 2057)
- Grace of the Land — might stacks 2->1 (trait 2001) — tentative: existing
  `wvw-fact-overrides.json` override for this trait only pins boon *duration*, not stack count;
  confirm the stack count itself comes through raw post-refetch.

**Manual** (existing hardcoded coefficient, needs a hand edit — see TODO.md Leg 3 for exact
file/line/value):
- Healing Rain (`healing-calc.ts:672`, skill 5551) — 0.1 -> 0.3
- Essence of Animated Sand (`barrier-calc.ts:161`, skill 72052) — 0.5 -> 0.65
- Bulwark Gyro (`barrier-calc.ts:151-153`, skill 30101) — Pulse Barrier 0.1 -> 0.25
- Natural Mender (`fact-numbers.ts:1216-1221`, trait 1992) — 15 -> 10
- Drop Urn of Saint Viktor (`healing-calc.ts:613`, skill 62738) — 0.22 -> 0.5

**Not modeled** (the specific changed stat isn't curated anywhere in this codebase — these are
pre-existing gaps the patch happens to touch, not regressions; scoping decision needed, see TODO.md
Leg 4):
- Relic of Karakosa — trigger-location mechanic, not a tracked number at all
- Healing Ripple (trait 351) — 0.5 coefficient never curated
- Overload Water (skill 29415) — pulse healing 0.1->0.3 never curated (only its unrelated
  party-wide target count is modeled)
- Bandage Blast — no healing coefficient curated for this skill at all
- Tree Song — energy cost isn't modeled anywhere; this app has no skill-resource-cost table at all
  (architecture gap, not a missing number)
- Saint's Shield (skill 62689) — 0.2 healing-power-scaling coefficient never curated (only an
  unrelated boon-duration override exists)
- Reaver's Curse (trait 2259) — 100%->200% healing/barrier increase is explicitly flagged in
  `fact-numbers.ts`'s own comment as out of scope for that table, "left for a future
  per-skill-mapping leg" — pre-existing known gap
- Cleansing Ire (trait 1649) — condition-cleanse count never modeled (only self-only targeting
  classification exists)
- Latent Stamina, Specialized Elements, Sapping Device, Adrenal Health — not found anywhere in
  `src/` or `scripts/` at all

