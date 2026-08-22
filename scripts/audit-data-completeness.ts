/**
 * Standing data-completeness audit — proposed in TODO.md's "Healing/Damage effectiveness % +
 * data-completeness audit" section (scoped 2026-08-21, built 2026-08-22). Every existing
 * pipeline script (`fetch-elite-spec-skills`, `fetch-wvw-splits`, `fetch-glyph-forms`,
 * `skill-variant-exclusions`, `synthetic-facts.json`, ...) exists to WIRE IN a gap a human
 * already found by hand — none of them search for gaps proactively. This one does: a purely
 * local (no wiki fetch, no network) structural scan of skills.json/traits.json/relic-effects.json/
 * tome-chapters.json for 3 gap-SHAPES a live research session found in about an hour of digging
 * (see TODO.md and the `healing_damage_effectiveness_audit_scoped_2026-08-21` memory):
 *
 *   1. **Opaque/generic fact labels** — a `Fact.text`/`RelicFactLine.label` that's a vague
 *      template phrase ("Effectiveness Increased", "effect", "Bonus") carrying a real numeric
 *      magnitude but naming neither the attribute nor the mechanic it affects (e.g. Serene
 *      Rejuvenation's healing-effectiveness trait: the fact itself never says "healing" —
 *      that word only exists in the trait's own prose `description`).
 *   2. **Numeric content buried in a nested `params.desc`/`params.alt` string** instead of the
 *      fact's own top-level label/values — only reachable on the `RelicFactLine` shape
 *      (relic-effects.json, tome-chapters.json), which is the one fact shape with a free-text
 *      `params` bag at all. Confirmed real, high-value hits while prototyping this script:
 *      Relic of the Firebrand's "+20% Boon Duration" and the Tome of Justice epilogue "Eternal
 *      Oasis"'s "+20% Heal Effectiveness" both live ONLY in `params.desc`, invisible to anything
 *      reading `label`/`values` the way a naive display (or a curated-coefficient table lookup)
 *      would.
 *   3. **A Buff/PrefixedBuff fact granting a named status with no duration anywhere in its own
 *      facts array** — every other Buff/PrefixedBuff fact in the dataset either carries its own
 *      `duration` field or sits alongside an explicit `Duration`/`Time`-type sibling fact (e.g.
 *      "Interval", "Recharge Time", "<Name> Duration" — confirmed via a full type-frequency scan
 *      2026-08-22). One that has neither is a real structural outlier worth a human look, even
 *      though most turn out to be intentional (e.g. a permanent/toggle status, or a duration the
 *      wiki documents in prose only) rather than an API omission.
 *
 * Deliberately scoped to skills.json/traits.json (`Fact`) and relic-effects.json/
 * tome-chapters.json (`RelicFactLine`) — the two fact shapes these 3 patterns are actually about.
 * sigils.json/runes.json/food.json/utility.json use `AttributeBonusText` (a flat parsed-text
 * line, no label-vs-content split and no nested params bag), so none of these 3 shapes apply to
 * them structurally; they're out of scope for this script (see TODO.md's own research-thread
 * candidate list for that separate, hand-curated line of investigation).
 *
 * Console-report only, same convention as `scan-empty-effect-facts.ts`/
 * `audit-skill-picker-duplicates.ts` — writes no data file. This is a backlog generator, not a
 * fix: every hit needs a human wiki-verification pass (same as every other curated-exception list
 * in TODO.md) before anything gets wired into the app, and a real chunk of hits are expected to be
 * legitimate non-gaps once looked at (see each shape's own false-positive notes above). Intended
 * to be run once now and optionally again after a future balance patch or `fetch-game-data` re-run
 * — NOT a per-sweep one-off.
 *
 * Will NOT catch a fact that's entirely absent with zero footprint anywhere in the data (the
 * original Tale-of-the-Second-Scion/Scion's Reprieve shape, pre-`synthetic-facts.json`) — that
 * class still needs a human who happens to know the build, no structural signal exists to find it.
 *
 * Run via `npm run audit-data-completeness`, after `npm run fetch-game-data` (and
 * `fetch-relic-effects`/`fetch-tome-chapters` if those haven't been run recently either).
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Fact, RelicEffectsById, Skill, TomeChaptersByTomeId, Trait } from '../src/shared/types/game-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

/** Known vague template phrasings that carry no attribute/mechanic name of their own — see shape
 *  1 in the module doc comment. Deliberately a small, high-confidence exact-match list (not a
 *  substring/regex heuristic) so this stays a low-noise signal rather than flagging every fact
 *  whose text merely happens to be short. Compared case-insensitively, trimmed. */
