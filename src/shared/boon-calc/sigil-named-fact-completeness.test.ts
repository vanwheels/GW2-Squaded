import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOON_STRIP_CORRUPT_MATCHERS, CONTROL_MATCHERS, MISCELLANEOUS_MATCHERS, SIGIL_NAMED_FACT_SOURCES } from './sources'

/**
 * Sigil/Control-Strip completeness scan — TODO.md's "Automated testing strategy" #2 (agreed
 * 2026-08-12), sibling to the trait attribute-bonus completeness scan
 * (`gear-calc/trait-attribute-completeness.test.ts`). `CONTROL_MATCHERS`/`MISCELLANEOUS_MATCHERS`/
 * `BOON_STRIP_CORRUPT_MATCHERS` in `sources.ts` all match against the GW2 API's structured `Fact`
 * shape — but sigils carry no `Fact[]` array at all, only a free-text `description` (see `Sigil`'s
 * doc comment in `types/game-data.ts`), so those matchers could never see a sigil even in
 * principle. That's a different failure shape than the trait scan's "occasional missed wording" —
 * it's a total, structural gap, and was one until this session (`SIGIL_NAMED_FACT_SOURCES` in
 * `sources.ts`, wired into `computeNamedFactSources` via `computeSigilNamedFactSources`).
 *
 * Since sigils have no `Fact` to structurally match, this test can't reuse the trait scan's exact
 * "does a recognized fact type exist" check — instead it runs a deliberately narrow regex over
 * every sigil's `description`, looking for verb+noun combinations that name a Control/
 * Miscellaneous/Strip/Corrupt/Cleanse *effect being granted* (not a plain-english mention of the
 * word — a blanket `/boon|condition/` substring would flag nearly every stat-duration sigil, e.g.
 * "Increase Inflicted Chill Duration" or "+10% Boon Duration", none of which grant anything). Every
 * regex hit must be either (a) in `SIGIL_NAMED_FACT_SOURCES`, or (b) in this file's own
 * `EXCLUDED_SIGIL_IDS` with a stated reason — same "reviewed allowlist, not a silent bypass"
 * contract as the trait scan's `EXCLUDED_TRAIT_IDS`.
 *
 * Built 2026-08-12 by running exactly this scan over all 81 sigils in
 * data/game-data/sigils.json: 7 candidates matched. 5 were genuine grants, added to
 * `SIGIL_NAMED_FACT_SOURCES` (Purity/Nullification/Generosity/Cleansing/Absorption — 2 Cleanse-via-
 * Strip pairs plus a condition-transfer that functions as a self-cleanse); 2 were false positives
 * from the regex's necessarily-loose net (Paralyzation boosts an *existing* stun's duration rather
 * than applying one itself; Impact's "+damage vs. Stunned/Knocked-Down foes" references those
 * states without granting them; Mischief's "Launch...snowballs" is flavor text for a ranged attack,
 * not the Launch knockback-distance mechanic) — both logged in `EXCLUDED_SIGIL_IDS` below.
 */

