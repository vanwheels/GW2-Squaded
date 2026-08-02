const UNITS_SECONDS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60]
]

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** e.g. "3 days ago", "just now" — used for a build/squad card's "last updated" line. */
export function formatRelativeTime(iso: string): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  if (Math.abs(diffSeconds) < 60) return 'just now'
  for (const [unit, secondsInUnit] of UNITS_SECONDS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) return rtf.format(Math.round(diffSeconds / secondsInUnit), unit)
  }
  return rtf.format(diffSeconds, 'second')
}
