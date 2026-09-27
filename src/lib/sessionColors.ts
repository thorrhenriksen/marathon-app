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
  strength: 'bg-strength',
}

export function sessionDotColor(type: SessionType): string {
  return SESSION_TYPE_DOT_COLORS[type]
}

const SESSION_TYPE_BORDER_COLORS: Record<SessionType, string> = {
  easy: 'border-l-accent',
  long: 'border-l-info',
  tempo: 'border-l-warning',
  'marathon-pace': 'border-l-highlight',
  strides: 'border-l-accent',
  race: 'border-l-danger',
  rest: 'border-l-ink-faint',
  strength: 'border-l-strength',
}

/** Left-edge-only card border color keyed by session type — same palette as `sessionDotColor`. */
export function sessionBorderColor(type: SessionType): string {
  return SESSION_TYPE_BORDER_COLORS[type]
}

/** Solid swatch per card accent, for pickers and the shop. */
export const CARD_ACCENT_SWATCH: Record<'bronze' | 'silver' | 'gold' | 'platinum', string> = {
  bronze: 'bg-[#b45309]',
  silver: 'bg-[#94a3b8]',
  gold: 'bg-[#eab308]',
  platinum: 'bg-[#a78bfa]',
}
