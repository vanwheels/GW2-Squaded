import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONTROL_MATCHERS, MISCELLANEOUS_MATCHERS, BOON_STRIP_CORRUPT_MATCHERS, RELIC_NAMED_FACT_SOURCES } from './sources'

/**
 * Relic Control/Miscellaneous/Strip-Corrupt-Cleanse completeness scan — the same shape as
 * `sigil-named-fact-completeness.test.ts`, for `relic-effects.json` instead of `sigils.json`.
 * Unlike sigils, a relic's `RelicFactLine[]` is structured (`{label, values, params}`), so this scan
 * matches on `label`/`values` text directly rather than mining free-form `description` prose — a
 * tighter net than the sigil scan's regex, but same "flag candidates for human review, not a live
 * classifier" contract.
 *
 * Built 2026-08-16 (TODO.md's relic proc integration sweep, leg 5 — the "Smaller follow-up" item)
 * by running exactly this scan over all 112 relics in data/game-data/relic-effects.json: 15
 * candidates matched. 8 were genuine, deterministic-trigger grants, added to
 * `RELIC_NAMED_FACT_SOURCES` (Pack, Febe, Cerus, Wizard's Tower, Water, Trooper, Dagda, Bava Nisos).
 * 7 were reviewed and excluded, each for a stated reason in `EXCLUDED_RELIC_IDS` below — see
 * `RELIC_NAMED_FACT_SOURCES`'s own doc comment in `sources.ts` for the full per-relic writeup.
 * Leg 6 (2026-08-16) moved Relic of the Citadel (100448) out of the exclusion list and into
 * `RELIC_NAMED_FACT_SOURCES` — a wiki Mechanics-section re-check found its Stun is actually a
 * deterministic function of the triggering elite skill's own recharge, not the triggering hit's
 * defiance damage as originally assumed (see `citadelStunDurationSeconds`'s doc comment).
 */

interface RelicFactLineFile {
  label: string
  values: string[]
  params: Record<string, string>
}

