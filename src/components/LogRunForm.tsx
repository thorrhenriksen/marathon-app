import { useState } from 'react'
import { celebrate } from '../lib/celebrate'
import { db } from '../db/db'
import { deleteRun } from '../db/runs'
import { markStravaActivityImported } from '../db/strava'
import type { RunPrefill } from '../lib/strava'
import DurationInput from './DurationInput'
import { todayISO } from '../lib/dates'
import { computePaceSecPerKm, formatPace } from '../lib/paceZones'
import type { Run, Session, SessionType } from '../types'

interface LogRunFormProps {
  /** When logging against a scheduled session, prefills fields and marks it completed on save. */
  session?: Session | null
  /** When editing an already-logged run, prefills fields and updates it in place on save. */
  run?: Run | null
  /** New run prefilled from an imported activity (e.g. Strava). */
  prefill?: RunPrefill | null
  /** A scheduled session on the prefill's day the run can complete; offered as a default-on toggle. */
  suggestedSession?: Session | null
  onSaved: () => void
  onCancel: () => void
}

const TYPE_OPTIONS: (SessionType | 'other')[] = [
  'easy',
  'long',
  'tempo',
  'marathon-pace',
  'strides',
  'race',
  'other',
]

/** Extracts "HH:MM" from an ISO datetime, in local time. */
function timeFromISO(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Combines a YYYY-MM-DD date and HH:MM time into an ISO datetime, in local time. */
function combineDateAndTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

export default function LogRunForm({
  session: explicitSession,
  run,
  prefill,
  suggestedSession,
  onSaved,
  onCancel,
}: LogRunFormProps) {
  const [linkSuggested, setLinkSuggested] = useState(!!suggestedSession)
  const session = explicitSession ?? (linkSuggested ? suggestedSession : null)
  const [date, setDate] = useState(run?.date ?? prefill?.date ?? session?.date ?? todayISO())
  const [distanceKm, setDistanceKm] = useState(
    run
      ? String(run.distanceKm)
      : prefill
        ? String(prefill.distanceKm)
        : session
          ? String(session.plannedDistanceKm)
          : '',
  )
  const [durationSeconds, setDurationSeconds] = useState(run?.durationSeconds ?? prefill?.durationSeconds ?? 0)
  const [time, setTime] = useState(
    run?.loggedAt ? timeFromISO(run.loggedAt) : (prefill?.time ?? timeFromISO(new Date().toISOString())),
  )
  const [effort, setEffort] = useState(run?.effort ?? 5)
  const [note, setNote] = useState(run?.note ?? '')
  const [type, setType] = useState<SessionType | 'other'>(
    run ? run.type : session && session.type !== 'rest' ? session.type : 'easy',
  )

  function toggleLinkSuggested() {
    const next = !linkSuggested
    setLinkSuggested(next)
    if (suggestedSession) setType(next ? suggestedSession.type : 'easy')
  }
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const distance = Number(distanceKm)
  const pace = distance > 0 && durationSeconds > 0 ? computePaceSecPerKm(distance, durationSeconds) : 0
  const canSave = distance > 0 && durationSeconds > 0 && date.length === 10

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const loggedAt = combineDateAndTime(date, time)
      if (run) {
        await db.runs.put({
          ...run,
          date,
          distanceKm: distance,
          durationSeconds,
          paceSecPerKm: pace,
          type,
          effort,
          note: note.trim() || undefined,
          loggedAt,
        })
      } else {
        const runId = crypto.randomUUID()
        await db.runs.add({
          id: runId,
          date,
          distanceKm: distance,
          durationSeconds,
          paceSecPerKm: pace,
          type,
          effort,
          note: note.trim() || undefined,
          linkedSessionId: session?.id,
          loggedAt,
          stravaActivityId: prefill?.stravaActivityId,
        })
        if (prefill) await markStravaActivityImported(prefill.stravaActivityId)
        if (session) {
          await db.sessions.update(session.id, { status: 'completed', linkedRunId: runId })
          celebrate()
        }
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!run || deleting) return
    setDeleting(true)
    try {
      await deleteRun(run.id)
      onSaved()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-inset px-3 py-3 text-base text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-border bg-surface-inset px-3 py-3 text-base text-ink"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
          Distance (km)
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          placeholder="0.0"
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-3 text-base text-ink"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
          Time
        </label>
        <DurationInput seconds={durationSeconds} onChange={setDurationSeconds} />
      </div>

      {pace > 0 && (
        <p className="text-sm text-ink-muted">
          Pace: <span className="text-ink">{formatPace(pace)}</span>
        </p>
      )}

      {suggestedSession && !explicitSession && (
        <label className="flex items-center gap-3 rounded-lg border border-border bg-surface-inset px-3 py-3">
          <input type="checkbox" checked={linkSuggested} onChange={toggleLinkSuggested} className="h-4 w-4" />
          <span className="text-sm text-ink">
            Complete the planned{' '}
            <span className="font-medium">
              {suggestedSession.type} {suggestedSession.plannedDistanceKm} km
            </span>{' '}
            session
          </span>
        </label>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
          Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SessionType | 'other')}
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-3 text-base text-ink"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
          Effort: {effort}/10
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={effort}
          onChange={(e) => setEffort(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-base text-ink"
        />
      </div>

      <div className="mt-2 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-border py-3 text-base font-medium text-ink-muted"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex-1 rounded-xl bg-accent py-3 text-base font-semibold text-accent-fg disabled:opacity-40"
        >
          {saving ? 'Saving…' : run ? 'Save changes' : 'Save run'}
        </button>
      </div>

      {run &&
        (!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="w-full rounded-xl border border-danger/40 py-3 text-sm font-medium text-danger"
          >
            Delete run
          </button>
        ) : (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3">
            <p className="text-sm text-danger">
              {run.linkedSessionId
                ? 'This will delete the run and mark its scheduled session as not completed. This cannot be undone.'
                : 'This will permanently delete the run. This cannot be undone.'}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-ink-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-danger py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
            </div>
          </div>
        ))}
    </div>
  )
}
