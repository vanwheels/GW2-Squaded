export function formatBoonDuration(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(2)
}

export function formatBoonPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

/** `null` (unknown reach, see `BoonConditionSource.targetCount`'s doc comment) renders nothing. */
export function formatTargetCount(targetCount: number | null): string | null {
  return targetCount === null ? null : `Up to ${targetCount}`
}
