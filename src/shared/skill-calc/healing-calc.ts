import type { Fact, Skill } from '../types'

/**
 * A single wiki-verified `AttributeAdjust` healing fact: `Heal = baseValue + coefficient *
 * HealingPower`, quoted from the skill's own wiki `{{skill fact|healing|...|coefficient=...}}`
 * template (e.g. Signet of Restoration's active heal: `{{skill fact|healing|3275|coefficient=0.5}}`)
 * — not reverse-engineered, same rigor bar as `CURATED_RELIC_DAMAGE_BONUSES`/
 * `FURY_CRIT_CHANCE_TRAIT_BONUSES`. The GW2 API exposes `baseValue` itself (an `AttributeAdjust`
 * fact's `value`, computed at the API's reference build — 0 bonus Healing Power, matching this
 * app's own `BASE_ATTRIBUTES.Healing`) but never the `coefficient`, so that half has to come from
 * the wiki per skill (confirmed via raw wikitext, not paraphrase, after a summarized fetch and this
 * app's own `data/game-data/skills.json` disagreed for one skill — see git history).
 *
 * `factText` matches a fact's `text` field (e.g. "Healing per Cast") to select which of a skill's
 * possibly-several differently-labeled Healing facts (e.g. Signet of Restoration's active "Healing"
 * vs. passive "Healing per Cast") this entry is for — matched by presence only, NOT by re-checking
 * the fact's own `value` against `baseValue`. That's deliberate: several of these skills split their
 * Healing Power coefficient between "pve" and "pvp wvw" wiki-template modes (WvW groups with PvP
 * here, not PvE — confirmed per-skill via raw wikitext, the opposite of how this app's existing
 * `wvwFactOverrides` mechanism defaults Buff-duration facts to PvE-unless-overridden), and this
 * app's own `skills.json` only ever captured the API's default (PvE) value. So `baseValue` below is
 * deliberately the WvW-correct number where a split exists, not always the number `fact.value`
 * itself carries.
 */
export interface HealingCoefficient {
  factText: string
  baseValue: number
  coefficient: number
}

/**
 * Seeded 2026-08-02 with one WvW-common heal skill per base profession (plus Warrior's second
 * common pick, Mending) — NOT a bulk pass over every Heal-slot skill (85 have a qualifying
 * `AttributeAdjust`/`target: 'Healing'` fact per a full `skills.json` scan this session). Same
 * "add entries incrementally as specific builds get tested" policy as the trait-attribute curation
 * table (`trait-attributes.ts`) — extend this as specific builds' heal/utility/weapon skills need
 * real numbers, not by guessing ahead of demand.
 */
export const CURATED_HEALING_COEFFICIENTS: Record<number, HealingCoefficient[]> = {
  // Elementalist — Signet of Restoration. Active heal has no PvE/WvW split; passive "Healing per
  // Cast" does (PvE 202/0.1 vs "pvp wvw" 171/0.07) — WvW value used.
  5503: [
    { factText: 'Healing', baseValue: 3275, coefficient: 0.5 },
    { factText: 'Healing per Cast', baseValue: 171, coefficient: 0.07 }
  ],
  // Engineer — Healing Turret (both ids share identical facts in data/game-data/skills.json).
  5857: [{ factText: 'Healing', baseValue: 2520, coefficient: 0.5 }],
  6140: [{ factText: 'Healing', baseValue: 2520, coefficient: 0.5 }],
  // Guardian — Shelter.
  9102: [{ factText: 'Healing', baseValue: 4555, coefficient: 0.7 }],
  // Mesmer — Ether Feast.
  10176: [
    { factText: 'Healing', baseValue: 5560, coefficient: 1.0 },
    { factText: 'Heal per Clone', baseValue: 640, coefficient: 0.1 }
  ],
  // Necromancer — Well of Blood (base skill id only; id 10670's near-identical-but-different
  // numbers didn't match either wiki split cleanly, likely a Scourge-context variant — left
  // uncurated rather than guessing). WvW splits used for both facts (PvE 2936/1.0, 664/0.5).
  10527: [
    { factText: 'Initial Self Heal', baseValue: 4454, coefficient: 1.0 },
    { factText: 'Health per Second', baseValue: 496, coefficient: 0.2 }
  ],
  // Ranger — Water Spirit (both ids share identical facts). WvW split used (PvE was 3002/0.4).
  21773: [{ factText: 'Healing', baseValue: 1998, coefficient: 0.4 }],
  69244: [{ factText: 'Healing', baseValue: 1998, coefficient: 0.4 }],
  // Revenant/Renegade — Empowering Misery (both ids share identical facts). No split found.
  28219: [
    { factText: 'Healing', baseValue: 4600, coefficient: 1.0 },
    { factText: 'Heal per Condition', baseValue: 596, coefficient: 0.1 }
  ],
  78681: [
    { factText: 'Healing', baseValue: 4600, coefficient: 1.0 },
    { factText: 'Heal per Condition', baseValue: 596, coefficient: 0.1 }
  ],
  // Thief — Withdraw. WvW split used (PvE was 4778/0.66).
  13021: [{ factText: 'Healing', baseValue: 5243, coefficient: 0.66 }],
  // Warrior — Healing Signet (active burst only; the passive per-second tick isn't captured as an
  // `AttributeAdjust` fact in this app's skill data at all, so it can't be rendered here) and
  // Mending. Neither has a PvE/WvW split.
  14389: [{ factText: 'Healing', baseValue: 2320, coefficient: 0.35 }],
  14401: [{ factText: 'Healing', baseValue: 6520, coefficient: 1.2 }]
}

export interface HealingLine {
  label: string
  value: number
}

/**
 * Real, current-build-scaled healing lines for one skill — `Heal = baseValue + coefficient *
 * healingPower` per curated entry, gated the same `requires_trait` way as `numericFactLines`
 * (only counts a trait-conditional fact once that trait is actually chosen). Returns `[]` for any
 * skill with no curated entry (the vast majority, until this table grows) rather than falling back
 * to an unscaled/wrong number.
 */
export function healingLinesForSkill(skill: Skill, healingPower: number, activeIds: ReadonlySet<number>): HealingLine[] {
  const entries = CURATED_HEALING_COEFFICIENTS[skill.id]
  if (!entries) return []

  const allFacts: Fact[] = [...skill.facts, ...skill.traitedFacts]
  const lines: HealingLine[] = []
  for (const entry of entries) {
    const fact = allFacts.find((f) => f.type === 'AttributeAdjust' && f.target === 'Healing' && f.text === entry.factText)
    if (!fact) continue
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue
    lines.push({ label: entry.factText, value: Math.round(entry.baseValue + entry.coefficient * healingPower) })
  }
  return lines
}
