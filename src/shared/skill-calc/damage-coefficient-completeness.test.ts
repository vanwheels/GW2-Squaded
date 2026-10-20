import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Fact } from '../types';
import { CURATED_DAMAGE_COEFFICIENTS } from './damage-calc';

/**
 * Coefficient-table completeness scan for `CURATED_DAMAGE_COEFFICIENTS` — deferred out of
 * `coefficient-completeness.test.ts` (see that file's own header and TODO.md's Leg 2) because the
 * naive `fact.type === 'Damage'` predicate alone matches 1,666 skills, most of which are weapon-
 * skill chain continuations, duplicate weapon-tier ids, or structurally-unreachable orphans rather
 * than real misses. This file builds the "reachable/equippable id" filter Leg 2 needed before that
 * predicate became meaningful, instead of a shared runtime module — every other completeness test
 * in this directory reads `data/game-data/*.json` directly and self-contains its own candidate
 * logic (see `coefficient-completeness.test.ts`/`trait-attribute-completeness.test.ts`), and this
 * filter has no other caller, so it follows that same pattern rather than becoming new `src/shared`
 * runtime code with no actual runtime consumer.
 *
 * **The reachable-id filter**: a skill id is a candidate only if it's listed in `professions.json`
 * (any profession's `weapons[*].skills` or `professionSkills`) or tagged `Heal`/`Utility`/`Elite` in
 * `skills.json`'s own `slot` field. This is deliberately a *liberal* filter, not a fully-resolved
 * canonical id per slot — `professions.json` itself still lists multiple ids for one (profession,
 * weapon, slot) triple when a real duplicate/rework/chain-continuation exists (confirmed: 87 such
 * weapon-slot groups, 45 profession-mechanic-slot-and-name groups), so this alone shrinks the raw
 * 745-candidate problem down to 267 without fully deduping it — the remaining duplicate/non-
 * equippable shapes are caught structurally below (same-name sibling already curated, flip-target,
 * turret/gadget sub-ability sharing a `toolbeltSkill` with an equippable sibling), same signals
 * `skill-variants.ts`'s own `visibleSkillsForSlot` already uses for the picker, not re-derived from
 * scratch. **Known scope gap, verified empty at build time**: this filter does NOT include ids only
 * reachable via a bundle's `Skill.bundleSkills` (Engineer Kits, Elementalist Conjures, Bladesworn's
 * Dragon Slash chain) — confirmed 2026-10-19 every bundle-reachable Damage-fact id already has a
 * `CURATED_DAMAGE_COEFFICIENTS` entry, so this gap hides zero real misses today, but a future kit/
 * conjure/bundle addition with an uncurated Damage fact would silently pass this test until that's
 * re-verified. Downed-slot and Toolbelt-slot ids are deliberately excluded instead of filtered as a
 * gap: zero ids of either shape are curated anywhere in `CURATED_DAMAGE_COEFFICIENTS` today, matching
 * this app's existing "Downed isn't modeled at all" (`boon-calc/sources.ts`) and "Toolbelt tooltips
 * aren't rendered" precedent.
 *
 * Built 2026-10-19 by running exactly this scan: 1,019 candidates (equippable per the filter above,
 * carrying a Damage fact), 931 already curated, 267 uncovered. Of those 267:
 * - 91 are structurally-provable duplicates/non-equippable ids (same-name sibling already curated,
 *   a `flipSkill` target of another candidate, a turret/gadget sub-ability sharing `toolbeltSkill`
 *   with an equippable sibling, or a literal (profession, weapon-or-mechanic-slot, name) group
 *   whose other member is already curated) — `SAME_NAME_SIBLING_CURATED`/`SUB_ABILITY`/
 *   `FLIP_TARGET`/`WEAPON_SLOT_DUPLICATE`/`MECH_SLOT_DUPLICATE` below.
 * - 42 were Ranger Soulbeast's Beastmode F1-F3 skills (`data/game-data/soulbeast-beastmode.json`) —
 *   a real, equippable per-pet-family mechanic skillbar never swept for Damage coefficients before.
 *   Resolved as Leg 1 of that TODO item (2026-10-19): 40 wiki-verified and added to
 *   `CURATED_DAMAGE_COEFFICIENTS`, 2 (Siege Turtle's Slam/Heavy Shot) logged as Known Exceptions —
 *   `REASON_NO_PET_WEAPON_STRENGTH` below.
 * - 134 are genuine new/uncurated content spanning several distinct, previously-unswept mechanics
 *   (Necromancer Reaper/Scourge/Harbinger Shroud skillbars, Mesmer Shatter/Virtuoso Bladesong
 *   skills, Catalyst's "Deploy Jade Sphere" overloads, Engineer Mechanist Mech Core skills,
 *   Revenant legend-swap F2-F5 skills including Vindicator's "Release Potential", Necromancer
 *   minion-summon tooltips, and a cluster of festival/novelty skills) — too varied to triage inline
 *   within this leg's own scope (confirmed with the user 2026-10-19), deferred to TODO.md's new
 *   [Damage Coefficient Sweep — New/Uncurated Skill Content] item rather than guessed at here.
 *
 * Trait-side: no trait-keyed `CURATED_DAMAGE_COEFFICIENTS` counterpart exists at all (same
 * "no mechanism" gap `coefficient-completeness.test.ts`'s own header documents for Barrier/Siphon-
 * Damage on traits) — every trait carrying a genuine Damage fact is deferred to TODO.md's new
 * [Trait-Side Damage Proc Tooltip Coverage] item below.
 */

