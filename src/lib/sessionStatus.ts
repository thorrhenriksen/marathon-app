// Single source of truth for how a session's status should be displayed.
// Replaces the app's previously-separate status color maps (Plan.tsx's
// DOT_COLORS, SessionCard.tsx's STATUS_BADGE_*), which disagreed with each
// other and rendered time-off-excused ('skipped') sessions as red.
//
// This is purely derived — nothing here is stored. 'unlogged' in particular
// is never persisted; it's a live computation of "past, non-rest, and not
// yet resolved one way or the other".

import type { Session } from '../types'

export type DisplayStatus = 'completed' | 'missed' | 'handled' | 'unlogged' | 'planned'

export function getDisplayStatus(session: Session, today: string): DisplayStatus {
  if (session.status === 'completed') return 'completed'
  if (session.status === 'missed') return 'missed'
  if (
    session.status === 'handled' ||
    session.status === 'downgraded-to-mobility' ||
    session.status === 'skipped' ||
    session.status === 'moved'
  ) {
    return 'handled'
  }
  if (session.date < today) return 'unlogged'
  return 'planned'
}

export interface DisplayStatusStyle {
  badge: string
  dot: string
  icon: string
  label: string
}

export const DISPLAY_STATUS_STYLE: Record<DisplayStatus, DisplayStatusStyle> = {
  completed: { badge: 'bg-accent/20 text-accent', dot: 'bg-accent', icon: '✓', label: 'Completed' },
  missed: { badge: 'bg-danger/20 text-danger', dot: 'bg-danger', icon: '✕', label: 'Missed' },
  handled: { badge: 'bg-info/20 text-info', dot: 'bg-info', icon: '~', label: 'Adjusted' },
  unlogged: { badge: 'bg-warning/20 text-warning', dot: 'bg-warning', icon: '!', label: 'Unlogged' },
  planned: { badge: 'bg-surface-inset text-ink-muted', dot: '', icon: '', label: 'Planned' },
}
