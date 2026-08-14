import { useState } from 'react'
import { db } from '../db/db'
import { todayISO } from '../lib/dates'
import { computePaceSecPerKm, formatPace, parseDurationToSeconds } from '../lib/paceZones'
import type { Session, SessionType } from '../types'

interface LogRunFormProps {
  /** When logging against a scheduled session, prefills fields and marks it completed on save. */
  session?: Session | null
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

export default function LogRunForm({ session, onSaved, onCancel }: LogRunFormProps) {
  const [date, setDate] = useState(session?.date ?? todayISO())
  const [distanceKm, setDistanceKm] = useState(session ? String(session.plannedDistanceKm) : '')
  const [durationInput, setDurationInput] = useState('')
  const [effort, setEffort] = useState(5)
  const [note, setNote] = useState('')
  const [type, setType] = useState<SessionType | 'other'>(
    session && session.type !== 'rest' ? session.type : 'easy',
  )
  const [saving, setSaving] = useState(false)

  const durationSeconds = parseDurationToSeconds(durationInput)
  const distance = Number(distanceKm)
  const pace = distance > 0 && durationSeconds > 0 ? computePaceSecPerKm(distance, durationSeconds) : 0
  const canSave = distance > 0 && durationSeconds > 0 && date.length === 10

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
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
      })
      if (session) {
        await db.sessions.update(session.id, { status: 'completed', linkedRunId: runId })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
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

      <div className="grid grid-cols-2 gap-3">
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
            Time (h:mm:ss)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            placeholder="0:45:00"
            className="w-full rounded-lg border border-border bg-surface-inset px-3 py-3 text-base text-ink"
          />
        </div>
      </div>

      {pace > 0 && (
        <p className="text-sm text-ink-muted">
          Pace: <span className="text-ink">{formatPace(pace)}</span>
        </p>
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
          {saving ? 'Saving…' : 'Save run'}
        </button>
      </div>
    </div>
  )
}
