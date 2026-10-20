import type { Fact, Trait } from '../types';
import { factLine, type FactLine } from './fact-numbers';
import { healingLinesForTrait } from './healing-calc';
import { damageLinesForTrait } from './damage-calc';

/**
 * Trait-tooltip counterpart to `skill-fact-lines.ts`'s `skillFactLines` — same real-value overlay
 * idea (a wiki-verified coefficient renders the actual current-build-scaled number instead of
 * `factLine`'s generic base-value fallback), scoped to `CURATED_TRAIT_HEALING_COEFFICIENTS` and
 * `CURATED_TRAIT_DAMAGE_COEFFICIENTS` — the only curated tables with trait entries so far
 * (`CURATED_BARRIER_COEFFICIENTS`/`CURATED_SIPHON_DAMAGE_COEFFICIENTS` remain skill-id-keyed only,
 * unchanged — see TODO.md/`coefficient-verification-queue.md` for why Healing Ripple, trait 351,
 * was the one that finally needed the Healing overlay, and the [Trait-Side Damage Proc Tooltip
 * Coverage] item for the Damage one). `numericFactLines`' `requires_trait` gating and
 * `wvwOverrides` (`NUMERIC_FACT_WVW_OVERRIDES`) dedup/filter behavior are reproduced here directly
 * rather than composed with it, since `numericFactLines` has no hook for a real-value overlay and
 * duplicating its gating logic is simpler than threading one through it.
 */
export function traitFactLines(
  trait: Trait,
  facts: Fact[],
  activeIds: ReadonlySet<number>,
  healingPower: number,
  wvwOverrides?: Record<string, number>,
  power?: number,
  targetArmor?: number,
): FactLine[] {
  const healingByLabel = new Map(
    healingLinesForTrait(trait, healingPower, activeIds).map((l) => [l.label, l.value]),
  );
  const damageByLabel = new Map(
    power != null && targetArmor != null
      ? damageLinesForTrait(trait, power, targetArmor, activeIds).map((l) => [l.label, l.value])
      : [],
  );

  const lines: FactLine[] = [];
  const seen = new Set<string>();
  for (const fact of [...facts, ...trait.traitedFacts]) {
    if (fact.requires_trait != null && !activeIds.has(fact.requires_trait)) continue;
    const label =
      typeof fact.text === 'string'
        ? fact.text
        : fact.type === 'AttributeAdjust' && typeof fact.target === 'string'
          ? fact.target
          : undefined;
    if (
      wvwOverrides &&
      fact.requires_trait == null &&
      typeof label === 'string' &&
      label in wvwOverrides
    ) {
      const target = wvwOverrides[label];
      if (fact.type === 'Number' && fact.value !== target) continue;
      if (fact.type === 'Percent' && fact.percent !== target) continue;
      if (fact.type === 'AttributeAdjust' && fact.value !== target) continue;
      if (fact.type === 'Time' && fact.duration !== target) continue;
    }
    const icon = fact.icon ?? null;
    const line: FactLine | null =
      fact.type === 'AttributeAdjust' &&
      fact.target === 'Healing' &&
      typeof fact.text === 'string' &&
      healingByLabel.has(fact.text)
        ? { icon, text: `${fact.text}: ${healingByLabel.get(fact.text)!.toLocaleString()}` }
        : fact.type === 'Damage' && typeof fact.text === 'string' && damageByLabel.has(fact.text)
          ? { icon, text: `${fact.text}: ${damageByLabel.get(fact.text)!.toLocaleString()}` }
          : factLine(fact);
    if (line && !seen.has(line.text)) {
      seen.add(line.text);
      lines.push(line);
    }
  }
  return lines;
}
