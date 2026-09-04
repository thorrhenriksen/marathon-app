// Lightweight date utilities operating on ISO date strings (YYYY-MM-DD).
// Local-time only — this app has a single user in a single timezone.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`)
}

export function addDays(dateStr: string, days: number): string {
  const d = parseISODate(dateStr)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function daysBetween(a: string, b: string): number {
  const da = parseISODate(a)
  const db = parseISODate(b)
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

/** 0 = Sunday .. 6 = Saturday, matches JS Date#getDay() */
export function getWeekdayIndex(dateStr: string): number {
  return parseISODate(dateStr).getDay()
}

export function formatDisplayDate(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** e.g. "31 Aug – 6 Sep" — day + short month, no weekday/year, for compact week-range headers. */
export function formatDateRangeShort(startDate: string): string {
  const endDate = addDays(startDate, 6)
  const fmt = (d: string) => parseISODate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(startDate)} – ${fmt(endDate)}`
}

export function formatDisplayDateLong(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr
}

/** Returns the ISO date of the Monday for the week containing dateStr. */
export function startOfWeek(dateStr: string): string {
  const weekday = getWeekdayIndex(dateStr) // 0=Sun..6=Sat
  const offsetFromMonday = weekday === 0 ? 6 : weekday - 1
  return addDays(dateStr, -offsetFromMonday)
}