const GENERIC_LABELS = new Set([
  'effect',
  'effectiveness increased',
  'effectiveness decreased',
  'bonus',
  'bonus effect',
  'increase',
  'decrease',
  'increased',
  'decreased',
  'modifier',
  'special',
  'special effect'
])

function isGenericLabel(text: string | undefined): boolean {
  if (!text) return false
  return GENERIC_LABELS.has(text.trim().toLowerCase())
}

/** A fact "carries a real numeric magnitude" if any of these index-signature fields (the GW2 API's
 *  per-type numeric payload — `percent` on `Percent` facts, `value` on `Number`/`AttributeAdjust`/
 *  `HealingAdjust` facts, `duration`/`apply_count` on `Buff`/`PrefixedBuff` facts) is a number.
 *  Filters out non-numeric facts (`NoData`, `Unblockable`, `StunBreak`, ...) whose short/generic-
 *  looking text is genuinely the whole content, not a hidden-behind-a-vague-label gap. */
function hasMagnitude(fact: Fact): boolean {
  return (
    typeof fact.percent === 'number' ||
    typeof fact.value === 'number' ||
    typeof fact.duration === 'number' ||
    typeof fact.apply_count === 'number'
  )
}

interface Shape1Hit {
  source: string
  id: number
  name: string
  factType: string
  text: string
  magnitude: string
}

/** Shape 1 over the `Fact` shape (skills.json/traits.json). A fact with `status` set is excluded —
 *  a named boon/condition (e.g. "Apply Buff/Condition" granting "Regeneration") is already
 *  self-describing via `status` even when `text` itself is a generic template phrase; the real gap
 *  is a generic-labeled magnitude with NO other field naming what it affects. */
function scanFactShape1(source: string, id: number, name: string, facts: Fact[], hits: Shape1Hit[]): void {
  for (const fact of facts) {
    if (fact.status) continue
    if (!isGenericLabel(fact.text)) continue
    if (!hasMagnitude(fact)) continue
    const magnitude =
      typeof fact.percent === 'number'
        ? `${fact.percent}%`
        : typeof fact.value === 'number'
          ? `value=${fact.value}`
          : typeof fact.duration === 'number'
            ? `duration=${fact.duration}`
            : `apply_count=${fact.apply_count}`
    hits.push({ source, id, name, factType: fact.type, text: fact.text ?? '', magnitude })
  }
}

interface Shape3Hit {
  source: string
  id: number
  name: string
  factType: string
  text: string
  status: string
}

/** Shape 3 over the `Fact` shape. `arrayLabel` distinguishes `facts` vs `traitedFacts` since a
 *  companion `Duration`/`Time` fact is only a rescue if it's in the SAME array — a base fact
 *  missing duration isn't excused by an unrelated traited-variant array carrying one, and vice
 *  versa. */
function scanFactShape3(source: string, id: number, name: string, facts: Fact[], hits: Shape3Hit[]): void {
  const hasTimeFact = facts.some((f) => f.type === 'Duration' || f.type === 'Time')
  if (hasTimeFact) return
  for (const fact of facts) {
    if (fact.type !== 'Buff' && fact.type !== 'PrefixedBuff') continue
    if (!fact.status) continue
    if (fact.duration !== undefined && fact.duration !== null) continue
    hits.push({ source, id, name, factType: fact.type, text: fact.text ?? '', status: fact.status })
  }
}

interface RelicFactLineShape {
  label: string
  values: string[]
  params: Record<string, string>
}

interface Shape1RelicHit {
  source: string
  entryName: string
  label: string
  values: string[]
}

interface Shape2Hit {
  source: string
  entryName: string
  label: string
  field: 'desc' | 'alt'
  hiddenText: string
}

/** Every number-shaped substring in a `params.desc`/`params.alt` string (integers, decimals,
 *  percents — GW2's own "1½%" fraction glyphs are covered separately below since `\d` alone
 *  doesn't match them). */
function extractNumbers(text: string): string[] {
  return text.match(/\d+(\.\d+)?%?/g) ?? []
}

