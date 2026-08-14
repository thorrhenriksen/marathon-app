// Type-based session dot colors, used by calendar navigation (WeekStrip,
// MonthCalendar) to indicate what kind of session falls on a given day.
// Distinct from the status-based dot colors used elsewhere (Plan.tsx).

import type { SessionType } from '../types'

const SESSION_TYPE_DOT_COLORS: Record<SessionType, string> = {
  easy: 'bg-accent',
  long: 'bg-info',
  tempo: 'bg-warning',
  'marathon-pace': 'bg-highlight',
  strides: 'bg-accent',
  race: 'bg-danger',
  rest: 'bg-ink-faint',
}

export function sessionDotColor(type: SessionType): string {
  return SESSION_TYPE_DOT_COLORS[type]
}
