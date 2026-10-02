import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ignoreStravaActivity, linkStravaActivityToRun } from '../db/strava'
import {
  activityDate,
  activityDistanceKm,
  activityPaceSecPerKm,
  activityToPrefill,
  findPossibleDuplicate,
  pendingActivities,
  suggestSessionForDate,
} from '../lib/strava'
import { formatDisplayDate } from '../lib/dates'
import { formatDuration, formatPace } from '../lib/paceZones'
import type { Session, StravaActivity } from '../types'
import Modal from './Modal'
import LogRunForm from './LogRunForm'

interface ImportTarget {
  activity: StravaActivity
  suggestedSession: Session | null
}

/** Shows the oldest not-yet-handled Strava run, one at a time. Importing is
 *  always deliberate: tapping opens the normal add-run form prefilled from
 *  the activity, so every downstream effect goes through the usual path. */
export default function StravaImportCard() {
  const strava = useLiveQuery(() => db.strava.get('strava'), [])
  const runs = useLiveQuery(() => db.runs.toArray(), [])
  const [importing, setImporting] = useState<ImportTarget | null>(null)
  const [busy, setBusy] = useState(false)

  if (!strava?.connection || !runs) return null
  const queue = pendingActivities(strava, runs)
  const next = queue[0]
  if (!next && !importing) return null

  async function openImport(activity: StravaActivity) {
    const sessions = await db.sessions.where('date').equals(activityDate(activity)).toArray()
    setImporting({ activity, suggestedSession: suggestSessionForDate(sessions, activityDate(activity)) ?? null })
  }

  async function act(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const duplicate = next ? findPossibleDuplicate(next, runs) : undefined

  return (
    <>
      {next && (
        <section className="rounded-2xl border border-info/40 bg-info/10 p-4" aria-label="New run from Strava">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-info">New run from Strava</p>
            {queue.length > 1 && <p className="text-[11px] text-ink-faint">1 of {queue.length}</p>}
          </div>
          <p className="mt-1 truncate text-sm text-ink-muted">
            {formatDisplayDate(activityDate(next))} · {next.name}
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {activityDistanceKm(next).toFixed(2)} km
            <span className="ml-2 text-sm font-normal text-ink-muted">
              {formatDuration(next.movingTimeSeconds)} · {formatPace(activityPaceSecPerKm(next))}
            </span>
          </p>

          {duplicate && (
            <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              Possible duplicate of your logged run ({duplicate.distanceKm} km ·{' '}
              {formatDuration(duplicate.durationSeconds)})
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {duplicate ? (
              <>
                <button
                  onClick={() => act(() => linkStravaActivityToRun(next.id, duplicate.id))}
                  disabled={busy}
                  className="basis-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40"
                >
                  Link to logged run
                </button>
                <button
                  onClick={() => openImport(next)}
                  disabled={busy}
                  className="flex-1 whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted"
                >
                  Import as new
                </button>
              </>
            ) : (
              <button
                onClick={() => openImport(next)}
                disabled={busy}
                className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40"
              >
                Import run
              </button>
            )}
            <button
              onClick={() => act(() => ignoreStravaActivity(next.id))}
              disabled={busy}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-faint"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {importing && (
        <Modal title="Import run from Strava" onClose={() => setImporting(null)}>
          <LogRunForm
            prefill={activityToPrefill(importing.activity)}
            suggestedSession={importing.suggestedSession}
            onSaved={() => setImporting(null)}
            onCancel={() => setImporting(null)}
          />
        </Modal>
      )}
    </>
  )
}