interface RelicEffectFile {
  facts: RelicFactLineFile[]
  rechargeSeconds: number | null
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const relicEffects: Record<string, RelicEffectFile> = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/relic-effects.json'), 'utf-8'))

/** One pattern per matcher-table name (or name-pair, for Strip/Corrupt which share the "boon(s)"
 *  noun), matched against a fact's `label` + `values` joined — narrow enough that it doesn't flag
 *  every `targets`/`radius`/`recharge` fact every relic carries. */
const CANDIDATE_PATTERNS: Record<string, RegExp> = {
  Stun: /\bstun\b/i,
  Daze: /\bdaze/i,
  Knockdown: /knockdown/i,
  Knockback: /knockback/i,
  Launch: /\blaunch/i,
  Pull: /\bpull/i,
  Stealth: /\bstealth/i,
  Superspeed: /superspeed/i,
  Evade: /\bevade/i,
  'Breaks Stun': /breaks? stun|stunbreak/i,
  Barrier: /\bbarrier/i,
  Strip: /boons? (removed|stolen)/i,
  Corrupt: /boons? converted/i,
  Cleanse: /condition.*remov|remov.*condition/i
}

function isCandidate(effect: RelicEffectFile): boolean {
  return effect.facts.some((fact) => {
    const text = `${fact.label} ${fact.values.join(' ')}`
    return Object.values(CANDIDATE_PATTERNS).some((re) => re.test(text))
  })
}

const ALL_MATCHER_NAMES = new Set([...Object.keys(CONTROL_MATCHERS), ...Object.keys(MISCELLANEOUS_MATCHERS), ...Object.keys(BOON_STRIP_CORRUPT_MATCHERS)])

const COVERED_RELIC_IDS = new Set<number>(Object.keys(RELIC_NAMED_FACT_SOURCES).map(Number))

/** Reviewed-and-excluded relics (see `RELIC_NAMED_FACT_SOURCES`'s doc comment in `sources.ts` for
 *  the full writeup behind each). */
const EXCLUDED_RELIC_IDS: Record<number, string> = {
  100388:
    'Relic of the Astral Ward — Cleanse rides the already-deferred 2-step signet mechanic (spawns on one signet use, consumed by the next). Still deferred, not a new decision for this leg.',
  100694:
    'Relic of the Unseen Invasion — literal "Superspeed" fact, but docs/relic-trigger-classification.md\'s leg-1 audit already flagged its stealth-enter/exit trigger as "circular/unbounded," not deterministic for this app.',
  101737:
    'Relic of the Founding — Barrier fact, but gated on a Combo field/finisher interaction this app doesn\'t model deterministically (same reasoning DODGE(excluded) relics use, different non-deterministic trigger shape).',
  101801: 'Relic of Mosyn — already covered by the existing dodge-relic exclusion policy (DODGE_RELIC_IDS); its Cleanse fires on dodge, not a modeled trigger.',
  101943:
    'Relic of the Wayfinder — literal "Superspeed" fact, but docs/relic-trigger-classification.md\'s leg-1 audit already flagged its combat-enter trigger as non-deterministic (and the wiki describes the payload as generic move speed, not the Superspeed status, despite the fact\'s label).',
  103901:
    'Relic of the Mists Tide — Cleanse fact, but gated on a Combo field/finisher interaction this app doesn\'t model deterministically, same as Founding above.'
}

describe('relic Control/Miscellaneous/Strip-Corrupt-Cleanse completeness', () => {
  it('accounts for every candidate relic in RELIC_NAMED_FACT_SOURCES or the exclusion list', () => {
    const uncovered: string[] = []
    for (const [idStr, effect] of Object.entries(relicEffects)) {
      const id = Number(idStr)
      if (!isCandidate(effect)) continue
      if (COVERED_RELIC_IDS.has(id)) continue
      if (id in EXCLUDED_RELIC_IDS) continue
      uncovered.push(idStr)
    }
    expect(
      uncovered,
      "New/previously-missed candidate relic(s) — add to RELIC_NAMED_FACT_SOURCES in sources.ts, or to this test's EXCLUDED_RELIC_IDS with a reason."
    ).toEqual([])
  })

  it('has no exclusion entry for a relic that is already curated (dead/redundant entry)', () => {
    const redundant = Object.keys(EXCLUDED_RELIC_IDS)
      .map(Number)
      .filter((id) => COVERED_RELIC_IDS.has(id))
    expect(redundant, 'Relic id(s) covered by RELIC_NAMED_FACT_SOURCES AND listed in EXCLUDED_RELIC_IDS — remove the now-redundant exclusion entry.').toEqual([])
  })

  it('has no exclusion entry for a relic that no longer exists or no longer matches a candidate pattern', () => {
    const stale = Object.keys(EXCLUDED_RELIC_IDS)
      .map(Number)
      .filter((id) => {
        const effect = relicEffects[String(id)]
        return !effect || !isCandidate(effect)
      })
    expect(
      stale,
      'Relic id(s) in EXCLUDED_RELIC_IDS that no longer exist in relic-effects.json or no longer match a candidate pattern — a balance patch likely reworked them; remove the stale entry.'
    ).toEqual([])
  })

  it('every RELIC_NAMED_FACT_SOURCES entry names a real matcher-table key', () => {
    const badNames = Object.entries(RELIC_NAMED_FACT_SOURCES)
      .filter(([, entry]) => !ALL_MATCHER_NAMES.has(entry.name))
      .map(([id, entry]) => `${id}: "${entry.name}"`)
    expect(badNames, 'RELIC_NAMED_FACT_SOURCES entry names a string that is not a key of CONTROL_MATCHERS/MISCELLANEOUS_MATCHERS/BOON_STRIP_CORRUPT_MATCHERS.').toEqual([])
  })
})