interface SkillDataFile {
  id: number;
  name: string;
  professions: string[];
  slot: string;
  categories: string[];
  facts: Fact[];
  traitedFacts: Fact[];
  flipSkill: number | null;
  toolbeltSkill: number | null;
}
interface TraitDataFile {
  id: number;
  name: string;
  facts: Fact[];
  traitedFacts: Fact[];
}
interface ProfessionWeaponSkillSlotFile {
  id: number;
  slot: string;
}
interface ProfessionDataFile {
  name: string;
  weapons: Record<string, { skills: ProfessionWeaponSkillSlotFile[] }>;
  professionSkills: ProfessionWeaponSkillSlotFile[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const skills: SkillDataFile[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../data/game-data/skills.json'), 'utf-8'),
);
const traits: TraitDataFile[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../data/game-data/traits.json'), 'utf-8'),
);
const professions: ProfessionDataFile[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../data/game-data/professions.json'), 'utf-8'),
);
const soulbeastBeastmode: Record<
  string,
  { f1SkillId: number; f2SkillId: number; f3SkillId: number }
> = JSON.parse(
  readFileSync(resolve(__dirname, '../../../data/game-data/soulbeast-beastmode.json'), 'utf-8'),
);

const skillsById = new Map(skills.map((s) => [s.id, s]));

/** Every id listed in any profession's `weapons[*].skills` or `professionSkills` — see this file's
 *  header for why this is a liberal superset, not a fully-resolved canonical id per slot. */
const WEAPON_OR_MECHANIC_SKILL_IDS = new Set<number>();
for (const p of professions) {
  for (const weapon of Object.values(p.weapons)) {
    for (const s of weapon.skills) WEAPON_OR_MECHANIC_SKILL_IDS.add(s.id);
  }
  for (const s of p.professionSkills) WEAPON_OR_MECHANIC_SKILL_IDS.add(s.id);
}

/** Every id `skills.json` itself tags `Heal`/`Utility`/`Elite` — 745 total, matching
 *  `skill-variants.ts`'s own documented "all 745 Heal/Utility/Elite skills" count. */
const HEAL_UTILITY_ELITE_SKILL_IDS = new Set<number>(
  skills
    .filter((s) => s.slot === 'Heal' || s.slot === 'Utility' || s.slot === 'Elite')
    .map((s) => s.id),
);

const REACHABLE_SKILL_SLOT_IDS = new Set<number>([
  ...WEAPON_OR_MECHANIC_SKILL_IDS,
  ...HEAL_UTILITY_ELITE_SKILL_IDS,
]);

/** Soulbeast's per-pet-family F1-F3 Beastmode skill ids — see this file's header, `BEASTMODE` bucket. */
const SOULBEAST_BEASTMODE_SKILL_IDS = new Set<number>();
for (const family of Object.values(soulbeastBeastmode)) {
  SOULBEAST_BEASTMODE_SKILL_IDS.add(family.f1SkillId);
  SOULBEAST_BEASTMODE_SKILL_IDS.add(family.f2SkillId);
  SOULBEAST_BEASTMODE_SKILL_IDS.add(family.f3SkillId);
}

/** A literal (profession, weapon-type, slot) triple -> every id `professions.json` lists there —
 *  used by `WEAPON_SLOT_DUPLICATE` to catch a second id assigned to the exact same weapon slot. */
const weaponSlotGroups = new Map<string, number[]>();
for (const p of professions) {
  for (const [weaponType, weapon] of Object.entries(p.weapons)) {
    for (const s of weapon.skills) {
      const key = `${p.name}|${weaponType}|${s.slot}`;
      if (!weaponSlotGroups.has(key)) weaponSlotGroups.set(key, []);
      weaponSlotGroups.get(key)!.push(s.id);
    }
  }
}

/** A literal (profession, mechanic slot, skill name) triple -> every id sharing it — NOT just
 *  (profession, slot), since a profession-mechanic slot (e.g. Warrior's Burst `Profession_1`) is
 *  shared by several genuinely-different skills across its different weapons; only a same-NAME
 *  match within that slot is real evidence of a duplicate/rework id, used by `MECH_SLOT_DUPLICATE`. */
const mechNameGroups = new Map<string, number[]>();
for (const p of professions) {
  for (const s of p.professionSkills) {
    const name = skillsById.get(s.id)?.name ?? '?';
    const key = `${p.name}|${s.slot}|${name}`;
    if (!mechNameGroups.has(key)) mechNameGroups.set(key, []);
    mechNameGroups.get(key)!.push(s.id);
  }
}

const isDamageFact = (f: Fact): boolean => f.type === 'Damage';

function touches(
  entity: { facts: Fact[]; traitedFacts: Fact[] },
  pred: (f: Fact) => boolean,
): boolean {
  return entity.facts.some(pred) || entity.traitedFacts.some(pred);
}

function bucket(ids: number[], reason: string): Record<number, string> {
  return Object.fromEntries(ids.map((id) => [id, reason]));
}

const REASON_SAME_NAME_SIBLING_CURATED =
  'Shares its exact name with another id that already has a `CURATED_DAMAGE_COEFFICIENTS` entry — a duplicate/rework/chain id for the same real skill, same shape as `damage-calc.ts`’s own documented Eviscerate/Kill Shot/Earthshaker duplicate-tier ids.';
const REASON_SUB_ABILITY =
  'Turret/gadget/mine context-menu sub-ability (`categories: []`, shares a `toolbeltSkill` with an equippable, non-empty-`categories` sibling) — never independently bindable, same signal `skill-variants.ts`’s `stripNonEquippableSubAbilities` already uses for the picker.';
const REASON_FLIP_TARGET =
  'Another candidate\'s `flipSkill` target under a different name (a turret/minion/legend skill\'s "Detonate"/"Haunt"/follow-up step) — never independently equippable in-game, same signal `skill-variants.ts`\'s `stripFlipTargets` already uses for the picker.';
const REASON_WEAPON_SLOT_DUPLICATE =
  'A second id `professions.json` lists for the exact same (profession, weapon, slot) triple whose sibling id already has a curated entry — a land/underwater or dual-wield-offhand duplicate, not a separately-equippable skill.';
const REASON_MECH_SLOT_DUPLICATE =
  "A second id sharing both the exact same (profession, profession-mechanic slot) AND the exact same skill name as an already-curated sibling — a rework/duplicate-tier id for the same mechanic skill, not a genuinely different one (unlike most same-slot ids, which differ by equipped weapon, e.g. Warrior's Burst skill).";
const REASON_NO_PET_WEAPON_STRENGTH =
  "Ranger Soulbeast Beastmode F1-F3 skill (`data/game-data/soulbeast-beastmode.json`), wiki-verified 2026-10-19 (Leg 1 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]) — unlike every other Beastmode skill in this pet family (confirmed via its siblings, all plain `weapon=unequipped`), this id's own wiki page tags its Damage fact `weapon=pet`/leaves `weapon=` unspecified, and `pet` has no entry in `WEAPON_STRENGTH_MIDPOINTS`: the wiki's own Weapon Strength page says pet skills \"use their own weapon strengths\" (per-species, not a single constant like `unequipped`/`kit`/`conjure`), so no number can be curated without fabricating one.";
const REASON_NEW_CONTENT_SKILL =
  "Equippable skill with a real, uncurated Damage coefficient — found by this leg's scan, spanning several distinct previously-unswept mechanics (Shroud skillbars, Mesmer Shatter/Bladesong, Jade Sphere, Mech Core, Revenant legend-swaps, minion-summon tooltips, festival skills). Deferred to TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content] item rather than triaged per-family inline.";
const REASON_NO_MINION_POWER_SCALING =
  "Necromancer minion-summon skill (Summon Bone Fiend/Bone Minions/Flesh Wurm/Blood Fiend/Shadow Fiend/Flesh Golem), wiki-verified 2026-10-19 (Leg 3 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]) — same 'no mechanism' shape as `REASON_NO_PET_WEAPON_STRENGTH` above, but for minions rather than Soulbeast pets: each skill's own wiki page gives the summoned minion's own fixed level-80 Power (confirmed independent of the caster's Power via each page's own Notes/Mechanics section, e.g. Summon Flesh Wurm \"has a Power stat of roughly 1,650\"), and the `{{skill fact|damage}}` template carries no `weapon=` key at all (a bare unkeyed override number instead, the same shape `fetch-skill-coefficients.ts`'s own parser already treats as a non-curatable power override, e.g. Engineer turret deploy skills). Curating a `weapon`/`coefficient` pair under this app's `weaponStrength * coefficient * Power / Armor` formula would silently substitute the player's own Power for the minion's fixed one — wrong, not just unverified.";
const REASON_NO_WIKI_DAMAGE_FACT =
  "Garish Pillar (Scourge F4), wiki-verified 2026-10-19 (Leg 3 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]) — the skill's own live wiki page documents zero `{{skill fact|damage}}` lines and its own description text ('Induce fear in enemies around your sand shades') never mentions damage at all; the local API's Damage fact (dmg_multiplier 0.333) has no wiki corroboration anywhere, likely stale API bookkeeping rather than a real mechanic. No coefficient can be curated without fabricating one, per this app's standing rule against curating from anything but the wiki.";
const REASON_PVE_WVW_SOURCE_DISAGREEMENT =
  "Rampart Splitter (71875, Berserker's Staff Primal Burst) — pre-existing exclusion, not new to this leg's scan (see its own dated comment block in `CURATED_DAMAGE_COEFFICIENTS`, written before this leg): the API's raw `dmg_multiplier` (1.5) and the wiki's infobox (PvE 0.94/WvW 0.31/PvP 0.34, last touched 2024-02-27) flatly disagree on the same single-hit fact, not a per-hit/totaled ambiguity. No coefficient can be curated without picking a source arbitrarily. That comment claimed this was 'Logged in TODO.md' but it never was — added to Known Exceptions here instead of re-investigating, since nothing about either source has changed.";
const REASON_NO_MECH_POWER_SCALING =
  "Jade Buster Cannon (63374, Mechanist's auto-triggered Jade Mech follow-up to Overclock Signet) — pre-existing exclusion, not new to this leg's scan (see its own dated comment block in `CURATED_DAMAGE_COEFFICIENTS`'s Elite-slot sweep section, written before this leg existed): re-verified 2026-10-19 (Leg 5 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]), the wiki's own `{{skill fact|damage}}` lines still carry `weapon=pet|power=1250` on both PvE and WvW/PvP variants — same fixed-non-player-Power shape as `REASON_NO_MINION_POWER_SCALING` above, just for the Jade Mech's own stat block instead of a Necromancer minion's. That comment was never actually logged to TODO.md despite documenting the reasoning — added to Known Exceptions here instead of re-investigating, same 'found but never logged' shape as the Rampart Splitter exclusion above. Crash Down (63050) and Mech Support: Depth Charges (63210), this skill's two Mech Core F-skill siblings, do NOT share this trap — both use the wiki's own `weapon=unequipped` param (confirmed via fresh wikitext fetch) and are curated normally.";
const REASON_WIKI_STUB_NO_COEFFICIENT =
  "Conduit/Legendary Entity utility skill — pre-existing exclusion, not new to this leg's scan (see `CURATED_DAMAGE_COEFFICIENTS`'s own dated comment block, written before this leg existed): re-verified 2026-10-19 (Leg 6 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]), Hex-Eater Vortex's (77243) and Gladiator's Defense's (77291) wiki pages are still explicitly tagged `{{stub|damage coefficient}}`/`{{stub|gamemode split, missing dmg coeff}}`, quoting only a bare tooltip value (64/477) with no `coefficient=` param at all — same 'wiki hasn't documented the coefficient' gap as Guardian's Repose (Heal-slot sweep), just on brand-new Conduit content instead of an old stub. That comment was never actually logged to TODO.md despite documenting the reasoning — added to Known Exceptions here instead of re-investigating, same 'found but never logged' shape as the Rampart Splitter/Jade Buster Cannon exclusions above.";
const REASON_NO_TURRET_POWER_SCALING =
  "Engineer base turret-deploy skill (Rifle/Flame/Thumper/Rocket/Harpoon Turret) — pre-existing exclusion, not new to this leg's scan (see `CURATED_DAMAGE_COEFFICIENTS`'s own dated comment block in `damage-calc.ts`'s turret-family note, written before this leg existed): re-verified 2026-10-19 (Leg 7 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]) via fresh wikitext, every one of these 5 skills' own wiki page still carries the identical `weapon=utility|power=2389` fixed-Power override on its Damage fact, and the wiki's general Turret page's Mechanics section still states 'otherwise turrets are unaffected by character's stats and cannot critically hit' — same non-player-scaling shape as Detonate Supply Crate Turrets/Jade Buster Cannon above. That comment was never actually logged to TODO.md despite documenting the reasoning — added to Known Exceptions here instead of re-investigating, same 'found but never logged' shape as the Rampart Splitter/Jade Buster Cannon/Hex-Eater Vortex exclusions above.";
const REASON_TURRET_STALE_DUPLICATE_ID =
  "A second `skills.json` id for the exact same turret-deploy skill as an already-excluded `REASON_NO_TURRET_POWER_SCALING` sibling — identical name and Damage fact, differing only by a `GroundTargeted` flag. None of the 5 canonical turrets' own wiki infobox `id =` field (5818/5836/5838/5912/6093) ever names this id, same 'wiki's own `id =` field decides canonical' precedent `damage-calc.ts` already applies to Supply Crate's stale 6183 duplicate. Not independently equippable as a separate skill; carries its canonical sibling's same non-player-scaling Damage fact regardless. Found 2026-10-19 (Leg 7 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]).";
const REASON_RACIAL_FIXED_DAMAGE_NUMBER =
  "Sylvari racial Utility skill — pre-existing exclusion, not new to this leg's scan (see `CURATED_DAMAGE_COEFFICIENTS`'s own dated comment block in `damage-calc.ts`'s Racial Utility sweep section, written before this leg existed): re-verified 2026-10-19 (Leg 7 of TODO.md's [Damage Coefficient Sweep — New/Uncurated Skill Content]) via fresh wikitext, Grasping Vines' (12453) and Seed Turret's (12456) `{{skill fact|damage|...|coefficient=...}}` templates still carry a bare unkeyed override number (127/0.2 and 318/0.5 respectively) with no `weapon=` param at all, and each page's own Notes section still states the damage is fixed/not affected by the creator's stats — same non-player-scaling shape as the turret family above, just phrased without an explicit `power=` key. Never actually logged to TODO.md despite documenting the reasoning — added to Known Exceptions here instead of re-investigating, same 'found but never logged' shape as the other exclusions above.";

// --- Damage skill pool ---

const DAMAGE_SKILL_COVERED_IDS = new Set<number>(
  Object.keys(CURATED_DAMAGE_COEFFICIENTS).map(Number),
);

const DAMAGE_SKILL_EXCLUDED_IDS: Record<number, string> = {
  ...bucket(
    [
      1162, 1167, 5638, 5736, 6183, 10545, 10546, 12471, 12533, 12570, 12598, 14569, 14571, 14572,
      27917, 29558, 29991, 41406, 41524, 41571, 43788, 44514, 44846, 44991, 45425, 46170, 49056,
      50383, 50419, 50438, 50441, 50447, 51395, 51698, 55019, 55027, 55035, 55037, 55040, 55053,
      62841, 68686, 71499, 76917, 77141, 77159, 77198, 78191, 78203, 79309, 79324,
    ],
    REASON_SAME_NAME_SIBLING_CURATED,
  ),
  ...bucket(
    [
      5874, 5889, 5893, 5913, 5957, 5960, 5961, 5984, 5985, 6097, 6098, 6134, 6162, 6163, 29473,
      29518, 30893, 38748, 38750,
    ],
    REASON_SUB_ABILITY,
  ),
  ...bucket([10540, 10570, 10590, 10647, 29458, 30278, 62676, 76503, 78351], REASON_FLIP_TARGET),
  ...bucket([13110, 13112, 15834], REASON_WEAPON_SLOT_DUPLICATE),
  ...bucket(
    [14506, 41746, 71922, 71950, 72029, 72911, 73006, 73024, 73042],
    REASON_MECH_SLOT_DUPLICATE,
  ),
  ...bucket([64699, 66258], REASON_NO_PET_WEAPON_STRENGTH),
  ...bucket([10533, 10541, 10543, 10547, 10589, 10646], REASON_NO_MINION_POWER_SCALING),
  ...bucket([44428], REASON_NO_WIKI_DAMAGE_FACT),
  ...bucket([71875], REASON_PVE_WVW_SOURCE_DISAGREEMENT),
  ...bucket([63374], REASON_NO_MECH_POWER_SCALING),
  ...bucket([77243, 77291], REASON_WIKI_STUB_NO_COEFFICIENT),
  ...bucket([5818, 5836, 5838, 5912, 6093], REASON_NO_TURRET_POWER_SCALING),
  ...bucket([5987, 5989, 5990, 5991, 22574], REASON_TURRET_STALE_DUPLICATE_ID),
  ...bucket([12453, 12456], REASON_RACIAL_FIXED_DAMAGE_NUMBER),
  ...bucket(
    [
      1110, 1115, 1118, 1129, 1131, 5735, 5737, 5738, 9187, 10212, 14552, 25492, 25499, 28113,
      31438, 34637, 34736, 39972, 41283, 41543, 41820, 42360, 42809, 43488, 44397, 44918, 45082,
      45094, 46044, 56920, 62648, 62668, 63094, 63209, 63258, 72103, 72114, 76550, 76582, 76585,
      76601, 76633, 76702, 76707, 76733, 76800, 76900, 76909, 77089, 77288, 78309, 80985, 81024,
    ],
    REASON_NEW_CONTENT_SKILL,
  ),
};

// --- Damage trait pool (no trait-keyed CURATED_DAMAGE_COEFFICIENTS counterpart exists) ---

const DAMAGE_TRAIT_COVERED_IDS = new Set<number>();

const REASON_NO_TRAIT_MECHANISM =
  "No trait-keyed Damage-coefficient table exists at all — same 'no mechanism' gap as Barrier/Siphon-Damage on traits (see coefficient-completeness.test.ts's header). Deferred to TODO.md's [Trait-Side Damage Proc Tooltip Coverage] item.";

const DAMAGE_TRAIT_EXCLUDED_IDS: Record<number, string> = {
  ...bucket(
    [222, 279, 1276, 1688, 1911, 2038, 2064, 2126, 2262, 2339, 2429, 2432],
    REASON_NO_TRAIT_MECHANISM,
  ),
};

function runCompletenessChecks(
  label: string,
  entities: { id: number; name: string; facts: Fact[]; traitedFacts: Fact[] }[],
  predicate: (f: Fact) => boolean,
  isCandidate: (e: { id: number }) => boolean,
  coveredIds: ReadonlySet<number>,
  excludedIds: Record<number, string>,
) {
  describe(label, () => {
    it('accounts for every candidate in the curated table(s) or the exclusion list', () => {
      const uncovered: string[] = [];
      for (const e of entities) {
        if (!touches(e, predicate)) continue;
        if (!isCandidate(e)) continue;
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
          return !e || !touches(e, predicate) || !isCandidate(e);
        });
      expect(
        stale,
        'Id(s) in the exclusion map that no longer exist, no longer carry the qualifying fact, or are no longer a reachable-slot candidate — a balance patch likely reworked them; remove the stale entry.',
      ).toEqual([]);
    });
  });
}

runCompletenessChecks(
  'Damage skill coefficient completeness',
  skills,
  isDamageFact,
  (e) => REACHABLE_SKILL_SLOT_IDS.has(e.id),
  DAMAGE_SKILL_COVERED_IDS,
  DAMAGE_SKILL_EXCLUDED_IDS,
);

runCompletenessChecks(
  'Damage trait coefficient completeness',
  traits,
  isDamageFact,
  () => true,
  DAMAGE_TRAIT_COVERED_IDS,
  DAMAGE_TRAIT_EXCLUDED_IDS,
);
