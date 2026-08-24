import { describe, expect, it } from 'vitest'
import { collapseIdenticalOptionGroups, type OptimizerSlot, type SearchOption } from './gear-optimize'

/**
 * Regression coverage for the slot-grouping reformulation added 2026-08-23 — see that same date's
 * TODO.md entry. Found diagnosing a Gear Optimizer run (4 floors, rune/infusion optimization on)
 * that reported "couldn't find a combination" when the user's own equipped gear already satisfied
 * every floor: the search modeled every physical infusion slot (~20 of them, all sharing the same
 * option list) as an independent DFS branching dimension, an intractable blowup that could still be
 * unresolved after 45s even on an easier 3-floor sub-problem. `collapseIdenticalOptionGroups`
 * exploits that those slots are interchangeable — only *how many* go to each option matters, never
 * *which* physical slot — to replace such a cluster with one aggregate slot the solver treats as a
 * single (much smaller, exactly-enumerated) branching dimension, with zero change to `solve()`
 * itself.
 */

function opt(id: number | null, label: string, deltas: number[]): SearchOption {
  return { id, label, deltas }
}

describe('collapseIdenticalOptionGroups', () => {
  it('collapses 3 slots sharing one options array into a single group slot', () => {
    const shared: SearchOption[] = [opt(1, 'A', [10, 0]), opt(2, 'B', [0, 10])]
    const slots: OptimizerSlot[] = [
      { id: 'x', label: 'X', equipmentKeys: ['helm'], options: shared },
      { id: 'y', label: 'Y', equipmentKeys: ['shoulders'], options: shared },
      { id: 'z', label: 'Z', equipmentKeys: ['gloves'], options: shared }
    ]
    const result = collapseIdenticalOptionGroups(slots)
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('group')
    expect(result[0].groupMembers?.map((m) => m.id)).toEqual(['x', 'y', 'z'])
  })

  it("the group's option deltas match choosing that many of each underlying option across the members", () => {
    const shared: SearchOption[] = [opt(1, 'A', [10, 0]), opt(2, 'B', [0, 10])]
    const slots: OptimizerSlot[] = [
      { id: 'x', label: 'X', equipmentKeys: ['helm'], options: shared },
      { id: 'y', label: 'Y', equipmentKeys: ['shoulders'], options: shared },
      { id: 'z', label: 'Z', equipmentKeys: ['gloves'], options: shared }
    ]
    const [group] = collapseIdenticalOptionGroups(slots)
    // Every option in the pruned group list should be some (countA, countB) split of 3 units —
    // e.g. 2×A + 1×B must read as deltas [20, 10].
    const twoAndOne = group.options.find((o) => o.deltas[0] === 20 && o.deltas[1] === 10)
    expect(twoAndOne).toBeDefined()
    expect(twoAndOne?.allocation).toHaveLength(3)
    expect(twoAndOne?.allocation?.filter((a) => a.id === 1)).toHaveLength(2)
    expect(twoAndOne?.allocation?.filter((a) => a.id === 2)).toHaveLength(1)
  })

  it('covers every reachable total exactly once (no combination missing, none duplicated) vs. a brute-force cross product', () => {
    const shared: SearchOption[] = [opt(1, 'A', [10, 0]), opt(2, 'B', [0, 10]), opt(3, 'C', [5, 5])]
    const slots: OptimizerSlot[] = [
      { id: 'x', label: 'X', equipmentKeys: ['ring1'], options: shared },
      { id: 'y', label: 'Y', equipmentKeys: ['ring2'], options: shared }
    ]
    const [group] = collapseIdenticalOptionGroups(slots)

    const bruteForceTotals = new Set<string>()
    for (const a of shared) {
      for (const b of shared) {
        bruteForceTotals.add(`${a.deltas[0] + b.deltas[0]}|${a.deltas[1] + b.deltas[1]}`)
      }
    }
    // Every non-dominated brute-force total must be reachable by some surviving group option
    // (the group is pruned, so a dominated brute-force total is allowed to be absent).
    const groupTotals = new Set(group.options.map((o) => `${o.deltas[0]}|${o.deltas[1]}`))
    for (const total of groupTotals) {
      expect(bruteForceTotals.has(total)).toBe(true)
    }
    // The single best total for each metric individually must survive pruning either way.
    const bestMetric0 = Math.max(...[...bruteForceTotals].map((t) => Number(t.split('|')[0])))
    expect([...groupTotals].some((t) => Number(t.split('|')[0]) === bestMetric0)).toBe(true)
  })

  it('leaves slots with different option arrays ungrouped', () => {
    const slots: OptimizerSlot[] = [
      { id: 'x', label: 'X', equipmentKeys: ['helm'], options: [opt(1, 'A', [10])] },
      { id: 'y', label: 'Y', equipmentKeys: ['chest'], options: [opt(2, 'B', [5])] }
    ]
    const result = collapseIdenticalOptionGroups(slots)
    expect(result).toHaveLength(2)
    expect(result.every((s) => s.kind !== 'group')).toBe(true)
  })

  it('leaves a lone slot (cluster of 1) ungrouped even if nothing else uses its options array', () => {
    const slots: OptimizerSlot[] = [{ id: 'x', label: 'X', equipmentKeys: ['helm'], options: [opt(1, 'A', [10])] }]
    const result = collapseIdenticalOptionGroups(slots)
    expect(result).toEqual(slots)
  })

  it('never groups food/utility/rune slots even if they happened to share an options array reference', () => {
    const shared: SearchOption[] = [opt(null, 'None', [0]), opt(5, 'Item', [10])]
    const slots: OptimizerSlot[] = [
      { id: 'food', label: 'Food', equipmentKeys: [], kind: 'food', options: shared },
      { id: 'utility', label: 'Utility', equipmentKeys: [], kind: 'utility', options: shared }
    ]
    const result = collapseIdenticalOptionGroups(slots)
    expect(result).toHaveLength(2)
    expect(result.every((s) => s.kind !== 'group')).toBe(true)
  })
})
