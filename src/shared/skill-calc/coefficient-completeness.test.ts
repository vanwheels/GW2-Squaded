import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Fact } from '../types';
import { CURATED_HEALING_COEFFICIENTS, CURATED_TRAIT_HEALING_COEFFICIENTS } from './healing-calc';
import { CURATED_BARRIER_COEFFICIENTS } from './barrier-calc';
import { CURATED_SIPHON_DAMAGE_COEFFICIENTS } from './siphon-damage-calc';

/**
 * Coefficient-table completeness scan — mirrors `gear-calc/trait-attribute-completeness.test.ts`'s
 * shape (candidate predicate -> COVERED_IDS union -> EXCLUDED_IDS map with stated reasons) for
 * `CURATED_HEALING_COEFFICIENTS`/`CURATED_BARRIER_COEFFICIENTS`/`CURATED_TRAIT_HEALING_COEFFICIENTS`/
 * `CURATED_SIPHON_DAMAGE_COEFFICIENTS`. Scoped to these 4 tables only — `CURATED_DAMAGE_COEFFICIENTS`
 * is deferred to its own leg: a first pass found its candidate predicate (`fact.type === 'Damage'`)
 * matches 1,666 skills against only 931 curated, and most of the 745 "uncovered" hits are weapon-skill
 * chain continuations, duplicate weapon-tier ids, and NPC/pet skills rather than real misses — needs
 * a dedicated equippable-id filter (cross-referencing `professions.json`) before the predicate is even
 * meaningful, which is new infra beyond this leg's scope. See TODO.md.
 *
 * Both `CURATED_HEALING_COEFFICIENTS` and `CURATED_BARRIER_COEFFICIENTS` are scanned as one candidate
 * pool: the GW2 API mislabels every Barrier `AttributeAdjust` fact's `target` as `'Healing'` too (see
 * `barrier-calc.ts`'s own header comment), so a candidate is "covered" if it's in *either* table.
 *
 * No trait-keyed counterpart to `CURATED_BARRIER_COEFFICIENTS` or `CURATED_SIPHON_DAMAGE_COEFFICIENTS`
 * exists at all — `trait-fact-lines.ts` only ever calls `healingLinesForTrait`. Every Barrier- or
 * Siphon-shaped fact found on a trait is therefore either an already-categorized character-stat/
 * proc-coefficient trait (see `SIBLING_PROC_SHAPE`/`FLAT_STAT_ELSEWHERE` below) or a genuine new
 * candidate deferred to TODO.md — never something this leg builds a table for.
 *
 * Built 2026-10-19 by running exactly this scan: 139 skill-side Healing/Barrier candidates (90
 * already covered), 6 skill-side Siphon candidates, 105 trait-side Healing candidates (1 already
 * covered, Healing Ripple #351), 31 trait-side Siphon candidates. Every uncovered hit got a decision:
 * - `KNOWN_EXCEPTION` / `DOCUMENTED_TRAIT_PROC`: already investigated and excluded elsewhere
 *   (TODO.md's Known Exceptions section, or `barrier-calc.ts`'s own header comment).
 * - `DOWNED` / `PET`: structurally unreachable — this app has no downed-skill concept at all (see
 *   `boon-calc/sources.ts`'s own precedent) and no pet-skill tooltip rendering (`PetsEditor.tsx`
 *   never calls `skillFactLines`).
 * - `WEAPON_CHAIN_OR_DUPLICATE` / `MECHANIC_CHAIN_OR_DUPLICATE`: not the id `professions.json` lists
 *   for that weapon/profession-mechanic slot — a chain continuation or duplicate weapon-tier id, same
 *   shape as `damage-calc.ts`'s documented Eviscerate/Kill Shot/Earthshaker duplicates.
 * - `FLAT_STAT_ELSEWHERE`: a flat attribute-stat grant already covered by `trait-attributes.ts`/
 *   `combat-state.ts` — `target: 'Power'`/`'Healing'` alone over-matches ordinary stat facts
 *   (confirmed per-id via grep, e.g. Dagger Training/Staff Master/Revealed Training).
 * - `SIBLING_PROC_SHAPE`: a heal/barrier/siphon-on-X proc coefficient already categorized by
 *   `trait-attribute-completeness.test.ts`'s `EXCLUDED_TRAIT_IDS` for the character-stat test — no
 *   trait-keyed coefficient table of this shape exists beyond the single Healing Ripple entry.
 * - `NEW_CONTENT_SKILL` / `NEW_CONTENT_TRAIT`: genuine, real coefficient gaps outside the original
 *   sweeps' scope — deferred to TODO.md's [Healing/Barrier/Siphon Coefficient Sweep Refresh] and
 *   [Trait-Side Heal/Barrier/Siphon Proc Tooltip Coverage] items rather than wiki-verified inline,
 *   per this project's own rule to keep curation queues separate from infra work.
 */