interface SigilDataFile {
  id: number
  name: string
  description: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const sigils: SigilDataFile[] = JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/sigils.json'), 'utf-8'))

/** Narrow, hand-picked candidate patterns — one per matcher-table name (or name-pair, for
 *  Strip/Corrupt which share the "boon" noun). Deliberately verb+noun rather than a bare keyword:
 *  a bare `/boon/` or `/condition/` match would flag most of the ~15 flat stat-duration sigils
 *  (Bursting, Malice, Concentration, ...), none of which grant a Control/Miscellaneous/Strip/
 *  Corrupt/Cleanse effect. Not meant to double as the actual classifier (that's
 *  `SIGIL_NAMED_FACT_SOURCES`, hand-curated) — only to flag candidates for human review. */
const CANDIDATE_PATTERNS: Record<string, RegExp> = {
  Stun: /\bstun(s|ned|ning)?\b/i,
  Daze: /\bdaze/i,
  Knockdown: /\bknock(ed)?[- ]?down/i,
  Knockback: /\bknock(ed)?[- ]?back/i,
  Launch: /\blaunch/i,
  Pull: /\bpull/i,
  Stealth: /\bstealth/i,
  Superspeed: /\bsuperspeed|\bsuper speed/i,
  Evade: /\bevade|\bevasion/i,
  'Breaks Stun': /\bbreaks? stun/i,
  Barrier: /\bbarrier/i,
  'Strip/Corrupt': /(remove|steal|stole|stolen|convert|corrupt).{0,20}\bboons?\b|\bboons?\b.{0,20}(remov|steal|stole|stolen|convert|corrupt)/i,
  Cleanse: /(remove|transfer).{0,20}\bconditions?\b|\bconditions?\b.{0,20}(remov|transfer)/i
}

function plainText(description: string): string {
  return description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function isCandidate(sigil: SigilDataFile): boolean {
  const text = plainText(sigil.description)
  return Object.values(CANDIDATE_PATTERNS).some((re) => re.test(text))
}

/** Every matcher name any of the 3 tables actually recognizes — `SIGIL_NAMED_FACT_SOURCES.name`
 *  must always be one of these (checked below) since `computeSigilNamedFactSources` filters against
 *  whichever table its caller passes in. */
const ALL_MATCHER_NAMES = new Set([...Object.keys(CONTROL_MATCHERS), ...Object.keys(MISCELLANEOUS_MATCHERS), ...Object.keys(BOON_STRIP_CORRUPT_MATCHERS)])

const COVERED_SIGIL_IDS = new Set<number>(Object.keys(SIGIL_NAMED_FACT_SOURCES).map(Number))

/** Reviewed-and-excluded sigils (see this file's header comment for how each was decided). */
const EXCLUDED_SIGIL_IDS: Record<number, string> = {
  24639:
    "Boosts the DURATION of a stun the wearer already landed by some other means (+30% Stun Duration) — doesn't apply a stun itself, so it isn't a Control source of its own.", // Superior Sigil of Paralyzation
  24868:
    "Bonus damage vs. foes already Stunned/Knocked-Down by some other source (+7% Strike Damage vs. Stunned or Knocked-Down Foes) — references those states without granting them.", // Superior Sigil of Impact
  68436:
    'Flavor text for a ranged snowball attack ("Launch...snowballs at foes") — not the Launch knockback-distance mechanic `CONTROL_MATCHERS.Launch` matches on skills/traits.' // Superior Sigil of Mischief
}

describe('sigil Control/Miscellaneous/Strip-Corrupt-Cleanse completeness', () => {
  it('accounts for every candidate sigil in SIGIL_NAMED_FACT_SOURCES or the exclusion list', () => {
    const uncovered: string[] = []
    for (const sigil of sigils) {
      if (!isCandidate(sigil)) continue
      if (COVERED_SIGIL_IDS.has(sigil.id)) continue
      if (sigil.id in EXCLUDED_SIGIL_IDS) continue
      uncovered.push(`${sigil.id} (${sigil.name})`)
    }
    expect(
      uncovered,
      "New/previously-missed candidate sigil(s) — add to SIGIL_NAMED_FACT_SOURCES in sources.ts, or to this test's EXCLUDED_SIGIL_IDS with a reason."
    ).toEqual([])
  })

  it('has no exclusion entry for a sigil that is already curated (dead/redundant entry)', () => {
    const redundant = Object.keys(EXCLUDED_SIGIL_IDS)
      .map(Number)
      .filter((id) => COVERED_SIGIL_IDS.has(id))
    expect(redundant, 'Sigil id(s) covered by SIGIL_NAMED_FACT_SOURCES AND listed in EXCLUDED_SIGIL_IDS — remove the now-redundant exclusion entry.').toEqual([])
  })

  it('has no exclusion entry for a sigil that no longer exists or no longer matches a candidate pattern', () => {
    const sigilsById = new Map(sigils.map((s) => [s.id, s]))
    const stale = Object.keys(EXCLUDED_SIGIL_IDS)
      .map(Number)
      .filter((id) => {
        const sigil = sigilsById.get(id)
        return !sigil || !isCandidate(sigil)
      })
    expect(
      stale,
      'Sigil id(s) in EXCLUDED_SIGIL_IDS that no longer exist in sigils.json or no longer match a candidate pattern — a balance patch likely reworked them; remove the stale entry.'
    ).toEqual([])
  })

  it('every SIGIL_NAMED_FACT_SOURCES entry names a real matcher-table key', () => {
    const badNames = Object.entries(SIGIL_NAMED_FACT_SOURCES)
      .filter(([, entry]) => !ALL_MATCHER_NAMES.has(entry.name))
      .map(([id, entry]) => `${id}: "${entry.name}"`)
    expect(badNames, 'SIGIL_NAMED_FACT_SOURCES entry names a string that is not a key of CONTROL_MATCHERS/MISCELLANEOUS_MATCHERS/BOON_STRIP_CORRUPT_MATCHERS.').toEqual([])
  })

  it('every SIGIL_NAMED_FACT_SOURCES id still exists in sigils.json', () => {
    const sigilIds = new Set(sigils.map((s) => s.id))
    const stale = Object.keys(SIGIL_NAMED_FACT_SOURCES)
      .map(Number)
      .filter((id) => !sigilIds.has(id))
    expect(stale, 'SIGIL_NAMED_FACT_SOURCES id(s) that no longer exist in sigils.json — a balance patch likely removed/renumbered them.').toEqual([])
  })
})
