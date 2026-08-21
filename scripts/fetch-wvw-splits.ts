/**
 * Fetches WvW-vs-PvE game-mode splits for boon/condition Buff facts, from the wiki, and writes
 * data/game-data/wvw-fact-overrides.json.
 *
 * The public GW2 API has no field for this: `/v2/skills` and `/v2/traits` facts are a single
 * flat list with no `game mode` tag, and appear to merge in whichever variant exists (verified:
 * for skills/traits with NO split, the API value is simply the one value; for split ones, cross-
 * checking against the wiki shows the API's `duration` matches the PvE-tagged wikitext value
 * when a PvE variant exists at all, and the sole tagged value otherwise — see docs/game-data.md).
 * So this is sourced from the wiki instead, same pattern as fetch-elite-spec-skills.ts:
 * `Category:Split skills` (1664 pages) / `Category:Split traits` (545 pages) are real, maintained
 * lists of which pages have a `{{skill fact|...|game mode=...}}` / `{{trait fact|...}}` split
 * somewhere on them. This script narrows that to the ~1100 pages that are BOTH in one of those
 * categories AND correspond to a skill/trait with a boon/condition Buff fact locally (the only
 * ones the boon/condition calculator cares about), fetches each page's raw wikitext, and parses
 * out the split.
 *
 * Wikitext fact-template parsing is inherently a bit fragile (naive `|`-splitting can misparse a
 * `[[Link|text]]` pipe embedded in a later field), so every parsed value is cross-validated
 * against the already-fetched API duration before being trusted — see `resolveOverride`.
 * Anything ambiguous (multiple same-game-mode fact lines for one boon on one page, a parsed PvE
 * value that doesn't match any of the API's) is skipped and logged rather than guessed, same
 * fail-safe philosophy as scripts/fetch-elite-spec-skills.ts.
 *
 * **Multiple Buff facts sharing one status on one id** (`statusCounts.get(boonName) > 1`): live-
 * verified 2026-08-06 while investigating Firebrand Mantra final-charge skills (Overwhelming
 * Celerity, Flame Surge/Rush, ...) — most of the time this is a genuine multi-hit/multi-pulse
 * mechanic (a 4-shot volley applying Bleeding on each hit; ~550 skills/traits in the local data fit
 * this shape) where showing every application separately is correct and this script must NOT touch
 * it. But a handful are actually one PvE/PvP/WvW-specific value per raw fact with no discriminator
 * at all (confirmed via raw wikitext, e.g. Overwhelming Celerity's Might: `{{skill fact|might|10|
 * game mode=pve}}{{skill fact|might|6|game mode=pvp wvw}}` maps 1:1 onto its 2 raw API Might
 * facts). `resolveOverride` only resolves this shape when the wiki's PvE-tagged AND WvW-tagged
 * values can BOTH be found among that status's actual raw API durations (not just one of the two,
 * unlike the single-fact case below) — this catches cases where the locally-cached API data has
 * drifted from the wiki's current numbers (e.g. Potent Haste's Quickness: wiki says pve=2.5/
 * wvw=1, but the cached API facts are {3, 1} — 2.5 doesn't appear anywhere in that set, so it's
 * skipped rather than trusting the coincidental wvw-side match). `sources.ts`'s `extractFromFacts`
 * is what actually collapses the raw duplicate facts down to the single overridden row at read
 * time — this script only decides which value that row should show.
 *
 * Run manually via `npm run fetch-wvw-splits`, after `npm run fetch-game-data` (matches wiki page
 * titles against the already-fetched data/game-data/{skills,traits}.json by name).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Skill, Trait, WvwFactOverride, WvwFactOverrides } from '../src/shared/types/game-data'
import { BOON_NAMES, CONDITION_NAMES } from '../src/shared/boon-calc/constants'
import { fetchWikiPage, flushWikiCache } from './lib/wiki-cache'

const WIKI_API = 'https://wiki.guildwars2.com/api.php'
const REQUEST_DELAY_MS = 150
// Same gotcha as fetch-elite-spec-skills.ts: the wiki returns 403 for Node's default User-Agent.
const USER_AGENT = 'GW2-Squaded-DataFetch/1.0 (local dev tool; github.com/vanwheels/GW2-Squaded)'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'game-data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const NAME_BY_LOWER = new Map<string, string>([...BOON_NAMES, ...CONDITION_NAMES].map((n) => [n.toLowerCase(), n]))
/** Shorthand/alternate names the wiki's `{{skill fact|...}}`/`{{trait fact|...}}` templates use
 *  for a boon/condition instead of its canonical API `Fact.status` string (found live 2026-08-06 on
 *  Firebrand Mantra pages — "Blind" for Blinded, "immobilized" for Immobile). Without these, a
 *  wikitext line using the alt name is silently dropped by `parseFactLines` (not in `NAME_BY_LOWER`
 *  at all) rather than logged, so the boon/condition it splits ends up looking simply unsplit —
 *  add more here if a future page turns up another alias, rather than guessing at others upfront. */
const WIKI_NAME_ALIASES: Record<string, string> = { blind: 'Blinded', immobilized: 'Immobile' }
for (const [alias, canonical] of Object.entries(WIKI_NAME_ALIASES)) NAME_BY_LOWER.set(alias, canonical)

/** Wiki article titles for shout-style skills keep surrounding quote marks the API's skill.name
 *  drops (or vice versa) — try both forms, same helper as fetch-elite-spec-skills.ts. */
function titleVariants(title: string): string[] {
  const unquoted = title.replace(/^"(.*)"$/, '$1')
  return unquoted === title ? [title, `"${title}"`] : [title, unquoted]
}