interface SkillDataFile {
  id: number;
  name: string;
  facts: Fact[];
  traitedFacts: Fact[];
}
interface TraitDataFile {
  id: number;
  name: string;
  facts: Fact[];
  traitedFacts: Fact[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const skills: SkillDataFile[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../data/game-data/skills.json'), 'utf-8'),
);
const traits: TraitDataFile[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'),
);

const isHealingOrBarrierFact = (f: Fact): boolean =>
  f.type === 'AttributeAdjust' && f.target === 'Healing';
const isSiphonDamageFact = (f: Fact): boolean =>
  f.type === 'AttributeAdjust' && f.target === 'Power';

function touches(
  entity: { facts: Fact[]; traitedFacts: Fact[] },
  pred: (f: Fact) => boolean,
): boolean {
  return entity.facts.some(pred) || entity.traitedFacts.some(pred);
}

/** Builds an `EXCLUDED_IDS`-shaped map from a reason string shared by every id in the bucket — same
 *  "one reason, many ids" pattern `trait-attribute-completeness.test.ts`'s own exclusion buckets use. */
function bucket(ids: number[], reason: string): Record<number, string> {
  return Object.fromEntries(ids.map((id) => [id, reason]));
}

const REASON_KNOWN_EXCEPTION =
  "Already a TODO.md Known Exception (re-confirmed closed, no code change needed) — see TODO.md's Known Exceptions section.";
const REASON_DOCUMENTED_TRAIT_PROC =
  "Already named in `barrier-calc.ts`'s own header comment as one of the 4 genuine trait-proc exclusions (never independently bound to a skill slot).";
const REASON_DOWNED =
  "Downed-state skill (`slot` starts with `Downed_`) — this app's `Build` type has no downed-skill concept at all (see `boon-calc/sources.ts`'s own precedent excluding Plague Blast/Dhuumfire/Life Reap/Holo Leap/Corona Burst for the same reason).";
const REASON_PET =
  "Pet skill — `PetsEditor.tsx` never calls `skillFactLines`, so no pet skill's Damage/Healing/Barrier facts are rendered anywhere in this app, same 'not modeled for pets' shape as `trait-attribute-completeness.test.ts`'s pet-stat exclusions.";
const REASON_ORPHAN =
  "`professions: []` — an orphaned/unreachable API id with no equippable skill slot anywhere in this app's data, same shape as this file's other orphan exclusions.";
const REASON_WEAPON_CHAIN_OR_DUPLICATE =
  "Not the id listed for its weapon's slot in `professions.json` — a weapon-skill chain continuation or duplicate weapon-tier id (same shape as `damage-calc.ts`'s documented Eviscerate/Kill Shot/Earthshaker duplicate-tier ids), not independently equippable.";
const REASON_MECHANIC_CHAIN_OR_DUPLICATE =
  "Not the id listed in `professions.json`'s `professionSkills` for this profession — a profession-mechanic duplicate/chain id, not independently equippable.";
const REASON_NEW_CONTENT_SKILL =
  "Equippable skill with a real, uncurated coefficient — found by this leg's scan, outside the original Healing/Barrier/Siphon sweeps' scope (newer content). Deferred to TODO.md's [Healing/Barrier/Siphon Coefficient Sweep Refresh] item rather than wiki-verified inline.";
const REASON_SIBLING_PROC_SHAPE =
  "Heal/Barrier/Siphon-on-X proc coefficient, same shape `trait-attribute-completeness.test.ts`'s EXCLUDED_TRAIT_IDS already categorizes for the character-stat test — no trait-keyed coefficient table covers this shape beyond `CURATED_TRAIT_HEALING_COEFFICIENTS`'s single Healing Ripple entry (#351).";
const REASON_FLAT_STAT_ELSEWHERE =
  "Flat attribute-stat grant already covered by `trait-attributes.ts`/`combat-state.ts` (see `trait-attribute-completeness.test.ts`) — `target: 'Power'`/`'Healing'` alone over-matches ordinary stat facts; not a Healing/Siphon-Damage coefficient fact.";
const REASON_NEW_CONTENT_TRAIT =
  "Heal/Barrier/Siphon-on-X proc coefficient, newer than both this table and `trait-attribute-completeness.test.ts`'s own sweep — no live-scaled trait tooltip number exists for this shape yet. Deferred to TODO.md's [Trait-Side Heal/Barrier/Siphon Proc Tooltip Coverage] item.";

// --- Healing/Barrier skill pool ---

const HEALING_BARRIER_SKILL_COVERED_IDS = new Set<number>([
  ...Object.keys(CURATED_HEALING_COEFFICIENTS).map(Number),
  ...Object.keys(CURATED_BARRIER_COEFFICIENTS).map(Number),
]);

const HEALING_BARRIER_SKILL_EXCLUDED_IDS: Record<number, string> = {
  ...bucket(
    [1125, 5782, 5793, 12375, 13688, 13849, 30142, 31776, 46847, 69169, 76506, 77164, 77333, 77357],
    REASON_ORPHAN,
  ),
  ...bucket(
    [
      5595, 5937, 6046, 6102, 6104, 9120, 12377, 12465, 14528, 15072, 29082, 29114, 29591, 29716,
      29772, 30032, 30521, 30588, 41537, 43136, 43701, 44617, 44626, 44646, 44885, 46600, 46750,
      49082, 51713, 58090, 62603, 69244, 71875, 71922, 71932, 71950, 72029, 72089, 76552, 76601,
      76642, 76651, 76702, 76811, 76960, 77077, 77306, 78895, 80203, 80252, 80985,
    ],
    REASON_NEW_CONTENT_SKILL,
  ),
  ...bucket([9095, 9210, 10560, 10594, 10643, 30504], REASON_DOWNED),
  ...bucket(
    [
      9108, 9224, 29002, 31318, 31406, 31796, 31894, 32242, 32253, 32364, 33387, 43199, 45983,
      50392, 50399, 51646, 63107, 63160, 63167, 63227, 63249, 63362, 69175, 71791, 71800, 71850,
      71867, 71871, 71974, 72049, 72051, 72076, 72079, 73063, 73105, 73108, 73140, 76572, 76982,
      77136, 78730,
    ],
    REASON_WEAPON_CHAIN_OR_DUPLICATE,
  ),
  ...bucket(
    [
      9250, 30083, 30225, 30286, 30783, 40903, 62528, 62552, 62618, 62635, 76935, 80221, 80248,
      80263,
    ],
    REASON_MECHANIC_CHAIN_OR_DUPLICATE,
  ),
  ...bucket([10547, 10632, 10670, 31295, 71802, 72369, 76497], REASON_KNOWN_EXCEPTION),
  ...bucket([12717, 79766], REASON_PET),
  ...bucket([29812, 42913, 46843, 62689], REASON_DOCUMENTED_TRAIT_PROC),
};

// --- Siphon-damage skill pool ---

const SIPHON_SKILL_COVERED_IDS = new Set<number>(
  Object.keys(CURATED_SIPHON_DAMAGE_COEFFICIENTS).map(Number),
);

const SIPHON_SKILL_EXCLUDED_IDS: Record<number, string> = {
  ...bucket([10632, 12424, 55050, 72369, 76497], REASON_KNOWN_EXCEPTION),
  ...bucket([80985], REASON_NEW_CONTENT_SKILL),
};

// --- Healing trait pool (Barrier/Siphon have no trait-keyed table at all, see file header) ---

const HEALING_TRAIT_COVERED_IDS = new Set<number>(
  Object.keys(CURATED_TRAIT_HEALING_COEFFICIENTS).map(Number),
);

const HEALING_TRAIT_EXCLUDED_IDS: Record<number, string> = {
  ...bucket(
    [
      279, 349, 549, 551, 558, 585, 586, 587, 628, 738, 778, 783, 788, 789, 909, 964, 1054, 1060,
      1072, 1089, 1130, 1160, 1238, 1276, 1294, 1297, 1300, 1375, 1454, 1474, 1479, 1480, 1481,
      1487, 1697, 1705, 1707, 1720, 1743, 1755, 1760, 1784, 1815, 1816, 1817, 1819, 1834, 1844,
      1854, 1862, 1866, 1876, 1908, 1915, 1932, 1971, 1974, 1981, 1986, 1987, 2002, 2016, 2023,
      2057, 2059, 2080, 2135, 2152, 2155, 2161, 2168, 2180, 2182, 2253, 2254, 2277, 2280, 2281,
      2285, 2290, 2300, 2326, 2337, 2354, 2358, 2362, 2378, 2395, 2426,
    ],
    REASON_SIBLING_PROC_SHAPE,
  ),
  ...bucket(
    [413, 1470, 1746, 1931, 1944, 2077, 2186, 2187, 2228, 2286, 2389],
    REASON_NEW_CONTENT_TRAIT,
  ),
  ...bucket([519, 1821, 2148, 2229], REASON_FLAT_STAT_ELSEWHERE),
};

// --- Siphon-damage trait pool (no CURATED_TRAIT_SIPHON_DAMAGE_COEFFICIENTS table exists) ---

const SIPHON_TRAIT_COVERED_IDS = new Set<number>();

const SIPHON_TRAIT_EXCLUDED_IDS: Record<number, string> = {
  ...bucket(
    [
      320, 334, 519, 566, 653, 855, 915, 1192, 1245, 1338, 1453, 1700, 1704, 1849, 1884, 2046, 2093,
      2190, 2229,
    ],
    REASON_FLAT_STAT_ELSEWHERE,
  ),
  ...bucket(
    [783, 788, 909, 1130, 1300, 1705, 1755, 1844, 1974, 2161, 2290],
    REASON_SIBLING_PROC_SHAPE,
  ),
  ...bucket([2286], REASON_NEW_CONTENT_TRAIT),
};

function runCompletenessChecks(
  label: string,
  entities: { id: number; name: string; facts: Fact[]; traitedFacts: Fact[] }[],
  predicate: (f: Fact) => boolean,
  coveredIds: ReadonlySet<number>,
  excludedIds: Record<number, string>,
) {
  describe(label, () => {
    it('accounts for every candidate in the curated table(s) or the exclusion list', () => {
      const uncovered: string[] = [];
      for (const e of entities) {
        if (!touches(e, predicate)) continue;
        if (coveredIds.has(e.id)) continue;
        if (e.id in excludedIds) continue;
        uncovered.push(`${e.id} (${e.name})`);
      }
      expect(
        uncovered,
        "New/previously-missed candidate(s) — add to the curated table, or to this file's exclusion map with a reason.",
      ).toEqual([]);
    });

    it('has no exclusion entry for an id that is already curated (redundant)', () => {
      const redundant = Object.keys(excludedIds)
        .map(Number)
        .filter((id) => coveredIds.has(id));
      expect(
        redundant,
        'Id(s) covered by the curated table AND listed in the exclusion map — remove the now-redundant entry.',
      ).toEqual([]);
    });

    it('has no exclusion entry for an id that no longer exists or no longer carries the qualifying fact (stale)', () => {
      const byId = new Map(entities.map((e) => [e.id, e]));
      const stale = Object.keys(excludedIds)
        .map(Number)
        .filter((id) => {
          const e = byId.get(id);
          return !e || !touches(e, predicate);
        });
      expect(
        stale,
        'Id(s) in the exclusion map that no longer exist or no longer carry the qualifying fact — a balance patch likely reworked them; remove the stale entry.',
      ).toEqual([]);
    });
  });
}

runCompletenessChecks(
  'Healing/Barrier skill coefficient completeness',
  skills,
  isHealingOrBarrierFact,
  HEALING_BARRIER_SKILL_COVERED_IDS,
  HEALING_BARRIER_SKILL_EXCLUDED_IDS,
);

runCompletenessChecks(
  'Siphon-damage skill coefficient completeness',
  skills,
  isSiphonDamageFact,
  SIPHON_SKILL_COVERED_IDS,
  SIPHON_SKILL_EXCLUDED_IDS,
);

runCompletenessChecks(
  'Healing trait coefficient completeness',
  traits,
  isHealingOrBarrierFact,
  HEALING_TRAIT_COVERED_IDS,
  HEALING_TRAIT_EXCLUDED_IDS,
);

runCompletenessChecks(
  'Siphon-damage trait coefficient completeness',
  traits,
  isSiphonDamageFact,
  SIPHON_TRAIT_COVERED_IDS,
  SIPHON_TRAIT_EXCLUDED_IDS,
);