function scanRelicFactLine(
  source: string,
  entryName: string,
  fact: RelicFactLineShape,
  shape1: Shape1RelicHit[],
  shape2: Shape2Hit[]
): void {
  if (isGenericLabel(fact.label)) {
    shape1.push({ source, entryName, label: fact.label, values: fact.values })
  }

  for (const field of ['desc', 'alt'] as const) {
    const text = fact.params[field]
    if (!text) continue
    const numbers = extractNumbers(text)
    if (numbers.length === 0) continue
    const surfaced = numbers.some((n) => fact.values.some((v) => v.includes(n)))
    if (!surfaced) shape2.push({ source, entryName, label: fact.label, field, hiddenText: text })
  }
}

async function main(): Promise<void> {
  const [skills, traits, relicEffects, tomeChapters] = await Promise.all([
    readFile(join(DATA_DIR, 'skills.json'), 'utf-8').then((s) => JSON.parse(s) as Skill[]),
    readFile(join(DATA_DIR, 'traits.json'), 'utf-8').then((s) => JSON.parse(s) as Trait[]),
    readFile(join(DATA_DIR, 'relic-effects.json'), 'utf-8').then((s) => JSON.parse(s) as RelicEffectsById),
    readFile(join(DATA_DIR, 'tome-chapters.json'), 'utf-8').then((s) => JSON.parse(s) as TomeChaptersByTomeId)
  ])

  const shape1: Shape1Hit[] = []
  const shape3: Shape3Hit[] = []
  // Same player-equippable filter as scan-empty-effect-facts.ts's `selectCandidates` — the raw
  // skills.json also carries ~2200 monster/NPC/environment-hazard skills (professions: []) this
  // app never shows a player, and a fact gap on one of those isn't a real gap in anything this app
  // displays.
  for (const skill of skills.filter((s) => s.professions.length > 0)) {
    scanFactShape1('skill', skill.id, skill.name, skill.facts, shape1)
    scanFactShape1('skill', skill.id, skill.name, skill.traitedFacts, shape1)
    scanFactShape3('skill', skill.id, skill.name, skill.facts, shape3)
    scanFactShape3('skill', skill.id, skill.name, skill.traitedFacts, shape3)
  }
  for (const trait of traits) {
    scanFactShape1('trait', trait.id, trait.name, trait.facts, shape1)
    scanFactShape1('trait', trait.id, trait.name, trait.traitedFacts, shape1)
    scanFactShape3('trait', trait.id, trait.name, trait.facts, shape3)
    scanFactShape3('trait', trait.id, trait.name, trait.traitedFacts, shape3)
  }

  const shape1Relic: Shape1RelicHit[] = []
  const shape2: Shape2Hit[] = []
  for (const [relicId, effect] of Object.entries(relicEffects)) {
    for (const fact of effect.facts) {
      scanRelicFactLine(`relic ${relicId}`, `relic ${relicId}`, fact, shape1Relic, shape2)
    }
  }
  for (const chapters of Object.values(tomeChapters)) {
    for (const chapter of chapters) {
      for (const fact of chapter.facts) {
        scanRelicFactLine('tome-chapter', chapter.name, fact, shape1Relic, shape2)
      }
    }
  }

  console.log('=== Data-completeness audit ===\n')

  console.log(`Shape 1 — opaque/generic fact labels on skills/traits: ${shape1.length}`)
  for (const hit of shape1) {
    console.log(`  - ${hit.source} ${hit.id} "${hit.name}" — ${hit.factType} "${hit.text}" (${hit.magnitude})`)
  }

  console.log(`\nShape 1 — opaque/generic labels on relic/tome-chapter facts: ${shape1Relic.length}`)
  for (const hit of shape1Relic) {
    console.log(`  - ${hit.source} "${hit.entryName}" — label "${hit.label}", values [${hit.values.join(', ')}]`)
  }

  console.log(`\nShape 2 — numeric content hidden in params.desc/alt (relic/tome-chapter): ${shape2.length}`)
  for (const hit of shape2) {
    console.log(`  - ${hit.source} "${hit.entryName}" — label "${hit.label}", params.${hit.field}: "${hit.hiddenText}"`)
  }

  console.log(`\nShape 3 — Buff/PrefixedBuff fact with a status but no duration anywhere in its array: ${shape3.length}`)
  for (const hit of shape3) {
    console.log(`  - ${hit.source} ${hit.id} "${hit.name}" — ${hit.factType} "${hit.text}" grants status "${hit.status}"`)
  }

  console.log(
    `\nTotals: shape1(fact)=${shape1.length}, shape1(relic)=${shape1Relic.length}, shape2=${shape2.length}, shape3=${shape3.length}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
