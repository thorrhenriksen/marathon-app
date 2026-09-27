import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { todayISO } from '../lib/dates'
import { computeStreakSummary, formatStreakChip } from '../lib/streakSummary'
import Modal from './Modal'

/** Compact "🔥N · x/y sessions · z%" chip. Tapping opens an explainer of what
 *  counts toward the streak and why it's at its current value. */
export default function StreakChip({ className = '' }: { className?: string }) {
  const weeks = useLiveQuery(() => db.weeks.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const timeOffEntries = useLiveQuery(() => db.timeOff.toArray(), [])
  const [open, setOpen] = useState(false)
  const today = todayISO()

  const summary = useMemo(
    () => (weeks && sessions && timeOffEntries ? computeStreakSummary(sessions, weeks, timeOffEntries, today) : null),
    [weeks, sessions, timeOffEntries, today],
  )

  if (!summary) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-8 max-w-full items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-ink-muted active:bg-surface-inset ${className}`}
      >
        <span className="truncate">{formatStreakChip(summary)}</span>
      </button>

      {open && (
        <Modal title="Streak & adherence" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-xs text-ink-faint">Adherence</p>
                <p className="mt-1 text-lg font-semibold text-ink">{summary.adherencePercent}%</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-xs text-ink-faint">Sessions</p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {summary.completedSessions}/{summary.elapsedSessions}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-xs text-ink-faint">Streak</p>
                <p className="mt-1 text-lg font-semibold text-ink">🔥{summary.current}</p>
              </div>
            </div>

            <p className="text-ink">{summary.explanation}</p>

            <div className="rounded-xl border border-border p-3 text-ink-muted">
              <p className="font-medium text-ink">What counts</p>
              <p className="mt-1">
                A finished plan week counts when every session in it is completed or adjusted (moved, swapped to
                mobility, or eased off when not feeling 100%). Weeks fully covered by time off are paused, not broken.
                A missed session resets the streak; an unlogged one holds it until you resolve it.
              </p>
              <p className="mt-2">Best streak so far: {summary.longest} {summary.longest === 1 ? 'week' : 'weeks'}.</p>
            </div>

            <p className="text-xs text-ink-faint">
              The streak is one signal. Adherence — the share of planned sessions you've completed — is the better
              picture of how training is going.
            </p>
          </div>
        </Modal>
      )}
    </>
  )
}
