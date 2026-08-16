# Relic trigger classification (2026-08-16)

Leg 1 of the "Relic proc integration sweep" (see TODO.md). Full audit of all 112 relics in
`data/game-data/relics.json`, classifying each proc's trigger by whether this app already models a
deterministic frequency/timing for it, per the scoping in TODO.md.

## Methodology

Classified straight from `relics.json`'s own `description` text (wiki-sourced, already accurate
prose) — no new wiki fetches needed for trigger classification itself (numeric facts/durations are
a separate, later curation step, same as Zephyrite's own stepped-duration gap). Cross-checked
against existing app infra:

- **Elite/Heal skill triggers** ("after using an elite skill", "after using a healing skill") are
  exactly as deterministic as this app's existing "assume every skill is used on cooldown"
  convention (Chants, Virtue Activates, mantra final charge) — the equipped skill's `Skill.facts`
  recharge is already read elsewhere for this.
- **Ability-type triggers** ("upon using a `<well>`/`<signet>`/`<mantra>`/`<consecration>`/
  `<cantrip>`/`<meditation>`/`<shout>`/`<stance>`/`<deception>`/`<elixir>` skill") turn out to be
  just as resolvable: `Skill.categories` (confirmed live 2026-07-30 per its own doc comment in
  `src/shared/types/game-data.ts`) already carries these exact category strings for every equipped
  Heal/Utility/Elite skill. Matching "does any equipped skill in this category exist, and what's
  its recharge" is the same shape as the single-slot Elite/Heal case, just 1-of-N instead of a fixed
  slot. This widens the deterministic bucket beyond what the TODO.md scoping note assumed.
- **Mantra final charge** (Relic of the Firebrand) reuses the *existing* `MANTRA_FINAL_CHARGE_IDS`
  mechanism (`src/shared/skill-calc/mantra-final-charge.ts`) wholesale — cheapest possible
  integration in the whole sweep.
- **Dodge-triggered relics** are already deliberately excluded from this whole question
  (`DODGE_RELIC_IDS`, `dodge-replacement-facts.ts`) per the 2026-08-15 sweep — kept as-is here, not
  re-litigated, and not repeated in the table below beyond a one-line note.
- Everything else (on-hit/on-crit, combo finisher, disable-a-foe/CC, condition-inflict, boon-apply-
  to-an-ally, block, kill, stealth-enter/exit, stack-threshold mechanics, "summon while in combat")
  genuinely has no fixed cadence this app could assume without inventing one — same reasoning the
  existing `RelicEffect` doc comment gives. Left as unbounded/prose-only, matching current behavior.
- A separate axis, independent of trigger determinism: does the relic's *payload* even feed
  `computeBoonConditionSources` in the first place? Plenty of deterministic-trigger relics (e.g.
  most Elite-skill relics) pay off in enemy conditions, self damage buffs, or CC — none of which
  this calculator tracks. Barrier (Relic of the Flock) is tracked by a separate table (see
  `[[barrier_coefficient_sweep_2026-08-05]]`), not this one. Only relics whose payload is an
  ally/self **boon or aura** are real candidates for leg 2/3.

## Summary

| Bucket | Count | Notes |
|---|---|---|
| Elite-skill-use | 26 | single fixed slot, recharge known |
| Healing-skill-use | 16 | single fixed slot, recharge known |
| Ability-type-use (well/signet/consecration/cantrip/meditation/shout/stance/deception/elixir) | 14 | resolved via `Skill.categories` on equipped Heal/Utility/Elite |
| Mantra final charge | 1 | reuses existing `MANTRA_FINAL_CHARGE_IDS` |
| Weapon-swap | 1 | Relic of the Warrior — recharge-reduction only, no boon payload |
| Dodge (excluded, unchanged) | 8 | see `DODGE_RELIC_IDS` |
| Combo finisher | 8 | field+finisher combo, unbounded |
| Disable-a-foe / CC | 8 | rotation-dependent, unbounded |
| Condition-inflict (self-triggered) | 7 | build-dependent condition kit, unbounded |
| Boon/barrier-apply-to-ally (circular) | 5 | depends on build's own other boon output |
| Summon-while-in-combat | 4 | pet/minion, not a player boon grant |
| Stack-threshold mechanics | 7 | multi-step or unbounded stack gates |
| Passive conditional modifiers (not a discrete trigger) | 8 | e.g. "regen is more effective", health-threshold, resistance-gated |
| On-hit / on-crit / on-block / on-kill / stealth-enter-exit / cleanse-trigger / signet-2-step | 7 | unbounded |

(112 total; a few relics' primary trigger spans 2 rows above, e.g. Vass counts once under
Healing-skill-use since that's its first/primary trigger.)

## Strong candidates for leg 2/3 (deterministic trigger + real ally/self boon or aura payload)

These ~19 are where the actual integration payoff is — deterministic trigger AND a boon/aura grant
this calculator would otherwise be blind to:

| Id | Name | Trigger | Payload |
|---|---|---|---|
| 100063 | Relic of Surging | Elite skill | Shocking aura (self) |
| 100435 | Relic of the Earth | Elite skill | Protection + magnetic aura (allies) |
| 100625 | Relic of Leadership | Elite skill | Convert conditions → boons (allies) |
| 100752 | Relic of the Pack | Elite skill | Superspeed + might + fury (allies) |
| 100893 | Relic of the Zephyrite | Elite skill | Protection + resolution (allies) — motivating case |
| 103424 | Relic of Sorrow | Elite skill | Protection (allies) |
| 100385 | Relic of the Centaur | Healing skill | Stability (self) |
| 100455 | Relic of Durability | Healing skill | Protection + regeneration + resolution (self) |
| 100794 | Relic of Resistance | Healing skill | Resistance (self) |
| 101116 | Relic of Febe | Healing skill | Swiftness (allies) |
| 101767 | Relic of the Twin Generals | Healing skill | Might (allies) |
| 103984 | Relic of Reunification | Healing skill | Frost aura + light aura (self) |
| 104256 | Relic of Altruism | Healing skill | Might + fury (allies) |
| 104501 | Relic of Fire | Healing skill | Fire aura (self) |
| 100450 | Relic of the Chronomancer | Well skill | Quickness (self) |
| 100453 | Relic of the Firebrand | Mantra final charge | Boon duration buff (self) — reuses `MANTRA_FINAL_CHARGE_IDS` |
| 104733 | Relic of the Phenom | Cantrip/meditation skill | Protection (self) |
| 109267 | Relic of the Sacred Grounds | Well/consecration skill | Protection (self) |
| 100388 | Relic of the Astral Ward | Signet skill (2-step: spawns then consumed by next signet use) | Resistance + cleanse (allies) — complex payload, may want to defer to its own leg |

## Full classification table

Bucket key: `ELITE` `HEAL` `ABILITY(<type>)` `MANTRA-FC` `SWAP` `DODGE(excluded)` `COMBO` `CC`
`COND-INFLICT` `BOON-APPLY` `SUMMON` `STACK` `PASSIVE-MOD` `OTHER`

| Id | Name | Bucket | Boon/aura payload to ally or self? |
|---|---|---|---|
| 99965 | Relic of the Flock | HEAL | No — barrier (tracked separately) |
| 99997 | Relic of Isgarren | DODGE(excluded) | — |
| 100031 | Relic of the Monk | BOON-APPLY | No |
| 100048 | Relic of the Ice | ELITE | No — condition on enemies |
| 100063 | Relic of Surging | ELITE | **Yes** — shocking aura (self) |
| 100074 | Relic of Cerus | ELITE | No — boon→condition conversion on enemy |
| 100090 | Relic of the Dragonhunter | OTHER (trap-hit) | No |
| 100115 | Relic of Mabon | STACK | No |
| 100144 | Relic of the Warrior | SWAP | No — recharge reduction only |
| 100148 | Relic of Speed | PASSIVE-MOD | No |
| 100153 | Relic of the Fractal | COND-INFLICT | No |
| 100158 | Relic of the Mirage | DODGE(excluded) | — |
| 100177 | Relic of Peitha | ABILITY(deception) | No — condition/dmg on enemy |
| 100194 | Relic of the Weaver | ABILITY(stance) | No — self dmg buff |
| 100219 | Relic of the Herald | BOON-APPLY | No — concentration (attribute, not boon) |
| 100230 | Relic of the Krait | ELITE | No — condition on enemies |
| 100238 | Relic of the Lich | SUMMON | No |
| 100311 | Relic of the Ogre | SUMMON | No |
| 100345 | Relic of the Daredevil | DODGE(excluded) | — |
| 100368 | Relic of the Scourge | BOON-APPLY | No — self condition-duration buff |
| 100385 | Relic of the Centaur | HEAL | **Yes** — stability (self) |
| 100388 | Relic of the Astral Ward | ABILITY(signet, 2-step) | **Yes** — resistance + cleanse (allies), complex |
| 100390 | Relic of Antitoxin | OTHER (cleanse-trigger) | No |
| 100400 | Relic of the Sunless | ELITE | No — condition on enemy |
| 100403 | Relic of the Golemancer | SUMMON | No |
| 100411 | Relic of the Trooper | ABILITY(shout) | No — cleanse (not boon) |
| 100429 | Relic of Mercy | PASSIVE-MOD | No |
| 100432 | Relic of Akeem | CC + COND-INFLICT | No |
| 100435 | Relic of the Earth | ELITE | **Yes** — protection + magnetic aura (allies) |
| 100442 | Relic of Dwayna | PASSIVE-MOD | No |
| 100448 | Relic of the Citadel | ELITE | No — CC on enemy |
| 100450 | Relic of the Chronomancer | ABILITY(well) | **Yes** — quickness (self) |
| 100453 | Relic of the Firebrand | MANTRA-FC | **Yes** — boon duration buff (self) |
| 100455 | Relic of Durability | HEAL | **Yes** — protection + regen + resolution (self) |
| 100461 | Relic of Lyhr | OTHER (heal-any-source) | No — shield/barrier-like |
| 100479 | Relic of the Privateer | SUMMON | No |
| 100527 | Relic of the Brawler | BOON-APPLY | No — self dmg buff |
| 100542 | Relic of the Cavalier | OTHER (mount engage) | Not modeled — mount usage isn't tracked |
| 100557 | Relic of the Wizard's Tower | ELITE | No — barrier/pull, not a boon |
| 100561 | Relic of the Adventurer | HEAL | No — endurance |
| 100579 | Relic of the Nightmare | ELITE | No — condition on enemies |
| 100580 | Relic of the Necromancer | PASSIVE-MOD | No |
| 100614 | Relic of Evasion | DODGE(excluded) | — |
| 100625 | Relic of Leadership | ELITE | **Yes** — condition→boon conversion (allies) |
| 100659 | Relic of the Water | HEAL | No — cleanse |
| 100676 | Relic of Vampirism | HEAL | No — lifesteal |
| 100693 | Relic of the Afflicted | OTHER (on-kill) | No |
| 100694 | Relic of the Unseen Invasion | OTHER (stealth enter/exit) | Payload is superspeed, but trigger circular/unbounded |
| 100739 | Relic of the Reaper | ABILITY(shout) | No — condition on enemies |
| 100752 | Relic of the Pack | ELITE | **Yes** — superspeed + might + fury (allies) |
| 100775 | Relic of Vass | HEAL / ABILITY(elixir) | No — condition on enemy |
| 100794 | Relic of Resistance | HEAL | **Yes** — resistance (self) |
| 100849 | Relic of the Aristocracy | COND-INFLICT | No |
| 100893 | Relic of the Zephyrite | ELITE | **Yes** — protection + resolution (allies) |
| 100908 | Relic of the Holosmith | ELITE | No — damage |
| 100916 | Relic of the Thief | OTHER (broad on-hit) | No — self dmg buff |
| 100924 | Relic of the Deadeye | ABILITY(cantrip) | No — self dmg buff |
| 100934 | Relic of the Defender | OTHER (on-block) | No |
| 100942 | Relic of Dagda | ELITE | No — damage/condition on enemy |
| 100947 | Relic of Fireworks | OTHER (recharge-threshold on-hit) | No — self dmg buff |
| 101116 | Relic of Febe | HEAL | **Yes** — swiftness (allies) |
| 101139 | Relic of the Midnight King | CC | Payload is might+fury (allies), but trigger unbounded |
| 101166 | Relic of the Demon Queen | CC | No — condition on enemy |
| 101191 | Relic of Nourys | STACK | No |
| 101198 | Relic of Nayos | OTHER (self-cleanse-trigger) | No — heal |
| 101268 | Relic of Karakosa | COMBO | No — heal |
| 101737 | Relic of the Founding | COMBO | No — barrier |
| 101767 | Relic of the Twin Generals | HEAL | **Yes** — might (allies) |
| 101801 | Relic of Mosyn | DODGE(excluded) | — |
| 101863 | Relic of the Sorcerer | COND-INFLICT | No |
| 101943 | Relic of the Wayfinder | OTHER (combat-enter) | No — generic move speed, not swiftness |
| 101955 | Relic of Zakiros | PASSIVE-MOD | No |
| 102199 | Relic of the Blightbringer | STACK | No |
| 102245 | Relic of Atrocity | PASSIVE-MOD | No |
| 102595 | Relic of the Stormsinger | OTHER (movement skill, no categories match) | No — damage |
| 103015 | Relic of Rivers | DODGE(excluded) | — (payload is alacrity+regen, stays excluded per policy) |
| 103424 | Relic of Sorrow | ELITE | **Yes** — protection (allies) |
| 103574 | Relic of the Claw | CC | No — self dmg buff |
| 103763 | Relic of Geysers | BOON-APPLY | No — endurance |
| 103872 | Relic of Mount Balrior | ELITE | No — self dmg buff |
| 103901 | Relic of the Mists Tide | COMBO | No — cleanse |
| 103977 | Relic of the Beehive | ELITE | No — condition on enemies |
| 103984 | Relic of Reunification | HEAL | **Yes** — frost aura + light aura (self) |
| 104022 | Relic of the Steamshrieker | COMBO | No — condition on enemies |
| 104241 | Relic of the Eagle | PASSIVE-MOD | No |
| 104256 | Relic of Altruism | HEAL | **Yes** — might + fury (allies) |
| 104424 | Relic of Thorns | STACK | No |
| 104501 | Relic of Fire | HEAL | **Yes** — fire aura (self) |
| 104733 | Relic of the Phenom | ABILITY(cantrip/meditation) | **Yes** — protection (self) |
| 104800 | Relic of Bloodstone | COMBO + STACK | No |
| 104848 | Relic of Bava Nisos | ABILITY(stance) | No — cleanse |
| 104849 | Relic of Agony | CC | No — condition on enemy |
| 104928 | Relic of the Living City | STACK (multi-trigger, out of scope) | Payload is all boons, but explicitly excluded — same reasoning `vindicatorDodgeContent` gives for Titanic Potential already |
| 104994 | Relic of Mistburn | STACK / BOON-APPLY | Payload is extra might, but trigger circular |
| 105585 | Relic of the First Revenant | PASSIVE-MOD | No |
| 105652 | Relic of Castora | PASSIVE-MOD | No |
| 106206 | Relic of the Mist Stranger | OTHER (on-hit) | No — heal |
| 106221 | Relic of the Pirate Queen | CC | Payload is quickness (self), but trigger unbounded |
| 106355 | Relic of the Scoundrel | COND-INFLICT | No — self crit buff |
| 106364 | Relic of the Biomancer | COND-INFLICT | No — heal |
| 106916 | Relic of Shackles | CC | No — damage |
| 106920 | Relic of the Nautical Beast | COMBO | No — heal/damage |
| 107030 | Relic of Fog | DODGE(excluded) | — |
| 107061 | Relic of the Coral Heart | HEAL | No — damage reflection |
| 107124 | Relic of the Forest Dweller | ELITE | No — condition on enemies |
| 107192 | Relic of the Alliance | ABILITY(signet) | No — recharge reduction |
| 109264 | Relic of Galdra | ELITE | No — condition on enemies |
| 109267 | Relic of the Sacred Grounds | ABILITY(well/consecration) | **Yes** — protection (self) |
| 109351 | Relic of the Director | HEAL | No — condition on enemy |
| 109522 | Relic of the Doyen | PASSIVE-MOD | No |
| 109664 | Relic of the Cruel Overseer | STACK | No |
| 109709 | Relic of Watch | COND-INFLICT | No |

## Next legs

1. Design the general "relic effect gated on an already-modeled trigger" mechanism (TODO.md leg 2),
   sized for the ~19-candidate table above — likely 3 shapes: single-slot (Elite/Heal, like existing
   Chants), category-matched (ability-type, needs a small "does any equipped Heal/Utility/Elite
   skill carry category X" helper), and the 1 mantra-final-charge reuse.
2. Curate per-relic numeric facts (duration, recharge) into `relic-effects.json` where missing —
   Zephyrite's stepped-duration table is the known example, there may be others in the 19.
3. Wire the 19 into `computeBoonConditionSources`, starting with Zephyrite since it's already fully
   scoped.