async function fetchCategoryMembers(category: string): Promise<Set<string>> {
  const titles = new Set<string>()
  let continueParams: Record<string, string> = {}
  for (;;) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmlimit: '500',
      format: 'json',
      ...continueParams
    })
    const response = await fetch(`${WIKI_API}?${params.toString()}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`Wiki API request failed: ${response.status} ${response.statusText}`)
    const data = (await response.json()) as {
      query?: { categorymembers?: { title: string }[] }
      continue?: Record<string, string>
    }
    for (const member of data.query?.categorymembers ?? []) titles.add(member.title)
    if (data.continue) {
      continueParams = data.continue
      await sleep(REQUEST_DELAY_MS)
    } else {
      break
    }
  }
  return titles
}

interface ParsedFactLine {
  name: string // properly-cased boon/condition name
  duration: number
  gameModeTokens: string[] | null // null = no `game mode=` param (applies everywhere)
}

/** Extracts every `{{skill fact|...}}` / `{{trait fact|...}}` invocation's boon/condition-name,
 *  first bare numeric positional value, and `game mode=` param (if any). Naive `|`-splitting can
 *  misparse a `[[Link|text]]` pipe embedded in a later field (e.g. a `desc=` param) — this mostly
 *  affects non-boon fact types (which are discarded below), and any resulting corruption on a
 *  boon fact is caught by the API-duration cross-check in validateAndBuildOverride. */
function parseFactLines(wikitext: string): ParsedFactLine[] {
  const out: ParsedFactLine[] = []
  const templateRe = /\{\{\s*(?:skill|trait)\s*fact\s*\|(.*?)\}\}/gis
  for (const match of wikitext.matchAll(templateRe)) {
    const segments = match[1].split('|').map((s) => s.trim())
    const rawName = segments[0]?.toLowerCase()
    if (!rawName) continue
    const name = NAME_BY_LOWER.get(rawName)
    if (!name) continue // not a boon/condition fact (damage, healing, radius, ...)

    let duration: number | null = null
    let gameModeTokens: string[] | null = null
    for (const seg of segments.slice(1)) {
      const modeMatch = /^game\s*mode\s*=\s*(.+)$/i.exec(seg)
      if (modeMatch) {
        gameModeTokens = modeMatch[1].toLowerCase().split(/[\s,]+/).filter(Boolean)
        continue
      }
      if (duration === null && /^\d+(\.\d+)?$/.test(seg)) {
        duration = Number(seg)
      }
    }
    if (duration === null) continue // no bare numeric value found — not a duration-bearing fact
    out.push({ name, duration, gameModeTokens })
  }
  return out
}

interface CandidateObject {
  kind: 'skill' | 'trait'
  id: number
  name: string
  statusCounts: Map<string, number> // boon/condition name -> count of Buff facts with that status
  statusDurations: Map<string, number[]> // boon/condition name -> every one of those facts' own API durations, in order
}

function collectCandidates(objects: (Skill | Trait)[], kind: 'skill' | 'trait'): Map<string, CandidateObject[]> {
  const byName = new Map<string, CandidateObject[]>()
  for (const obj of objects) {
    const statusCounts = new Map<string, number>()
    const statusDurations = new Map<string, number[]>()
    for (const fact of [...obj.facts, ...obj.traitedFacts]) {
      if (fact.type !== 'Buff' || typeof fact.status !== 'string' || typeof fact.duration !== 'number') continue
      if (!NAME_BY_LOWER.has(fact.status.toLowerCase())) continue
      statusCounts.set(fact.status, (statusCounts.get(fact.status) ?? 0) + 1)
      const durations = statusDurations.get(fact.status) ?? []
      durations.push(fact.duration)
      statusDurations.set(fact.status, durations)
    }
    if (statusCounts.size === 0) continue
    const candidate: CandidateObject = { kind, id: obj.id, name: obj.name, statusCounts, statusDurations }
    const list = byName.get(obj.name) ?? []
    list.push(candidate)
    byName.set(obj.name, list)
  }
  return byName
}

const EPSILON = 0.01

function containsWithinEpsilon(durations: number[], target: number): boolean {
  return durations.some((d) => Math.abs(d - target) <= EPSILON)
}

/** Given all parsed wiki fact-lines for one boon/condition name on one page, decides whether
 *  there's a clean, unambiguous game-mode split and what the WvW override should be. Returns
 *  `undefined` (with a log line) for anything not confidently resolvable. */
function resolveOverride(
  boonName: string,
  lines: ParsedFactLine[],
  candidate: CandidateObject,
  pageTitle: string,
  log: string[]
): WvwFactOverride | undefined {
  const factCount = candidate.statusCounts.get(boonName) ?? 0
  const apiDurations = candidate.statusDurations.get(boonName) ?? []

  const withMode = lines.filter((l) => l.gameModeTokens !== null)
  const withoutMode = lines.filter((l) => l.gameModeTokens === null)
  if (withMode.length === 0) return undefined // not actually split for this boon, nothing to do

  if (withoutMode.length > 0) {
    log.push(`skip (mixed modal/non-modal): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  // Bucket by explicit 'pve'/'wvw' token, not "wvw" vs "everything else" — a genuine 3-way split
  // (pve/wvw/pvp each their own separate {{skill fact}} line, e.g. Echo of Truth's Crippled: pve=4,
  // wvw=2, pvp=1) was previously miscounted as 2 "PvE-side" lines (the pve AND the pvp-only lines
  // both fell into the "not wvw" bucket), always tripping this ambiguity check even though it's
  // perfectly resolvable — live-verified 2026-08-06, ~80 pages hit this across the full dataset. A
  // pvp-only line (tagged neither 'pve' nor 'wvw') is outside this app's PvE-default/WvW-override
  // model and is simply ignored, not counted toward either bucket.
  const wvwLines = withMode.filter((l) => l.gameModeTokens!.includes('wvw'))
  const pveLines = withMode.filter((l) => l.gameModeTokens!.includes('pve'))
  if (wvwLines.length > 1 || pveLines.length > 1) {
    log.push(`skip (ambiguous multi-entry): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  if (factCount > 1) {
    // Multiple raw Buff facts share this status with no discriminator — see this file's own top
    // comment ("Multiple Buff facts sharing one status on one id"). Only resolvable when BOTH the
    // wiki's PvE-tagged AND WvW-tagged values can be found among the actual raw API durations
    // (not just one of the two) — requiring both catches locally-cached API data that's drifted
    // from the wiki's current numbers, where trusting a single coincidental match would silently
    // apply the wrong override. `sources.ts`'s `extractFromFacts` collapses every raw fact for
    // this status down to one row using this override at read time, once it exists.
    if (pveLines.length !== 1) {
      log.push(`skip (cardinality ${factCount}, no clean single pve line): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
      return undefined
    }
    if (!containsWithinEpsilon(apiDurations, pveLines[0].duration)) {
      log.push(
        `skip (cardinality ${factCount}, validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=[${apiDurations.join(', ')}], parsed PvE=${pveLines[0].duration}`
      )
      return undefined
    }
    if (wvwLines.length === 0) return 'omit'
    if (!containsWithinEpsilon(apiDurations, wvwLines[0].duration)) {
      log.push(
        `skip (cardinality ${factCount}, validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=[${apiDurations.join(', ')}], parsed WvW=${wvwLines[0].duration}`
      )
      return undefined
    }
    return wvwLines[0].duration
  }

  if (factCount === 0) {
    log.push(`skip (no matching Buff fact on object): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
    return undefined
  }

  const apiDuration = apiDurations[0]

  if (pveLines.length === 1 && wvwLines.length === 1) {
    if (Math.abs(apiDuration - pveLines[0].duration) > EPSILON) {
      log.push(
        `skip (validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=${apiDuration}, parsed PvE=${pveLines[0].duration}`
      )
      return undefined
    }
    return wvwLines[0].duration
  }

  if (pveLines.length === 1 && wvwLines.length === 0) {
    if (Math.abs(apiDuration - pveLines[0].duration) > EPSILON) {
      log.push(
        `skip (validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=${apiDuration}, parsed PvE=${pveLines[0].duration}`
      )
      return undefined
    }
    return 'omit'
  }

  if (pveLines.length === 0 && wvwLines.length === 1) {
    if (Math.abs(apiDuration - wvwLines[0].duration) > EPSILON) {
      log.push(
        `skip (validation mismatch): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName} — API=${apiDuration}, parsed WvW-only=${wvwLines[0].duration}`
      )
      return undefined
    }
    return undefined // API already reflects the sole (WvW-tagged) value — nothing to override
  }

  // Every game-mode-tagged line exists, but none of them is 'pve' or 'wvw' — i.e. every line is
  // pvp-only (or some other mode this app doesn't model). Symmetric with the pve-only/no-wvw-line
  // case above (factCount===1, pveLines===1, wvwLines===0 -> 'omit'): this app only ever displays
  // PvE-baseline-plus-WvW-override, never PvP, so a fact documented as applying in NEITHER of those
  // two modes doesn't apply here either. Live-verified 2026-08-06 on Martial Cadence (trait 1667,
  // Quickness tagged `pvp` only — its own version history confirms the WvW variant swapped to
  // Stability instead as of the 2025-04-15 patch, a different Buff entirely, not "omit"'s usual
  // "doesn't apply outside PvE") and Kinetic Accelerators (trait 2052, Fury tagged `pvp` only, no
  // pve/wvw counterpart at all).
  if (pveLines.length === 0 && wvwLines.length === 0) {
    return 'omit'
  }

  log.push(`skip (unhandled combination): ${candidate.kind} ${candidate.id} "${pageTitle}" / ${boonName}`)
  return undefined
}

/**
 * Hand-curated exceptions merged in after the automated sweep, for cases the wiki-vs-API
 * cross-validation can never confidently pass on its own. Currently just one root cause:
 *
 * **The GW2 API rounds a half-second (X.5s) Buff duration up to the next whole second**,
 * live-reconfirmed 2026-08-06 on two Firebrand Mantra of Potence skills with unrelated patch
 * histories (so not a shared one-off drift, but a real API quirk): Potent Haste's PvE Quickness
 * has been wiki-documented as 2.5s since 2018-12-11 (untouched since), yet `/v2/skills` returns
 * {3, 1} for its Quickness facts — `3` standing in for that `2.5`, `1` matching the wiki's WvW/PvP
 * value exactly. Overwhelming Celerity's WvW Quickness was nerfed from 4s to 2.5s by the
 * 2025-04-15 patch (wiki version history), yet `/v2/skills` returns {5, 4, 3} — again `3` standing
 * in for the `2.5`, with the PvE (5) and PvP (4, unused by this app) values matching exactly. Since
 * `resolveOverride`'s whole design is "only trust a wiki value that's independently confirmed
 * present in the raw API set" (see this file's top comment), neither skill's WvW value can ever
 * pass that check — the API itself has never carried a literal `2.5` for either. Curated here
 * instead of loosening the general validation (which exists to catch genuine wiki/API drift, not
 * to paper over this specific rounding quirk).
 */
const MANUAL_OVERRIDES: { skill: Record<number, Record<string, WvwFactOverride>>; trait: Record<number, Record<string, WvwFactOverride>> } = {
  skill: {
    41988: { Quickness: 2.5 }, // Overwhelming Celerity — WvW value per 2025-04-15 patch notes
    42983: { Quickness: 1 }, // Potent Haste — WvW value unchanged since 2020-02-25; entry exists to
    // collapse the {3, 1} duplicate-fact pair down to one row (see extractFromFacts in sources.ts)

    // Elixir of ___ cluster (Necromancer/Harbinger, empty-effect-facts curation, see
    // synthetic-facts.json): these skills have zero real API Buff facts, so this script's own
    // candidate discovery (which starts from an existing Buff fact's status) never considers them
    // — a different root cause than the rounding quirk above, but the same "can't pass the
    // automated cross-validation" outcome. Both members of each GroundTargeted/non-GroundTargeted
    // duplicate pair get an entry since the wiki page (and its `id=` list) covers both ids
    // identically. Wiki-confirmed pve-vs-wvw split; every other boon this cluster grants shares one
    // value across pve+wvw (only pvp differs, which this app doesn't model — see WvwFactOverrides'
    // doc comment).
    62530: { Might: 6 }, // Elixir of Risk (GroundTargeted id) — PvE 10s, WvW/PvP 6s
    68105: { Might: 6 }, // Elixir of Risk (canonical id)
    62662: { Quickness: 4 }, // Elixir of Anguish (GroundTargeted id) — PvE 5s, WvW/PvP 4s
    68113: { Quickness: 4 }, // Elixir of Anguish (canonical id)

    // Unrelenting Assault (Revenant/Sword 3) — found 2026-08-13 while curating BUFF_INSTANCE_LABELS
    // in sources.ts (TODO.md's "unlabeled duplicate rows" bug): a clean PvE(8s)/WvW+PvP(3s) Might
    // split, wiki-confirmed (`{{skill fact|might|8|game mode = pve}}{{skill fact|might|3|game mode =
    // pvp wvw}}`) — a different root cause than every other entry in this table (no rounding quirk,
    // no empty-API-facts skill), it just wasn't in this script's own automated candidate list for an
    // unconfirmed reason (not every `Category:Split skills` page necessarily resolves cleanly through
    // `resolveOverride`'s cross-validation — see this file's top comment). Added by hand rather than
    // left uncurated once found, same as every other entry above.
    26699: { Might: 3 },

    // Weaver Pistol/Spear Dual Attacks cluster (Elementalist/Weaver, empty-effect-facts curation,
    // see synthetic-facts.json) — same root cause as the Elixir cluster above (zero real API Buff
    // facts, so this script's candidate discovery never reaches these ids).
    71960: { Stability: 3 }, // Flowing Finesse — PvE 5s, WvW/PvP 3s (Regeneration 5s is unsplit)

    // Icerazor's Ire (Revenant/Renegade, empty-effect-facts curation, see synthetic-facts.json) —
    // same zero-API-facts root cause. Only Immobile's split fits this override mechanism (a plain
    // duration change, 2s pve -> 1.5s wvw/pvp). The wiki ALSO splits this skill's Torment and
    // "Initial Vulnerability" facts, but only by STACK COUNT (Torment 3->2, Vulnerability 10->6)
    // with duration unchanged (6s/8s in both modes) — WvwFactOverride only overrides `duration`,
    // never `apply_count`, so that half can't be expressed here; left at the PvE stack counts in
    // synthetic-facts.json (documented gap, not modeled wrong). The skill's OTHER Vulnerability fact
    // (on-hit, 5 stacks/8s, unsplit per the wiki) correctly gets no override at all. 40485 = base
    // cast, 72359 = "Band Together"-enhanced cast (same wiki page, `id = 40485, <!-- enhanced -->
    // 72359`) — both share every fact above; 72359 alone adds an unsplit Chilled 1.5s.
    // Might: 10 added 2026-08-12 (Notoriety trait-linking, see the dedicated block below) —
    // merged into this same key since a JS object literal can't repeat a key.
    //
    // 2026-08-19: `synthetic-facts.json`'s own status for this fact was misspelled "Immobilize"
    // (not "Immobile," the real `CONDITION_NAMES` entry) ever since it was first added — so
    // `classifyBoonCondition` silently dropped the fact entirely (not a duration bug, a total
    // no-show) and this override's own key never actually matched anything either, since
    // `extractFromFacts` looks the override up by `fact.status`. Fixed at the source
    // (`synthetic-facts.json`) and here together; flagged by the user noticing Icerazor's Ire's
    // Immobile had vanished from a build (COMPLETED.md Session 231's fixes shipped the same day,
    // but this typo predates them — confirmed unchanged at the prior commit).
    40485: { Immobile: 1.5, Might: 10 },
    72359: { Immobile: 1.5 },

    // Fox's Fury (Elementalist/Evoker meditation, empty-effect-facts curation, see
    // synthetic-facts.json) — same zero-real-API-Buff-facts root cause for the base cast (76711).
    // Wiki: unconditional self+ally Might (10s/8 stacks pve, 8s/6 stacks wvw+pvp) and Fury (10s pve,
    // 8s wvw+pvp) on every cast. 76711 carries exactly one Might fact and one Fury fact, so both get
    // a normal duration override here (stack-count change 8->6 still isn't expressible — same
    // `apply_count` architecture limit as Icerazor's Ire above; left at the PvE stack count).
    // The Fire-attuned enhanced cast (77282, which DOES already carry real API facts for
    // Fury/Burning/Damage/StunBreak — only Might was missing there) additionally grants a separate
    // "Fox Bonus" Might application (10s/3 stacks pve). Deliberately did NOT give 77282's Might an
    // override entry even though the wiki also splits its duration: `extractFromFacts` collapses
    // EVERY fact sharing one status once an override for that status exists (built for the common
    // case of one application appearing twice as pve/wvw API-duplicate facts, not two genuinely
    // different simultaneous applications) — adding one here silently dropped the Fox Bonus stack
    // entirely rather than just mis-showing its duration, caught by spot-verifying the merged
    // output before trusting it. Left both of 77282's Might facts at PvE duration (10s), documented
    // gap, not modeled wrong.
    76711: { Might: 8, Fury: 8 },

    // Radiant Justice (Guardian/Luminary virtue, empty-effect-facts curation, see
    // synthetic-facts.json) — same zero-real-API-Buff-facts root cause. The Activate cast's
    // self Quickness splits PvE 3s -> WvW/PvP 2s; the passive proc's Burning (every 5 attacks)
    // shares one value across PvE+WvW (2s, only PvP differs to 4s, unmodeled per this app's WvW
    // focus) so gets no override. The "Empowered Hammer" bonus (damage + Vulnerability) is
    // conditional on the NEXT Dazzling Hammer cast, not unconditional on this cast — excluded,
    // same bullet-consume-gated-bonus shape as the Weaver Pistol/Spear cluster.
    78837: { Quickness: 2 },

    // Razorclaw's Rage / Darkrazor's Daring (Revenant/Renegade legendary-stance utilities,
    // Renegade-tooltip-gaps curation 2026-08-12, see synthetic-facts.json) — same zero-real-API-
    // Buff-facts root cause as Icerazor's Ire above (40485/72359), same wiki page shape too: `id =
    // <base>, <!-- enhanced --> <enhanced>` for the "Band Together"-enhanced cast.
    // Razorclaw's Rage (42949 base / 72363 enhanced): wiki splits Bleeding only by STACK COUNT
    // (4 pve -> 3 wvw/pvp, duration unchanged at 8s both modes) — like Icerazor's Ire's Torment/
    // Vulnerability, WvwFactOverride only overrides `duration` so this can't be expressed; left at
    // the PvE stack count, documented gap not modeled wrong. Enhanced-only Torment (6s/3stacks) is
    // unsplit. Also NOT curated at all (neither here nor in synthetic-facts.json): the wiki's own
    // Damage coefficient (2.0 pve/1.5 wvw+pvp, same as Icerazor's Ire's uncurated Damage), and the
    // "Razorclaw's Rage (effect)" ally-attack-enhancing buff + its dependent "Enhance Bleeding" —
    // neither is a recognized boon/condition name (`classifyBoonCondition` would return null) and
    // `factLine` has no generic-Buff-text case, so curating either would be a silent no-op, same
    // "empty-effect-facts scan, not every finding is curatable" shape documented in
    // docs/game-data.md (Unleashed/Gunsaber Mode toggles, Prayer to Lyssa).
    // Darkrazor's Daring (41220 base / 72366 enhanced): wiki has TWO simultaneous Stability facts
    // (a 1s unsplit one, plus a separate 6s pve/4s wvw+pvp 3-stack one) — same "two genuinely
    // different simultaneous applications sharing one status" shape Fox's Fury's 77282 Might hit
    // above (extractFromFacts collapses EVERY fact sharing a status once ANY override for that
    // status exists, so overriding here would silently drop the 3-stack group application instead
    // of just mis-showing its duration) — deliberately left BOTH Stability facts at their PvE
    // duration, documented gap. Daze (2s) is unsplit. "Bonus Defiance Break" (400, pve-tagged only)
    // is a Number fact, not a boon/condition — no override mechanism applies to it regardless.
    // Enhanced-only Resistance (4s) is unsplit; enhanced-only Protection is a single fact with a
    // clean split (no duplicate-status collision), so it gets a normal override below.
    72366: { Protection: 3 },

    // Notoriety (Revenant/Invocation trait 1765, trait-granted-boons-on-skills curation
    // 2026-08-12, see synthetic-facts.json): every legend's heal/utility/elite skill gets its own
    // copy of the trait's own Might fact (5s pve, 2 stacks, `requires_trait: 1765`) so the skill's
    // own tooltip shows Notoriety's contribution — same "trait fact copied onto the skill it
    // actually triggers from" mechanism as the empty-effect-facts synthetic entries above, just
    // gating on a trait instead of filling a real API gap. Mirrors the trait's own already-curated
    // WvW value (10s, see the "1765" entry in the `trait` block below) so the two tooltips agree.
    27220: { Might: 10, Resistance: 4 }, // Facet of Light (Legend1 heal) — Resistance is Ashen Demeanor's (trait 2166, Revenant leg of the trait-granted-boons-on-skills sweep)
    28379: { Might: 10 }, // Facet of Darkness (Legend1 utility)
    27014: { Might: 10 }, // Facet of Elements (Legend1 utility)
    27760: { Might: 10 }, // Facet of Chaos (Legend1 elite)
    26937: { Might: 10, Resistance: 4 }, // Enchanted Daggers (Legend2 heal) — Resistance is Ashen Demeanor's
    29209: { Might: 10 }, // Riposting Shadows (Legend2 utility)
    28231: { Might: 10 }, // Phase Traversal (Legend2 utility)
    27107: { Might: 10 }, // Impossible Odds (Legend2 utility)
    28406: { Might: 10 }, // Jade Winds (Legend2 elite)
    27372: { Might: 10, Resistance: 4 }, // Soothing Stone (Legend3 heal) — Resistance is Ashen Demeanor's
    28516: { Might: 10 }, // Inspiring Reinforcement (Legend3 utility)
    26679: { Might: 10 }, // Forced Engagement (Legend3 utility)
    26557: { Might: 10 }, // Vengeful Hammers (Legend3 utility)
    27975: { Might: 10 }, // Rite of the Great Dwarf (Legend3 elite)
    27322: { Might: 10 }, // Pain Absorption (Legend4 utility)
    27505: { Might: 10 }, // Banish Enchantment (Legend4 utility)
    27917: { Might: 10 }, // Call to Anguish (Legend4 utility)
    28287: { Might: 10 }, // Embrace the Darkness (Legend4 elite)
    45686: { Might: 10, Resistance: 4 }, // Breakrazor's Bastion (Legend5 heal) — Resistance is Ashen Demeanor's
    42949: { Might: 10 }, // Razorclaw's Rage (Legend5 utility)
    // Icerazor's Ire (40485) already has its own entry above (Immobile: 1.5, Might: 10) — a
    // repeated key here would silently discard it, JS object literals can't merge duplicate keys.
    41220: { Might: 10 }, // Darkrazor's Daring (Legend5 utility)
    45773: { Might: 10 }, // Soulcleave's Summit (Legend5 elite)
    28427: { Might: 10, Resistance: 4 }, // Ventari's Will (Legend6 heal) — Resistance is Ashen Demeanor's
    26821: { Might: 10 }, // Protective Solace (Legend6 utility)
    27025: { Might: 10 }, // Natural Harmony (Legend6 utility)
    27715: { Might: 10 }, // Purifying Essence (Legend6 utility)
    27356: { Might: 10 }, // Energy Expulsion (Legend6 elite)
    62962: { Might: 10 }, // Scavenger Burst (Legend7 Archemorus utility)
    62878: { Might: 10 }, // Reaver's Rage (Legend7 Archemorus utility)
    62942: { Might: 10 }, // Spear of Archemorus (Legend7 Archemorus elite)
    62680: { Might: 10 }, // Selfless Spirit (Legend7 Saint Viktor heal)
    62702: { Might: 10 }, // Battle Dance (Legend7 Saint Viktor utility)
    62941: { Might: 10 }, // Tree Song (Legend7 Saint Viktor utility)
    62796: { Might: 10 }, // Awakening (Legend7 Saint Viktor utility)
    62687: { Might: 10 }, // Urn of Saint Viktor (Legend7 Saint Viktor elite)
    77043: { Might: 10, Resistance: 4 }, // Shielding Hands (Legend8 heal) — Resistance is Ashen Demeanor's
    77243: { Might: 10 }, // Hex-Eater Vortex (Legend8 utility)
    77291: { Might: 10 }, // Gladiator's Defense (Legend8 utility)
    76805: { Might: 10 }, // Beguiling Haze (Legend8 utility)
    // Deliberately NOT given a Notoriety override, same "extractFromFacts collapses EVERY fact
    // sharing one status once an override for that status exists" hazard as Fox's Fury/Darkrazor's
    // Daring above:
    //   - 26644 (Facet of Strength, Legend1 utility): already carries 2 REAL Might facts under an
    //     existing override (`Might: 6` above) — a 3rd trait-gated one would be silently dropped by
    //     the dedup, not just mis-shown, so `synthetic-facts.json` skips this id's Notoriety fact
    //     entirely rather than adding permanently-invisible data (see TODO.md).
    //   - 76968 (Twin Moon Sweep, Legend8 elite), 28219 (Empowering Misery, Legend4 heal), 62719
    //     (Selfish Spirit, Legend7 Archemorus heal), 62832 (Nomad's Advance, Legend7 Archemorus
    //     utility): each already carries its own unconditional Might fact with NO existing
    //     override — adding one here would both corrupt that unconditional fact's shown duration
    //     AND drop the new Notoriety one via the same dedup. Left unsplit: the Notoriety fact is
    //     present (synthetic-facts.json) and displays, just without the pve/wvw duration split
    //     (flat 5s), same documented-gap shape as Icerazor's Ire's stack counts above.

    // Holo-Dancer Decoy (Thief/Deadeye-reachable Convergence "Defensive Artifact" skill, id 76674
    // only — found 2026-08-14 curating BUFF_INSTANCE_LABELS in sources.ts, Thief leg): a clean
    // Taunt split, wiki-confirmed (`{{skill fact|taunt|3|game mode=pve wvw}}{{skill fact|taunt|1|
    // game mode=pvp}}`) — the pve+wvw value (3) already matches this id's first raw Taunt fact
    // exactly, so this override exists purely to collapse the pvp-only 2nd fact out of the
    // pve+wvw-facing tooltip, not to correct a wrong number. 76800 (the other split id) doesn't
    // carry this 2nd Taunt fact at all, so needs no entry.
    76674: { Taunt: 3 },

    // Banner of Tactics (Warrior banner utility, id 14408 — found 2026-08-14 curating
    // BUFF_INSTANCE_LABELS in sources.ts, Warrior leg): a clean Resistance split, wiki-confirmed
    // (infobox `split = pve pvp, wvw`, `{{skill fact|resistance|2|game mode=pve pvp}}
    // {{skill fact|resistance|1|game mode=wvw}}`) — both values already present among the raw facts.
    // This skill's OTHER conflict, a raw-identical Stability pair, is NOT given an override: the
    // wiki only carries one `alt=`-labeled Stability template for the whole page (see
    // `BUFF_INSTANCE_LABELS`'s own comment on this id), so there's no 2nd concept to collapse away
    // — an override here would silently drop a real, distinct application.
    14408: { Resistance: 1 },

    // Guardian leg (5th leg of the BUFF_INSTANCE_LABELS sweep, 2026-08-14):
    // Tome of Justice (44364, dormant id 68647): plain 3-way Passive Burning split, wiki-confirmed
    // (`{{skill fact|Burning|alt=Burning (Passive)|1|game mode = pve}}{{skill fact|Burning|alt=
    // Burning (Passive)|2|game mode = wvw}}{{skill fact|Burning|alt=Burning (Passive)|4|game mode =
    // pvp}}`) — one wiki concept, single alt= text, so this belongs here rather than in
    // BUFF_INSTANCE_LABELS. Both pve(1) and wvw(2) values are present among the 3 raw facts.
    44364: { Burning: 2 },
    68647: { Burning: 2 },
    // Shield of Judgment (9087, split id 15834): plain pve+wvw(4)/pvp(2) Protection split, no alt=
    // (`{{skill fact|protection|4|game mode = pve wvw}}{{skill fact|protection|2|game mode = pvp}}`).
    9087: { Protection: 4 },
    15834: { Protection: 4 },
    // Sword of Justice (Dragonhunter trap, ids 9168/44846/55019/55027 all sharing one wiki page):
    // plain pve(8)/pvp+wvw(6) Vulnerability split, no alt=.
    9168: { Vulnerability: 6 },
    44846: { Vulnerability: 6 },
    55019: { Vulnerability: 6 },
    55027: { Vulnerability: 6 },
    // Advancing Strike (Willbender): plain pve(1)/wvw+pvp(2) Immobile split, no alt=.
    62650: { Immobile: 2 },
    // Willbender Flames' 3 variants (62528/62552/62618) each carry a Searing Pact
    // (trait 2191)-linked Burning pair with NO `overrides` link (a real trait-granted-boon-copied-
    // onto-the-skill-it-triggers-from case, same mechanism as the Notoriety cluster above) — mirrors
    // trait 2191's own already-curated override below so both tooltips agree.
    62528: { Burning: 2 },
    62552: { Burning: 2 },
    62618: { Burning: 2 },

    // Engineer leg (6th leg of the BUFF_INSTANCE_LABELS sweep, 2026-08-14): Magnetic Shield (6053)
    // and Static Shield (6054) each carry an Over Shield (trait 394)-linked Protection pair with no
    // `overrides` link (a real trait-granted-boon-copied-onto-the-skill case, same mechanism as
    // Willbender Flames above) — Over Shield's own page has no `{{trait fact}}` for it (its only fact
    // is a flat "Effectiveness Increased 20%" Percent fact, not a Buff), but its version history
    // confirms the split directly: "Reduced protection duration from 3 seconds to 2 seconds in PvP
    // only" — pve+wvw=3 (matching each skill's own first raw fact exactly, so this override exists
    // purely to collapse the pvp-only 2nd fact, same "value matches the fact it's collapsing onto"
    // shape as Holo-Dancer Decoy's Taunt override above), pvp=2.
    6053: { Protection: 3 },
    6054: { Protection: 3 },
    // Blessing of Dwayna (12377), Leafy Bandage (12465), Static Shock (21661), Bandage Self (29772),
    // and Regenerating Mist (6176) each carry an Expert Examination (trait 1999)-linked Protection
    // pair, same mechanism — mirrors trait 1999's own already-curated override below so both
    // tooltips agree. Toss Elixir H (5978/6118, both split ids) and Reconstruction Field (29505)
    // carry the identical trait-1999-linked pair too, but ALSO carry their own genuine
    // untraited base Protection fact (2s) sharing the same status — a flat override here would wrongly
    // overwrite that legitimate untraited value too (this mechanism can only override a whole status,
    // not scope to just the trait-gated subset), so those 3 ids are deliberately left unfixed; see
    // BUFF_INSTANCE_LABELS's own doc comment on this leg for the full writeup.
    12377: { Protection: 3 },
    12465: { Protection: 3 },
    21661: { Protection: 3 },
    29772: { Protection: 3 },
    6176: { Protection: 3 },

    // Ranger leg (7th leg of the BUFF_INSTANCE_LABELS sweep, 2026-08-14): the 3 elite Ranger spirits
    // (Storm/Stone/Frost Spirit) each carry a raw-identical duplicate Buff fact pair for their pulsed
    // boon (both facts show the PvE duration twice — the API never encodes the wvw+pvp value at all
    // here, unlike the usual {pve, wvw} pair auto-detection expects), confirmed via wiki as a plain
    // pve/wvw+pvp split with no `alt=` wording. Storm Spirit's Fury: pve=2s (matches both raw facts),
    // wvw+pvp=1.5s (2023-07-18 patch note: "Increased fury duration from 1.5 seconds to 2 seconds in
    // PvE only" — confirms 1.5 predates the split and is still the wvw+pvp value). Stone Spirit's
    // Protection: pve=2s (matches both raw facts), wvw+pvp=1.5s, same shape, no version-history note
    // needed since the wiki states both values directly. Frost Spirit's own duplicate Resolution pair
    // (2s×4 twice) is NOT included here — its wiki page has only ONE `{{skill fact|resolution|2|
    // stacks=4}}` line with no game-mode split at all, so there's nothing to attribute either raw fact
    // to; left open in BUFF_INSTANCE_LABELS's own doc comment instead.
    12493: { Fury: 1.5 },
    12495: { Protection: 1.5 },

    // Mesmer leg (8th leg of the BUFF_INSTANCE_LABELS sweep, 2026-08-14): Cry of Frustration
    // (10190), Rewinder (56928), Bladesong Sorrow (62616), and Flustering Flute (76746) each carry
    // a Bountiful Disillusionment (trait 1687)-linked Vigor pair with no `overrides` link (a
    // trait-fact-copied-onto-the-skill-it-triggers-from case, same mechanism as Willbender Flames/
    // Over Shield above) — each is the ONLY source of Vigor on its own skill (single concept, safe
    // to collapse), mirrors trait 1687's own already-curated override below so every tooltip agrees.
    // Wiki (on trait 1687's own page): `{{skill fact|vigor|8|linked skill=Cry of Frustration|game
    // mode=pve}}{{skill fact|vigor|5|linked skill=Cry of Frustration|game mode=wvw pvp}}`.
    10190: { Vigor: 5, Vulnerability: 6, Torment: 3, Blinded: 1.5 }, // + Mesmer leg mirrors below
    56928: { Vigor: 5 },
    62616: { Vigor: 5, Vulnerability: 6, Torment: 3, Blinded: 1.5, Aegis: 3 }, // + Mesmer leg mirrors
    76746: { Vigor: 5 },
    // Deafening Drum (77079) carries the same trait 1687-linked Fury pair (Diversion-linked on the
    // trait's own page: `{{skill fact|fury|10|25|linked skill=Diversion|game mode=pve}}
    // {{skill fact|fury|6|linked skill=Diversion|game mode=wvw pvp}}`), also the only Fury source on
    // this skill — safe single-concept collapse, mirrors trait 1687's own override.
    77079: { Fury: 6 },
    // Crescendo (76931) carries a Life of the Party (trait 2367)-linked Quickness triple, but ONLY
    // its own "linked skill=Crescendo" concept (Lively Lute's separate Quickness concept lives on
    // that skill's own id, not here) — safe single-concept collapse. Wiki (trait 2367's page):
    // `{{skill fact|Quickness|8|linked skill=Crescendo|game mode = pve}}{{skill fact|Quickness|2|
    // linked skill=Crescendo|game mode = wvw}}{{skill fact|Quickness|4|linked skill=Crescendo|game
    // mode = pvp}}` — a 3-way split, wvw value used per this app's WvW focus.
    76931: { Quickness: 2 },
    // Phantasmal Lancer (72946): 2 independent single-concept pve/wvw+pvp splits, no `alt=`. Wiki:
    // `{{skill fact|cripple|3|game mode = pve}}{{skill fact|cripple|2|game mode = pvp wvw}}` and
    // `{{skill fact|immobilize|alt=Immobilize against Crippled Targets|2|game mode = pve}}
    // {{skill fact|immobilize|alt=Immobilize against Crippled Targets|1|game mode = pvp wvw}}` — the
    // Immobilize pair's `alt=` text is identical on both mode variants (one concept, not two), so
    // still belongs here rather than BUFF_INSTANCE_LABELS.
    72946: { Crippled: 2, Immobile: 1 },
    // Abstraction (72076): plain pve(5)/pvp+wvw(3) Blinded split, no `alt=`
    // (`{{skill fact|blindness|5|game mode = pve}}{{skill fact|blindness|3|game mode = pvp wvw}}`).
    72076: { Blinded: 3 },

    // Elementalist leg (9th leg of the BUFF_INSTANCE_LABELS sweep, FINAL leg, 2026-08-14):
    // Frost Aura (5520): plain pve+pvp(2)/wvw(1) Chilled split, no `alt=`
    // (`{{skill fact|chilled|2|game mode=pve pvp}}{{skill fact|chilled|1|game mode=wvw}}`).
    5520: { Chilled: 1 },
    // Shattering Ice (62698, Catalyst augment): plain pve(1)/pvp+wvw(0.5) Chilled split, no `alt=`
    // — the wvw value hits the documented "API rounds a half-second duration up" quirk (0.5 -> 1),
    // so both raw facts show 1 and the auto-detector can't find a literal 0.5 to cross-validate;
    // hand-added same as every other rounding-quirk entry above.
    62698: { Chilled: 0.5 },
    // Conflagration (76585, Evoker Fox mechanic): plain pve(4.5)/pvp+wvw(5) Burning split, no
    // `alt=` — the PvE value ALSO hits the rounding quirk (4.5 -> 5), landing on the exact same
    // displayed number as the unrounded wvw+pvp value, so both raw facts already show 5 — this
    // override exists purely to collapse the 2 raw-identical facts into one row, not to correct a
    // number (same "value already matches, purpose is dedup" shape as Holo-Dancer Decoy/Over
    // Shield above).
    76585: { Burning: 5 },
    // Fox's Fury's enhanced cast (77282): a plain pve(10)/pvp+wvw(8) Fury split, no `alt=`
    // (`{{skill fact|fury|10|25|game mode = pve}}{{skill fact|fury|8|game mode = wvw pvp}}`) — found
    // while re-examining this skill (already partially curated for the base cast, 76711, in the
    // Revenant leg above) for its OTHER, left-open conflicts (see BUFF_INSTANCE_LABELS's own
    // comment on this leg for the Might/Burning writeup); this Fury pair was simply never added
    // back then.
    77282: { Fury: 8 },

    // Inscription cluster (trait 229, Air Master, "gain boons on glyph cast by attunement") — the
    // trait's own entries live in the `trait` block below; these are the Glyph skills whose own
    // Might/Regeneration comes SOLELY from that trait (copied onto each skill's own tooltip, same
    // "trait fact copied onto the skill it triggers from" mechanism as Willbender Flames/Over
    // Shield above), each mirroring trait 229's own already-curated override so every tooltip
    // agrees. Fire-attuned copies (Might):
    5736: { Might: 6 }, // Firestorm (Glyph of Storms, fire-attuned)
    5762: { Might: 6 }, // Renewal of Fire
    24407: { Might: 6 }, // Renewal of Fire (2nd split id)
    25486: { Might: 6 }, // Glyph of Lesser Elementals (fire-attuned)
    25488: { Might: 6 }, // Glyph of Elementals (elite)
    34736: { Might: 6 }, // Glyph of Elemental Power (fire-attuned)
    // Water-attuned copies (Regeneration):
    5735: { Regeneration: 5 }, // Ice Storm (Glyph of Storms, water-attuned)
    5763: { Regeneration: 5 }, // Renewal of Water
    24410: { Regeneration: 5 }, // Renewal of Water (2nd split id)
    25487: { Regeneration: 5 }, // Glyph of Lesser Elementals (water-attuned)
    34772: { Regeneration: 5 }, // Glyph of Elemental Power (water-attuned)
    // Glyph of Elemental Harmony (34743, the Heal-slot glyph) carries this exact Inscription-linked
    // Might pair TOO, but ALSO its own genuine unsplit 20s/3-stack Might grant (wiki-confirmed:
    // `{{skill fact|might|20|stacks=3|linked skill=Fire Attunement}}`, no mode split at all) — the
    // same "coexisting genuine untraited application blocks a safe status-wide override" hazard as
    // Toss Elixir H/Reconstruction Field (Engineer leg), so deliberately NOT given an entry here;
    // left open, see BUFF_INSTANCE_LABELS's own comment on this leg.

    // Implacable Foe (trait 2192, Harbinger Master, "gain stability when entering Harbinger
    // Shroud") — mirrors the trait's own already-auto-detected override below onto Harbinger
    // Shroud's own synthetic copy of this fact (`synthetic-facts.json`, trait-granted-boons-on-skills
    // curation, Necromancer leg, 2026-08-14), same "trait fact copied onto the skill it triggers
    // from" mechanism as the Inscription cluster above. The trait's OTHER Buff fact, "Implacable Foe
    // (effect)" (-50% incoming damage, flat 2s, no split), was deliberately NOT mirrored — its
    // `status` isn't in `BOON_NAMES`/`CONDITION_NAMES` so nothing renders it regardless (a self-buff
    // marker, same "dead entry" shape as the Thief leg's "Assassin's Signet" exclusion).
    62567: { Stability: 3 }, // Harbinger Shroud

    // Guardian leg (4th leg of the trait-granted-boons-on-skills sweep, 2026-08-14): Liberator's Vow
    // (trait 2101, Firebrand Adept, "grant allies quickness when you use your heal skill") mirrors
    // the trait's own already-auto-detected override below onto every Guardian heal skill's own
    // synthetic copy of this fact (`synthetic-facts.json`), same "trait fact copied onto the skill it
    // triggers from" mechanism as Implacable Foe above.
    9083: { Quickness: 1 }, // "Receive the Light!"
    9102: { Quickness: 1 }, // Shelter
    9158: { Quickness: 1 }, // Signet of Resolve
    12360: { Quickness: 1, Regeneration: 4 }, // Prayer to Dwayna (racial) — Regeneration is the
    // Mesmer leg's Metaphysical Rejuvenation mirror (trait-granted-boons-on-skills sweep,
    // 2026-08-14), see that leg's own comment below for why 12440/Healing Seed doesn't get one
    12440: { Quickness: 1 }, // Healing Seed (racial)
    21664: { Quickness: 1 }, // Litany of Wrath
    30025: { Quickness: 1 }, // Purification (Dragonhunter)
    41475: { Quickness: 1 }, // Restoring Reprieve (Firebrand) — merges (via applyManualOverrides)
    // with this id's already-automated Protection/Resolution "omit" entries, doesn't replace them
    41714: { Quickness: 1 }, // Mantra of Solace (Firebrand)
    42960: { Quickness: 1 }, // Rejuvenating Respite (Firebrand)
    62622: { Quickness: 1 }, // Reversal of Fortune (Willbender)
    76621: { Quickness: 1 }, // Resolute Stance (Luminary)
    // Focus Mastery (trait 633, Valor Adept, "Focus skills grant you protection") — the Protection
    // half is tied specifically to Shield of Wrath's own block window per its 2024-03-19 patch note
    // ("Protection from this trait will now apply when Shield of Wrath expires instead of when it
    // activates"), not to Ray of Judgment (Focus's other skill, which only gets this trait's
    // unsplit Resolution half, needing no override) — mirrors trait 633's own already-auto-detected
    // Protection override below onto Shield of Wrath's synthetic copy of the fact.
    9082: { Protection: 2 }, // Shield of Wrath

    // Mesmer leg (5th leg of the trait-granted-boons-on-skills sweep, 2026-08-14): each entry below
    // mirrors a Mesmer trait's own already-auto-detected override (see this table's `trait` block)
    // onto that trait's synthetic copy of the fact on the skill(s) it triggers from
    // (`synthetic-facts.json`), same mechanism as the legs above. Two ids are deliberately EXCLUDED
    // from an entry despite carrying a mirrored fact, both because a pre-existing genuine fact of
    // the SAME status already lives on that skill with no override of its own — adding one here
    // would incorrectly collapse the pre-existing fact into this override's value too (same
    // "coexisting genuine untraited/differently-traited application blocks a safe status-wide
    // override" hazard noted elsewhere in this file): Healing Seed (12440) has its own real API
    // Regeneration@3@1 (unconditional, no `requires_trait`) already on it — Metaphysical
    // Rejuvenation's Regeneration mirror is left at its raw 6s value there instead (see
    // BUFF_INSTANCE_LABELS's own note for the Time Warp case, same reasoning). Cry of Frustration
    // (10190) and Bladesong Sorrow (62616) already carry Phantasmal Force's (trait 1687) own Vigor
    // override below — Nomad's Endurance's Vigor mirror was left OFF those 2 ids entirely (not just
    // un-overridden) in `synthetic-facts.json`, since the 2 traits' Vigor values genuinely differ
    // (5 vs 1.5) and the override table can't hold 2 values for one status on one skill.
    10176: { Regeneration: 4 }, // Ether Feast
    10177: { Regeneration: 4 }, // Mirror
    10213: { Regeneration: 4 }, // Mantra of Recovery
    10214: { Regeneration: 4 }, // Power Return
    // Prayer to Dwayna (12360, racial) gets a Regeneration entry merged into its existing Quickness
    // one below (Guardian leg) — safe here (unlike Healing Seed/12440): its only other Regeneration
    // fact is Soothing Ice's (Elementalist trait 348), a different profession, never simultaneously
    // active with a Mesmer's own Metaphysical Rejuvenation.
    21750: { Regeneration: 4 }, // Signet of the Ether
    30305: { Regeneration: 4 }, // Well of Eternity
    40200: { Regeneration: 4 }, // False Oasis
    62522: { Regeneration: 4 }, // Twin Blade Restoration
    76695: { Regeneration: 4 }, // Tale of the Second Scion
    // Rending Shatter (687) / Maim the Disillusioned (1690) / Nomad's Endurance (2069) — all "Shatter
    // skills" category triggers, mirrored onto the 5 base shatter ids (Mind Wrack's 2, Cry of
    // Frustration, Diversion, Distortion) plus all 6 Virtuoso Bladesong ids (wiki: Rending Shatter's
    // own `improves type = Shatter, Bladesong, Instrument` field — Bladesongs mechanically count as
    // Shatters; Instrument/Troubadour skill ids deliberately not covered this leg, too recent/no deep
    // prior knowledge, same reasoning as every other Troubadour exclusion this leg). Cry of
    // Frustration (10190) and Bladesong Sorrow (62616) get their Vulnerability/Torment/Blinded merged
    // into their existing Phantasmal Force-linked Vigor entry above instead of a fresh one here.
    10191: { Vulnerability: 6, Torment: 3, Vigor: 1.5 }, // Mind Wrack
    49068: { Vulnerability: 6, Torment: 3, Vigor: 1.5 }, // Mind Wrack (flip/charged copy)
    10287: { Vulnerability: 6, Torment: 3, Vigor: 1.5 }, // Diversion
    10192: { Vulnerability: 6, Torment: 3, Vigor: 1.5, Resistance: 2.5 }, // Distortion
    62586: { Vulnerability: 6, Torment: 3, Vigor: 1.5, Aegis: 3 }, // Bladesong Harmony
    62617: { Vulnerability: 6, Torment: 3, Vigor: 1.5, Aegis: 3 }, // Bladesong Harmony (2nd id)
    62602: { Vulnerability: 6, Torment: 3, Vigor: 1.5, Aegis: 3 }, // Bladesong Dissonance
    62597: { Vulnerability: 6, Torment: 3, Vigor: 1.5, Aegis: 3 }, // Bladeturn Requiem
    // Bladesong Distortion (68273) deliberately has NO Aegis entry here despite carrying both
    // Inspiring Distortion's (1852, unsplit 2s, no override needed) and Bladeturn Refrain's (2212,
    // wvw 3s) Aegis mirrors — adding one would incorrectly collapse Inspiring Distortion's own
    // unsplit fact into Bladeturn Refrain's value too (same hazard as the Vigor exclusion above).
    68273: { Vulnerability: 6, Torment: 3, Vigor: 1.5, Resistance: 2.5 }, // Bladesong Distortion
    // Temporal Enchanter (1980, Chaos Master, "when you cast a glamour, allies near the glamour gain
    // resistance and superspeed") mirrored onto every Glamour-category skill except Portal Exeunt
    // (wiki: "does not grant allies these boons"). Time Warp (10311/10377) deliberately has NO
    // Superspeed entry — see BUFF_INSTANCE_LABELS's own comment on those 2 ids for why (its own
    // unconditional Superspeed@2@1 base fact would get incorrectly collapsed into this override).
    10187: { Superspeed: 2, Resistance: 2 }, // Veil
    50414: { Superspeed: 2, Resistance: 2 }, // Veil (2nd id)
    10197: { Superspeed: 2, Resistance: 2 }, // Portal Entre
    10203: { Superspeed: 2, Resistance: 2 }, // Null Field
    50440: { Superspeed: 2, Resistance: 2 }, // Null Field (2nd id)
    10302: { Superspeed: 2, Resistance: 2 }, // Feedback
    34326: { Superspeed: 2, Resistance: 2 }, // Feedback (2nd id)
    10311: { Resistance: 2 }, // Time Warp
    10377: { Resistance: 2 }, // Time Warp (2nd id)

    // Ranger leg (6th leg of the trait-granted-boons-on-skills sweep, 2026-08-14): each entry
    // below mirrors a Ranger trait's own already-auto-detected override (see this table's `trait`
    // block) onto that trait's synthetic copy of the fact on the skill(s) it triggers from
    // (`synthetic-facts.json`), same mechanism as every prior leg. Wellspring (978, Druid Adept,
    // "grant regeneration when you use a healing skill") mirrors onto all 14 Ranger heal skill
    // ids; Stoneform (1021, Marksmanship Master, "activating a Signet grants might and fury")
    // onto all 4 signet ids; Wilderness Knowledge (1699, Survival, "Survival skills grant fury")
    // onto all 6 Survival skill ids; Let Loose (2271, Soulbeast, "Unleashed Ambush skills grant
    // boons") onto the 12 Unleashed Ambush skill ids (Quickness is PvE-only, omitted in WvW).
    // Fang and Claw (1016, Fury)/Rejuvenation (1055, Regeneration)/Live Fast (2071, Fury+
    // Quickness)/Flock Together (2408, Quickness) are all "Beast skills grant ___" category
    // triggers, mirrored onto all 76 Ranger pet skill ids game-wide (same full-category-sweep
    // shape as Engineer's Optimized Activation/56-tool-belt-id leg) — 5 of those 76 ids already
    // carry a genuine, differently-valued real API fact of the exact same status (Furious
    // Screech/12712 and Furious Pounce/31451 both have their own unsplit Fury; Regenerate/12703
    // and Regenerate/12717 their own Regeneration; Feeding Frenzy/12757 its own Quickness) —
    // deliberately EXCLUDED from an override entry for just that one status on just that one id
    // (synthetic-facts.json still carries the mirrored fact there, just left unsplit at its raw
    // PvE value), same "coexisting genuine untraited application blocks a safe status-wide
    // override" hazard as every prior leg. See docs/game-data.md's synthetic-facts.json section
    // (case 3) for the full writeup.

    // Heal-skill-category (Wellspring):
    12483: { Regeneration: 4, Fury: 4 }, // Troll Unguent
    21773: { Regeneration: 4 }, // Water Spirit
    21776: { Regeneration: 4 }, // Aqua Surge
    31407: { Regeneration: 4 }, // Glyph of Rejuvenation
    31819: { Regeneration: 4 }, // Glyph of Rejuvenation
    31867: { Regeneration: 4 }, // Glyph of Rejuvenation
    44948: { Regeneration: 4 }, // Bear Stance
    63319: { Regeneration: 4 }, // Perilous Gift
    69244: { Regeneration: 4 }, // Water Spirit
    77271: { Regeneration: 4 }, // Soothing Breeze
    // Prayer to Dwayna (12360) already carries Regeneration: 4 from the Mesmer leg's Metaphysical
    // Rejuvenation mirror — Wellspring's own WvW value happens to match, no new entry needed, just
    // a fresh BUFF_INSTANCE_LABELS collision (see sources.ts). Healing Seed (12440), Healing Spring
    // (12489), and "We Heal As One!" (31914) all already carry a genuine, differently-valued
    // Regeneration fact of their own — Wellspring's mirror is deliberately left un-overridden
    // (unsplit) on those 3 ids too, same hazard as every other coexisting-fact exclusion.

    // Signet-category (Stoneform):
    12491: { Fury: 6, Might: 8 }, // Signet of the Wild
    12500: { Fury: 6, Might: 8 }, // Signet of Stone
    12502: { Fury: 6, Might: 8 }, // Signet of Renewal
    12542: { Fury: 6, Might: 8 }, // Signet of the Hunt

    // Survival-category (Wilderness Knowledge) — Troll Unguent (12483) is both a heal skill AND a
    // Survival skill, already merged into the single entry above:
    12494: { Fury: 4 }, // Lightning Reflexes
    12501: { Fury: 4 }, // Muddy Terrain
    12537: { Fury: 4 }, // Sharpening Stone
    12550: { Fury: 4 }, // Quickening Zephyr
    12580: { Fury: 4 }, // Entangle

    // Beastmode entry/exit (Unstoppable Union, 2072) needs no entry — its Protection fact is unsplit.

    // Release Celestial Avatar (Celestial Shadow, 2053) — Stealth pve(3)/wvw+pvp(2) is a NEW
    // manual entry (wiki-confirmed via `{{skill fact|stealth|3|game mode = pve}}{{skill
    // fact|stealth|2|game mode = pvp wvw}}`), not previously auto-detected on the trait itself
    // either — see the matching new `trait: { 2053: ... }` entry below:
    31411: { Stealth: 2 }, // Release Celestial Avatar — Superspeed is unsplit

    // Unleashed Ambush-category (Let Loose, 2271) — Quickness omitted in WvW entirely:
    63065: { Quickness: 'omit', Might: 8 }, // Vicious Pike
    63129: { Quickness: 'omit', Might: 8 }, // Sundering Volley
    63225: { Quickness: 'omit', Might: 8 }, // Multishot
    63301: { Quickness: 'omit', Might: 8 }, // Jagged Fan
    63326: { Quickness: 'omit', Might: 8 }, // Toxic Shot
    63336: { Quickness: 'omit', Might: 8 }, // Deft Strike
    63350: { Quickness: 'omit', Might: 8 }, // Savage Slash
    63438: { Quickness: 'omit', Might: 8 }, // Relentless Whirl
    69175: { Quickness: 'omit', Might: 8 }, // Solar Brilliance
    69223: { Quickness: 'omit', Might: 8 }, // Neurotoxin Burst
    72079: { Quickness: 'omit', Might: 8 }, // Rampant Growth
    72932: { Quickness: 'omit', Might: 8 }, // Ravager's Abandon

    // Hawkeye (Jetstream, 2341) needs no entry — its Superspeed fact is unsplit.

    // Beast-category ("Beast skills grant ___"), all 76 Ranger pet skill ids — Fang and Claw
    // (Fury 6), Rejuvenation (Regeneration 5), Live Fast (Fury 6 + Quickness 2), Flock Together
    // (Quickness 3); see the 5 exclusions noted in the leg comment above.
    12656: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Icy Bite
    12658: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Mighty Roar
    12664: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Rending Maul
    12666: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Shake It Off
    12667: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Icy Roar
    12670: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Fire Breath
    12674: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Poison Barbs
    12675: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Poisonous Cloud
    12679: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Rending Barbs
    12680: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Rending Pounce
    12681: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Stalk
    12685: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Enfeebling Roar
    12687: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Poison Cloud
    12688: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Enfeebling Maul
    12689: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Icy Maul
    12690: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Poisonous Maul
    12691: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Purge Conditions
    12693: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Icy Pounce
    12695: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Boil
    12696: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Frost Breath
    12697: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Frost Nova
    12698: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Lightning Breath
    12699: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Electrocute
    12700: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Poison Cloud
    12701: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Insect Swarm
    12702: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Poison Cloud
    12703: { Fury: 6, Quickness: 3 }, // Regenerate
    12704: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Lashtail Venom
    12708: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Dazing Screech
    12709: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Dazing Screech
    12711: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Icy Screech
    12712: { Regeneration: 5, Quickness: 3 }, // Furious Screech
    12713: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Protecting Screech
    12714: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Terrifying Howl
    12715: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Intimidating Howl
    12716: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Chilling Howl
    12717: { Fury: 6, Quickness: 3 }, // Regenerate
    12718: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Howl of the Pack
    12721: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Chilling Slash
    12722: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Brash Slash
    12723: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Blinding Slash
    12729: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Paralyzing Venom
    12730: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Weakening Venom
    12731: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Deadly Venom
    12732: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Forage Sword
    12744: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Stunning Rush
    12748: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Chilling Whirl
    12749: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Immobilizing Whirl
    12754: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Forage Rock
    12755: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Forage Scale
    12756: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Forage Feathers
    12757: { Fury: 6, Regeneration: 5 }, // Feeding Frenzy
    16426: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Sonic Shriek
    16427: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Sonic Barrier
    20975: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Lacerating Slash
    31367: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Spike Barrage
    31451: { Regeneration: 5, Quickness: 3 }, // Furious Pounce
    31459: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Consuming Flame
    31568: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Smoke Cloud
    31639: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Lightning Assault
    41156: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Fang Grapple
    42180: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Blinding Roar
    42963: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Savannah Strike
    43636: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Head Toss
    44980: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Jacaranda's Embrace
    63716: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Gale Breath
    65109: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Guardian's Roar
    65418: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Hunker Down
    66622: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Bloodthirsty Charge
    71002: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Dimension Breach
    71688: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Ley Energy Pulse
    72843: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Panopticon
    74314: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Rallying Roar
    75783: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Honey Toss
    78873: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Piercing Shriek
    79766: { Fury: 6, Regeneration: 5, Quickness: 3 }, // Innocent Display

    // Revenant leg (7th leg of the trait-granted-boons-on-skills sweep, 2026-08-14): "invoke a
    // legend" category (all 10 Legendary ___ Stance swap skill ids) gets Spiritual Reckoning's
    // Resolution mirror — pve(6)/wvw+pvp(3), wiki-confirmed
    // (`{{skill fact|resolution|6|game mode = pve}}{{skill fact|resolution|3|game mode = wvw
    // pvp}}`); Aggressive Arrival's Resistance (2s) and Invoker's Rage's Fury (5s) are both flat,
    // no override needed. Mirrors trait 1810's own new entry below so both tooltips agree.
    28085: { Resolution: 3, Protection: 2 }, // Legendary Dragon Stance — Protection is Spirit
    // Boon's own Dragon-specific mirror (pve 3/wvw+pvp 2)
    28134: { Resolution: 3, Might: 6 }, // Legendary Assassin Stance — + Spirit Boon's Might
    // (pve 10/2 stacks, wvw+pvp 6/2 stacks; trait 1774's own entry below)
    28195: { Resolution: 3 }, // Legendary Centaur Stance
    28419: { Resolution: 3 }, // Legendary Dwarf Stance
    28494: { Resolution: 3 }, // Legendary Demon Stance
    41858: { Resolution: 3 }, // Legendary Renegade Stance
    46409: { Resolution: 3 }, // Legendary Renegade Stance
    62749: { Resolution: 3 }, // Legendary Alliance
    62891: { Resolution: 3 }, // Legendary Alliance Stance
    76610: { Resolution: 3 }, // Legendary Entity Stance
    // Its Might/Stability/Regeneration/Resolution/Vigor mirrors onto the other legends' swap ids
    // are all flat (no split), except Assassin's Might above.
    // Balance in Discord (2254): Regeneration pve+wvw(6)/pvp(3) — WvW equals PvE here (only PvP
    // differs), so no override needed at all, same "genuinely unsplit for this app's WvW-vs-PvE
    // focus" shape as every PvP-only split elsewhere in this file.

    // Ashen Demeanor (2166, Renegade Corruption, "gain might, resistance, and Kalla's Fervor when
    // you use a healing skill", mirrored onto all 8 Revenant heal skill ids): Resistance pve(6)/
    // wvw+pvp(4), wiki-confirmed (`{{skill fact|resistance|6|game mode=pve}}{{skill
    // fact|resistance|4|game mode=wvw pvp}}`); Might (6s, 5 stacks) is flat. Kalla's Fervor is not
    // a recognized boon (same exclusion as every other Kalla's Fervor mention in this project) so
    // isn't mirrored at all. Mirrors trait 2166's own new entry below. 6 of the 8 heal ids already
    // carry a Notoriety (trait 1765) `Might: 10` override from the earlier 2026-08-12 curation —
    // merged into those existing entries above rather than duplicated here (JS object literals
    // can't merge duplicate keys); only the 2 heal ids Notoriety's own override deliberately left
    // unsplit (Empowering Misery, Selfish Spirit — see that entry's own comment above) are new here.
    28219: { Resistance: 4 }, // Empowering Misery (Legend4 heal)
    62719: { Resistance: 4 }, // Selfish Spirit (Legend7 heal)
    // Redemptor's Sermon (2228, "heal allies in the area and grant them protection when you use a
    // healing skill", also mirrored onto the same 8 heal ids) needs no entry — its Protection (3s)
    // is flat, no split.

    // Cosmic Wisdom (77371) — Mistfire's (trait 2429) "additional strike on Cosmic Wisdom cast"
    // copied onto Cosmic Wisdom's own facts via `synthetic-facts.json` (`requires_trait: 2429`,
    // same "trait fact copied onto the skill it triggers from" mechanism as the Notoriety cluster
    // above). Mirrors trait 2429's own already-curated Burning override below (pve 6s / wvw+pvp
    // 4s) so both tooltips agree. Found 2026-08-20 (user: "Numinous Gift gives boons... Found
    // Purpose and Mistfire" also affect Cosmic Wisdom) — Numinous Gift's own 5 per-legend boons +
    // flat Might, also copied onto 77371 the same way, need no entry here: none of them has a
    // pve/wvw split (confirmed during the earlier Conduit `wvw-fact-overrides.json` leg this same
    // day). See `boon-calc/sources.ts`'s own comment near `LEGEND_FORM_FACT_SKILL_IDS` for the
    // full writeup, including why Found Purpose was deliberately NOT added the same way.
    77371: { Burning: 4 }
  },
  trait: {
    // Panic Strike (Thief/Deadly Arts trait 1292) and Be Quick or Be Killed (Thief/Trickery trait
    // 2093) — found alongside Holo-Dancer Decoy above, same Thief leg. Both are plain pve/wvw+pvp
    // splits with no `alt=` wording (Panic Strike: `{{trait fact|immobile|2.5|game mode=pve}}
    // {{trait fact|immobile|1.5|game mode=wvw pvp}}`; Be Quick or Be Killed:
    // `{{trait fact|quickness|4|game mode=pve}}{{trait fact|quickness|2.5|game mode=pvp wvw}}`) —
    // both also hit the documented "API rounds a half-second duration up" quirk (this file's own
    // top comment; same shape as Potent Haste/Overwhelming Celerity): neither wiki value (1.5, 2.5)
    // appears literally among the local raw facts ({3, 2} and {4, 3} respectively, the wvw-side
    // number rounded up by 1), so the wiki's own precise number is used here rather than the
    // rounded stand-in.
    1292: { Immobile: 1.5 },
    2093: { Quickness: 2.5 },

    // Marching Orders (Warrior/Tactics trait 1480) and Feverish Pulse (Warrior/Bladesworn trait
    // 2369) — found alongside Banner of Tactics above, same Warrior leg. Both plain pve/wvw+pvp
    // splits with no `alt=` wording: Marching Orders' Might
    // (`{{trait fact|Might|15|stacks=3|game mode=pve}}{{trait fact|Might|6|stacks=3|game mode=pvp
    // wvw}}`) and Feverish Pulse's Quickness (`{{trait fact|quickness|2|game mode=pvp}}
    // {{trait fact|quickness|1|game mode=wvw}}`, an unusual pvp/wvw-only split with no separate pve
    // line — the wvw-tagged value used here per this app's WvW focus). This app's page for
    // "Marching Orders" is a naming collision with an unrelated story mission on the wiki — the
    // real trait page is titled "Marching Orders (trait)".
    1480: { Might: 6 },
    2369: { Quickness: 1 },

    // Guardian leg (5th leg of the BUFF_INSTANCE_LABELS sweep, 2026-08-14):
    // Permeating Wrath (622): wiki `{{skill fact|burning|2|game mode=pve pvp}}{{skill fact|burning|
    // 1.5|game mode=wvw}}` — the WvW value hits the documented "API rounds a half-second up" quirk
    // (1.5 -> 2), same shape as Panic Strike/Be Quick or Be Killed above. Raw local data actually
    // carries 3 identical Burning@2 facts, not the 2 the wiki's 2-value split would predict (1
    // unexplained extra duplicate) — doesn't matter for this override: `extractFromFacts` collapses
    // every fact sharing this status down to one row regardless of how many raw duplicates exist.
    622: { Burning: 1.5 },
    // Unrelenting Criticism (2075): wiki `{{skill fact|bleeding|4.5|game mode = pve}}{{skill fact|
    // bleeding|3|game mode = pvp wvw}}` — same rounding quirk (4.5 -> 5; the raw facts are {5, 3}).
    2075: { Bleeding: 3 },
    // Legendary Lore (2116): all 3 of its conflicts (Might/Regeneration/Protection, one per Tome)
    // turned out to be plain one-concept-per-status mode splits with `linked skill=` wiki text
    // (naming which Tome each grants from) rather than genuinely distinct simultaneous concepts —
    // Might (Tome of Justice, `{{skill fact|Might|...|10|stacks=2|game mode = pve}}{{skill fact|
    // Might|...|8|stacks=2|game mode = wvw pvp}}`), Regeneration (Tome of Resolve, pve=6/wvw=3/
    // pvp=4, 3-way) and Protection (Tome of Courage, pve=4/wvw=2/pvp=2.5 — the pvp value again hits
    // the rounding quirk, rounding to 3 in the raw facts, but the wvw value(2) is an exact match so
    // needs no special-casing here).
    2116: { Might: 8, Regeneration: 3, Protection: 2 },

    // Engineer leg (6th leg of the BUFF_INSTANCE_LABELS sweep, 2026-08-14):
    // Experimental Turrets (1678): its Flame-Turret-linked Might is a plain pve(10)/pvp+wvw(6) split,
    // no `alt=` (`{{skill fact|Might|linked skill=Flame Turret|10|stacks=3|game mode =pve}}
    // {{skill fact|Might|linked skill=Flame Turret|6|stacks=3|game mode = pvp wvw}}`) — its OTHER
    // Buff facts (Vigor/Swiftness/Fury/Resolution/Protection, each linked to a different turret) are
    // all single-instance, no conflict.
    1678: { Might: 6 },

    // Mesmer leg (8th leg of the BUFF_INSTANCE_LABELS sweep, 2026-08-14): Bountiful Disillusionment
    // (1687) — 3 of its 4 conflicting statuses are single-concept pve/wvw+pvp splits with no `alt=`
    // (each `linked skill=` names the one Shatter it rides on): Might (`{{skill fact|might|8|
    // stacks=5|linked skill=Mind Wrack|game mode=pve}}{{skill fact|might|6|stacks=3|linked
    // skill=Mind Wrack|game mode=wvw pvp}}`), Vigor (Cry of Frustration-linked, see the skill-side
    // entries above), Fury (Diversion-linked, see Deafening Drum above). Stability is NOT given an
    // override despite being an equally plain pve(5)/wvw+pvp(1) split
    // (`{{skill fact|stability|5|game mode=pve}}{{skill fact|stability|1|game mode=wvw pvp}}`, no
    // `alt=`): this trait ALSO grants a 2nd, genuinely additive Stability application (4s/3-stacks)
    // through 3 mutually-exclusive elite-spec-gated `linked skill=`s (Continuum Split/Crescendo/
    // Bladeturn Requiem) with NO `overrides` link of their own — collapsing the base pair here would
    // silently swallow that bonus too whenever one of those elite specs is active, the same
    // extractFromFacts-collapses-every-fact-sharing-a-status hazard as Toss Elixir H/Reconstruction
    // Field (Engineer leg) and Fox's Fury/Darkrazor's Daring (Revenant leg) — and BUFF_INSTANCE_LABELS
    // can't help either since the base pair's own page carries no `alt=` text to quote. Left open, a
    // new documented gap (elite-spec-additive-bonus blocks a would-be-safe override).
    1687: { Might: 6, Vigor: 5, Fury: 6 },
    // Mental Defense (2005): plain pve(4)/wvw(2.5) Resistance split, no `alt=`
    // (`{{skill fact|resistance|4|game mode=pve}}{{skill fact|resistance|2.5|game mode=wvw}}`) — the
    // wvw value hits the documented "API rounds a half-second duration up" quirk (2.5 -> 3).
    2005: { Resistance: 2.5 },
    // Nomad's Endurance (2069): plain pve(3)/pvp+wvw(1.5) Vigor split, no `alt=`, same rounding
    // quirk (1.5 -> 2).
    2069: { Vigor: 1.5 },
    // Renewing Oasis (2082): plain pve(4)/pvp+wvw(2.5) Regeneration split, no `alt=`, same rounding
    // quirk (2.5 -> 3).
    2082: { Regeneration: 2.5 },
    // Blinding Dissipation (1889): its Blinded pair is a plain pve(3)/pvp+wvw(1.5) split, no `alt=`,
    // same rounding quirk (1.5 -> 2) (`{{skill fact|blinded|3|game mode = pve}}{{skill fact|
    // blinded|1.5|game mode = pvp wvw}}`). Its OTHER conflict, a Ineptitude (trait 1950)-linked
    // Confusion pair, is NOT given an override: Ineptitude's own wiki page states pve=5/wvw+pvp=2
    // (and even documents its OWN unresolved in-game bug: "{{trait icon|Blinding Dissipation}} does
    // not show the correct duration in all game modes") but the locally-cached raw facts are {5, 3},
    // not {5, 2} — the wiki's wvw+pvp value doesn't appear among the raw data at all (same
    // "possible data drift" shape as Death Blossom/Spear of Justice's Crippled pair), so left open
    // rather than guessed.
    1889: { Blinded: 1.5 },

    // Elementalist leg (9th leg of the BUFF_INSTANCE_LABELS sweep, FINAL leg, 2026-08-14):
    // Inscription (229, Air Master): plain pve/wvw+pvp splits, no `alt=`, `linked skill=`-tagged
    // per attunement (`{{skill fact|linked skill=Fire Attunement|might|10|game mode = pve}}
    // {{skill fact|linked skill=Fire Attunement|might|6|stacks=3|game mode = pvp wvw}}` and
    // `{{skill fact|linked skill=Water Attunement|regeneration|10|game mode = pve}}
    // {{skill fact|linked skill=Water Attunement|regeneration|5|game mode = pvp wvw}}`) — mirrored
    // onto the Glyph skills that receive this trait's copy, see the `skill` block above.
    229: { Might: 6, Regeneration: 5 },
    // Elemental Attunement (264, Arcane): 2 independent single-concept pve/wvw+pvp splits, no
    // `alt=`, each `linked skill=`-tagged: Might (`{{skill fact|linked skill=Fire Attunement|
    // might|15|game mode = pve}}{{skill fact|linked skill=Fire Attunement|might|6|game mode = pvp
    // wvw}}`) and Protection (`{{skill fact|linked skill=Earth Attunement|protection|5|game mode =
    // pve}}{{skill fact|linked skill=Earth Attunement|protection|4|game mode = pvp wvw}}`). The
    // wiki also documents an unresolved in-game bug ("Grants 5 seconds of Protection in WvW and
    // PvP") where the nerf doesn't actually apply live — same as every other entry in this table,
    // the DOCUMENTED (intended) value is used, not the buggy live one.
    264: { Might: 6, Protection: 4 },
    // Elemental Shielding (289, Earth Adept): `{{skill fact|protection|3|game mode=pve wvw}}
    // {{skill fact|protection|2|game mode=pvp}}` — pve and wvw share one value (3), only pvp
    // differs (2, out of this app's scope); this override exists purely to collapse the pvp-only
    // 2nd raw fact into the correct single row, not to correct a number (same "value already
    // matches, purpose is dedup" shape as Elemental Shielding's own Hardy Conduit sibling below,
    // and Over Shield/Holo-Dancer Decoy above).
    289: { Protection: 3 },
    // Bountiful Power (1511, Arcane Grandmaster): plain pve(5)/wvw+pvp(3) Quickness split, no
    // `alt=` (`{{skill fact|Quickness|5|game mode=pve}}{{skill fact|Quickness|3|game mode=wvw
    // pvp}}`).
    1511: { Quickness: 3 },
    // Hardy Conduit (1948, Tempest Grandmaster): same pve+wvw(3)/pvp(2)-only-differs shape as
    // Elemental Shielding above (`{{skill fact|protection|3|game mode = pve wvw}}
    // {{skill fact|protection|2|game mode = pvp}}`), same dedup-only purpose.
    1948: { Protection: 3 },
    // Invigorating Torrents (2015, Tempest Master): a genuine 3-way pve(5)/pvp(3)/wvw(2) split for
    // BOTH Vigor and Regeneration, no `alt=` (`{{skill fact|vigor|5|game mode = pve}}
    // {{skill fact|vigor|3|game mode = pvp}}{{skill fact|vigor|2|game mode = wvw}}` and the
    // identically-shaped Regeneration line) — wvw value used per this app's WvW focus, same
    // "genuine 3-way split" shape as Echo of Truth (this file's own top comment).
    2015: { Vigor: 2, Regeneration: 2 },
    // Superior Elements (2177, Weaver Adept): plain pve(5)/wvw+pvp(2) Weakness split, no `alt=`
    // (`{{skill fact|weakness|5|game mode = pve}}{{skill fact|weakness|2|game mode = wvw pvp}}`).
    2177: { Weakness: 2 },
    // Altruistic Aspect (2415, Evoker Adept, "meditation skills grant boons to allies"): of its 2
    // conflicting statuses, only Might (Fox's Fury-linked) is a clean pve/wvw+pvp split with no
    // `alt=` (`{{skill fact|Might|10|stacks=3|linked skill=Fox's Fury|game mode = pve}}
    // {{skill fact|Might|8|stacks=3|linked skill=Fox's Fury|game mode = wvw pvp}}`); its Stability
    // pair (Toad's Fortitude-linked) is NOT given an override — the split only changes STACK COUNT
    // (3 -> 2, `{{skill fact|Stability|5|stacks=3|linked skill=Toad's Fortitude|game mode = pve}}
    // {{skill fact|Stability|5|stacks=2|linked skill=Toad's Fortitude|game mode = wvw pvp}}`), with
    // duration unchanged at 5s both modes — the same `apply_count` architecture limit as Icerazor's
    // Ire's Torment/Vulnerability (Revenant leg); left at the PvE stack count, documented gap. The
    // skill-side copy of this same Stability pair (Toad's Fortitude, 77247) is left open too, for
    // the same reason.
    2415: { Might: 8 },
    // Implacable Foe (2192, Harbinger Master) already auto-detects a Stability: 3 override here
    // from the wiki scan (its own 2 raw facts already contain both the pve(5) and wvw+pvp(3)
    // durations) — no manual entry needed for the trait's own tooltip. Mirrored onto Harbinger
    // Shroud's own synthetic copy of this fact in the `skill` block above instead (Necromancer leg,
    // trait-granted-boons-on-skills sweep, 2026-08-14) — see that entry's comment for the writeup.

    // Temporal Enchanter (1980, Chaos Master, Mesmer leg of the trait-granted-boons-on-skills sweep,
    // 2026-08-14): its Resistance pve(3)/wvw+pvp(2) split already auto-detects fine (unclear why —
    // same "not every case makes the automated candidate list" gap as Unrelenting Assault above), so
    // only Superspeed needed a manual entry here: plain pve(3)/wvw+pvp(2) split, no `alt=`
    // (`{{skill fact|effect|Superspeed|3|game mode = pve}}{{skill fact|effect|Superspeed|2|game mode
    // = wvw pvp}}`), both values already present verbatim among the trait's own raw facts.
    1980: { Superspeed: 2 },

    // Celestial Shadow (2053, Ranger/Druid Master, "grant superspeed and stealth when leaving
    // celestial avatar form", Ranger leg of the trait-granted-boons-on-skills sweep, 2026-08-14):
    // a genuine pve(3)/wvw+pvp(2) Stealth split the automated scan never resolved (its own 2 raw
    // Stealth facts already contain both values, same "not every case makes the automated
    // candidate list" gap as Unrelenting Assault/Temporal Enchanter above) — wiki-confirmed via
    // `{{skill fact|stealth|3|game mode = pve}}{{skill fact|stealth|2|game mode = pvp wvw}}`.
    // Superspeed is unsplit (`{{skill fact|effect|Superspeed|3}}`, one template, no split).
    // Mirrored onto Release Celestial Avatar's own synthetic copy of this fact in the `skill`
    // block above.
    2053: { Stealth: 2 },

    // Revenant leg (7th leg of the trait-granted-boons-on-skills sweep, 2026-08-14): 3 traits
    // whose own raw API facts carry only the PvE value (no auto-detectable duplicate), same
    // "not every case makes the automated candidate list" gap as Temporal Enchanter/Celestial
    // Shadow above — all 3 confirmed via a direct wiki fetch and mirrored onto their triggering
    // skill(s) in the `skill` block above so both tooltips agree.
    // Spiritual Reckoning ("gain resolution when you invoke a legend"): pve(6)/wvw+pvp(3).
    1810: { Resolution: 3 },
    // Ashen Demeanor ("gain might, resistance, and Kalla's Fervor when you use a healing skill"):
    // Resistance pve(6)/wvw+pvp(4); Might (6s/5 stacks) is flat.
    2166: { Resistance: 4 },
    // Spirit Boon ("invoking a legend grants boons to nearby allies based on the legend that was
    // invoked"): Might (Legendary Assassin Stance) pve(10)/wvw+pvp(6), both 2 stacks; Protection
    // (Legendary Dragon Stance) pve(3)/wvw+pvp(2). Its Resistance/Stability/Regeneration/
    // Resolution/Vigor lines (Demon/Dwarf/Centaur/Renegade/Alliance) are all flat.
    1774: { Might: 6, Protection: 2 },

    // Follow-up fix (2026-08-14) to 2 of the 3 "mode-dependent DIFFERENT-boon swap" traits left open
    // by the trait-granted-boons-on-skills sweep (Ranger/Mesmer legs) — re-examined after the sweep
    // closed and found BOTH fit the existing single-value-per-status override shape after all, no new
    // mechanism needed; only Seize the Moment (2022, still open, see its own comment above in the
    // BUFF_INSTANCE_LABELS block) genuinely needs one, since it splits 2 *different* concepts
    // ("per Clone" / base) under the one "Quickness" status at once, which this override can't hold.
    //
    // Grace of the Land (2001, Ranger/Druid, "grant boons to allies within the radius of your
    // Celestial Avatar skills"): wiki confirms pve grants 1 stack Alacrity, wvw grants Might (4s,
    // 2 stacks), pvp grants Might (6s, 2 stacks) — the automated scan already found+omitted the
    // pve-only Alacrity concept, but left both raw Might facts (4s and 6s, both apply_count 2)
    // un-deduped since neither is individually PvE-only, so the trait tooltip today shows Might
    // twice at once (both durations) instead of picking the wvw one. This override collapses that
    // down to a single wvw-correct row, same "first-encountered fact wins, extras suppressed" dedup
    // every other single-concept trait/skill override in this file already relies on.
    2001: { Might: 4 },

    // Stretched Time (1942, Mesmer/Chaos, "nearby allies gain boons for each clone you shatter /
    // when you summon a phantasm"): per its own decoded wiki breakdown in the BUFF_INSTANCE_LABELS
    // block above, BOTH its Alacrity concepts ("per Clone" pve+pvp only, "on Phantasm Spawn" pve/pvp
    // only) have no wvw value at all — only its 2 Might concepts are wvw-tagged. The automated scan
    // never flagged this (no single Alacrity fact is a plain pve-vs-wvw+pvp duration split, so its
    // pattern-match missed it), so today's trait tooltip incorrectly shows both Alacrity rows
    // alongside the correct Might rows in a wvw-focused view. Omitting the whole "Alacrity" status
    // is safe here since neither of its 2 concepts has any wvw application to preserve — the 2 Might
    // rows stay distinct via their own already-curated BUFF_INSTANCE_LABELS entries, no override
    // needed on that status.
    1942: { Alacrity: 'omit' },

    // Liberating Liaise (2357, Paragon/Motivation Adept, "Chant of Freedom grants superspeed to
    // affected allies when activated") — found 2026-08-15 while investigating TODO.md's
    // `MISCELLANEOUS_MATCHERS` WvW-override gap (Superspeed isn't a `classifyBoonCondition` status,
    // so it never reached this table until `namedFactsFrom` itself gained an override lookup). Its
    // own 2 raw Buff facts already contain both values verbatim, same "not every case makes the
    // automated candidate list" gap as Temporal Enchanter/Celestial Shadow above — plain
    // pve(3)/wvw+pvp(2) split, no `alt=` (`{{skill fact|effect|Superspeed|3|game mode = pve}}
    // {{skill fact|effect|Superspeed|2|game mode = wvw pvp}}`).
    2357: { Superspeed: 2 },

    // Elevated Compassion (1746, Revenant/Herald Grandmaster, "grant boons to allies when your
    // upkeep cost is equal to or higher than the threshold") — flagged 2026-08-19 by the user
    // ("displaying quickness when they removed that from wvw"). The wiki's raw wikitext (re-fetched
    // 2026-08-19) grants Quickness on a `game mode=pve` line and Vigor on a separate `game mode=wvw
    // pvp` line — two entirely DIFFERENT statuses per mode, not a duration split of the same one, so
    // this isn't the "automated scan missed a duration split" shape every entry above is; it never
    // had a chance to be found since the scanner only pattern-matches same-status duration pairs.
    // The live API's own facts carry both Quickness and Vigor unconditionally (both duration=1,
    // apply_count=1) with no mode tag at all — omitting Quickness here leaves Vigor (already correct
    // for wvw+pvp, no override needed on that status) as the only boon this trait's wvw-focused
    // tooltip shows, same "no wvw application to preserve" reasoning as Stretched Time's Alacrity
    // omit above.
    1746: { Quickness: 'omit' },

    // Revenant Conduit leg (2026-08-20) — the 4-trait gap the 8th/final leg of the
    // NUMERIC_FACT_WVW_OVERRIDES sweep left open (`fact-numbers.ts`'s Conduit block). All 4 are
    // PrefixedBuff-typed legend-boon grants (`linked skill=` on the wiki), same "not on this
    // script's own automated candidate list" shape as most of this table's entries above
    // (`collectCandidates` only ever considers plain `Buff`-typed facts, never `PrefixedBuff`) — a
    // full `npm run fetch-wvw-splits` re-run does NOT pick these up either (confirmed by actually
    // running it: re-verified via a live re-run 2026-08-20, output diffed against HEAD and reverted
    // — the wiki's own live content has drifted enough since the last regen, in ~250 unrelated
    // facts across 81 skill ids, that a full re-run isn't safe to commit wholesale right now; a
    // dedicated future session should re-verify each drifted entry individually rather than trust a
    // blind diff). Investigated by hand instead, same wiki-raw-wikitext method as every other entry.
    //
    // Numinous Gift (2440, Grandmaster minor — the passive per-legend boon each Cosmic Wisdom
    // trigger grants): every one of its 6 facts (Fury/Assassin, Resistance/Demon, Stability/Dwarf,
    // Protection/Centaur, Quickness/Entity, flat Might) is EITHER unsplit or has identical pve/wvw
    // values (Fury: pve=10, wvw=10; the Dwarf slot's only real mode difference is PvP swapping
    // Stability for Resolution, which this app doesn't model) — genuinely needs no override at all,
    // not added here.
    //
    // Bolstered Bonds (2331, Master minor — per-legend attribute bonus) is NOT actually this
    // mechanism's concern despite `fact-numbers.ts`'s Conduit-leg comment lumping it in: its "Buff"
    // facts all carry legend NAMES as `status` ("Legendary Assassin Stance", etc.), not real
    // boon/condition names, so `NAME_BY_LOWER`/`classifyBoonCondition` never recognizes them as
    // boons at all — this app doesn't render this trait's attribute bonus through the boon/condition
    // pipeline in the first place, so there's no WvW-override row to fix here. Its real pve/wvw
    // split (a genuine, patch-history-documented nerf: 150/150 pve -> 75/75 wvw+pvp per specific
    // stance, 75 pve -> 50 wvw+pvp all-attribute for Entity) would need its own attribute-bonus-table
    // fix (`new_attribute_bonus_infra`-shaped, not this file) if this trait's stats are meant to be
    // modeled at all — separate, larger gap, not attempted here.
    //
    // Found Purpose (2352, Grandmaster major — "trigger Numinous Gift's active portion, granting
    // boons to nearby allies"): 4 of its 6 per-legend grants are clean single-concept pve/wvw+pvp
    // splits, no `alt=` (`{{skill fact|Fury|linked skill=Legendary Assassin Stance|10|25|game
    // mode=pve}}{{skill fact|Fury|...|5|game mode=wvw pvp}}` and the same shape for
    // Resistance/Demon(5->2), Stability/Dwarf(5->2), Protection/Centaur(5->2)). Dwarf's other line
    // (`{{skill fact|resolution|linked skill=Legendary Dwarf Stance|2|game mode=pvp}}`) is PvP-only
    // (WvW keeps Stability, never gets Resolution) — 'omit', same "pvp-only tagged line" convention
    // as Elevated Compassion above. Entity's slot is a genuine BOON SWAP by mode, not a duration
    // split (`{{skill fact|Quickness|linked skill=Legendary Entity Stance|5|game mode=pve}}
    // {{skill fact|Might|linked skill=Legendary Entity Stance|stacks=3|5|game mode=pvp wvw}}` — PvE
    // gets Quickness, WvW+PvP get Might instead) — Quickness omitted (WvW never gets it, same
    // "pve-only tagged line, no wvw counterpart" convention as the pveLines=1/wvwLines=0 automated
    // case); the replacement Might can't be expressed by this override mechanism (which only ever
    // changes a status's duration, never swaps which status appears) so it's left showing
    // unconditionally as its own row, already correct since it has no separate PvE value of its own.
    // The base unconditional Might fact (stacks 5/10s pve, would-be stacks 3/5s wvw+pvp) is
    // deliberately NOT overridden: this trait's raw API data carries 3 separate "Might" facts (base
    // pve, base wvw+pvp duplicate, AND the Entity-swap-in above) sharing one status with no
    // discriminator — same "extractFromFacts collapses EVERY fact sharing a status once any override
    // exists" hazard as Fox's Fury/Darkrazor's Daring, and here it's worse since 2 of the 3 are
    // genuinely different concepts (base vs. Entity-conditional) — left as a documented gap, not
    // modeled wrong.
    2352: { Fury: 5, Resistance: 2, Stability: 2, Resolution: 'omit', Protection: 2, Quickness: 'omit' },
    //
    // Shared Wisdom (2355, Adept major — "grant boons to allies whenever you use a Legendary Entity
    // Skill, depending on which skill was used"): all 5 of its per-skill grants are clean, single-
    // fact splits, no `alt=`, no raw-fact duplication (unlike Found Purpose above, each status here
    // has exactly one raw API fact) — Protection/Shielding Hands (3->2), Fury/Beguiling Haze (5->3),
    // Stability/Gladiator's Defense (3->2), Resolution/Hex-Eater Vortex (3->2), and Might/Twin Moon
    // Sweep (duration 10->6; its stack count ALSO drops 5->3 on the wiki, but `WvwFactOverride` only
    // ever touches duration, never `apply_count` — same "override the expressible half, leave the
    // rest a documented gap" shape as Icerazor's Ire/Razorclaw's Rage above, stacks stay at 5).
    2355: { Protection: 2, Fury: 3, Stability: 2, Resolution: 2, Might: 6 },

    // Guardian — 1st leg of the "remaining 8 professions" main sweep (TODO.md, 2026-08-20).
    // Resolute Subconscious (625, Virtues Adept): the wiki shows a single, unsplit `{{skill
    // fact|resolution|3}}` for this trait's Resolution grant, but the live API carries 2 raw
    // Resolution facts both showing the same duration (3, 3) — a genuinely-identical duplicate, not
    // a real pve/wvw split, same "value already matches, purpose is dedup" shape as Holo-Dancer
    // Decoy/Over Shield above. Without this entry `extractFromFacts` would show the row twice.
    625: { Resolution: 3 },

    // Warrior — 2nd leg of the same main sweep (2026-08-20). Sundering Burst (1316, Arms Major 2,
    // "critical hits apply vulnerability"): the wiki carries 2 concepts sharing this status (a plain
    // application plus an `alt=Critical Vulnerability` one), each independently split pve(8)/wvw+pvp
    // (6) — but the raw API carries 4 raw Vulnerability facts with IDENTICAL text/description/
    // apply_count on all 4 (no discriminator between the 2 concepts at all), so a single override
    // collapsing every one of them down to 6 is safe: both concepts share the exact same split, so
    // there's no risk of silently dropping a genuinely different value the way Fox's Fury/Darkrazor's
    // Daring's overrides would (see this file's own top comment on that hazard) — same "collapse
    // is safe because every concept sharing the status also shares the value" shape as Resolute
    // Subconscious just above.
    1316: { Vulnerability: 6 }
  }
}

function applyManualOverrides(result: WvwFactOverrides, log: string[]): void {
  for (const kind of ['skill', 'trait'] as const) {
    for (const [idStr, overrides] of Object.entries(MANUAL_OVERRIDES[kind])) {
      const id = Number(idStr)
      const existing = result[kind][id] ?? {}
      for (const [boonName, value] of Object.entries(overrides)) {
        if (existing[boonName] !== undefined && existing[boonName] !== value) {
          log.push(`manual override REPLACES automated result: ${kind} ${id} / ${boonName} — automated=${existing[boonName]}, manual=${value}`)
        }
        existing[boonName] = value
      }
      result[kind][id] = existing
    }
  }
}

async function main(): Promise<void> {
  const skills = JSON.parse(await readFile(join(DATA_DIR, 'skills.json'), 'utf-8')) as Skill[]
  const traits = JSON.parse(await readFile(join(DATA_DIR, 'traits.json'), 'utf-8')) as Trait[]

  const skillsByName = collectCandidates(skills, 'skill')
  const traitsByName = collectCandidates(traits, 'trait')

  console.log('Fetching Category:Split skills / Category:Split traits member lists...')
  const [splitSkillTitles, splitTraitTitles] = await Promise.all([
    fetchCategoryMembers('Category:Split skills'),
    fetchCategoryMembers('Category:Split traits')
  ])
  console.log(`  Split skills: ${splitSkillTitles.size}, split traits: ${splitTraitTitles.size}`)

  function inSplitCategory(name: string, titles: Set<string>): boolean {
    return titleVariants(name).some((v) => titles.has(v))
  }

  const skillPages = [...skillsByName.keys()].filter((n) => inSplitCategory(n, splitSkillTitles))
  const traitPages = [...traitsByName.keys()].filter((n) => inSplitCategory(n, splitTraitTitles))
  const skippedAmbiguousName: string[] = []
  for (const [name, list] of skillsByName) {
    if (list.length > 1 && inSplitCategory(name, splitSkillTitles)) {
      skippedAmbiguousName.push(`skill "${name}" -> ids [${list.map((c) => c.id).join(', ')}]`)
    }
  }
  for (const [name, list] of traitsByName) {
    if (list.length > 1 && inSplitCategory(name, splitTraitTitles)) {
      skippedAmbiguousName.push(`trait "${name}" -> ids [${list.map((c) => c.id).join(', ')}]`)
    }
  }

  console.log(
    `Candidate pages to fetch: ${skillPages.length} skills + ${traitPages.length} traits` +
      ` (${skippedAmbiguousName.length} excluded — name maps to multiple ids)`
  )

  const result: WvwFactOverrides = { skill: {}, trait: {} }
  const log: string[] = []
  let fetched = 0
  const totalPages = skillPages.length + traitPages.length

  async function processPage(name: string, byName: Map<string, CandidateObject[]>, bucket: Record<number, Record<string, WvwFactOverride>>) {
    const candidates = byName.get(name)
    if (!candidates || candidates.length !== 1) return // ambiguous name, already logged above
    const candidate = candidates[0]

    let wikitext: string | null
    try {
      wikitext = await fetchWikiPage(name)
    } catch (err) {
      log.push(`skip (fetch error): ${candidate.kind} ${candidate.id} "${name}" — ${(err as Error).message}`)
      return
    }
    if (wikitext === null) {
      log.push(`skip (page not found): ${candidate.kind} ${candidate.id} "${name}"`)
      return
    }

    const lines = parseFactLines(wikitext)
    const linesByBoon = new Map<string, ParsedFactLine[]>()
    for (const line of lines) {
      const list = linesByBoon.get(line.name) ?? []
      list.push(line)
      linesByBoon.set(line.name, list)
    }

    const overrides: Record<string, WvwFactOverride> = {}
    for (const boonName of candidate.statusCounts.keys()) {
      const boonLines = linesByBoon.get(boonName)
      if (!boonLines) continue
      const override = resolveOverride(boonName, boonLines, candidate, name, log)
      if (override !== undefined) overrides[boonName] = override
    }

    if (Object.keys(overrides).length > 0) bucket[candidate.id] = overrides
  }

  for (const name of skillPages) {
    await processPage(name, skillsByName, result.skill)
    fetched++
    if (fetched % 50 === 0) console.log(`  [${fetched}/${totalPages}] pages fetched...`)
  }
  for (const name of traitPages) {
    await processPage(name, traitsByName, result.trait)
    fetched++
    if (fetched % 50 === 0) console.log(`  [${fetched}/${totalPages}] pages fetched...`)
  }

  applyManualOverrides(result, log)
  await flushWikiCache()

  await writeFile(join(DATA_DIR, 'wvw-fact-overrides.json'), JSON.stringify(result, null, 2))

  const skillOverrideCount = Object.keys(result.skill).length
  const traitOverrideCount = Object.keys(result.trait).length
  console.log(
    `\nDone. WvW overrides written for ${skillOverrideCount} skills + ${traitOverrideCount} traits` +
      ` to wvw-fact-overrides.json.`
  )
  console.log(`\n${log.length} lines skipped (ambiguous/unvalidated) — see below:`)
  for (const line of log) console.warn(`  - ${line}`)
  if (skippedAmbiguousName.length > 0) {
    console.warn(`\n${skippedAmbiguousName.length} pages excluded outright (name maps to multiple ids):`)
    for (const line of skippedAmbiguousName) console.warn(`  - ${line}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
