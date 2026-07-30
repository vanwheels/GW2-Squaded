export function formatBoonDuration(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(2)
}

export function formatBoonPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}
