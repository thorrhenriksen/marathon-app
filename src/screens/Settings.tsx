import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatDisplayDate, todayISO } from '../lib/dates'
import {
  computePaceZones,
  formatDuration,
  formatPace,
  formatPaceRange,
  parseDurationToSeconds,
} from '../lib/paceZones'
import { computeAdjustment, type AdjustmentPreview } from '../lib/adjustmentEngine'
import { resetToOriginalPlan } from '../db/seed'
import type { Session, TimeOff, TimeOffLabel } from '../types'
import Modal from '../components/Modal'

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

const TIME_OFF_LABELS: Record<TimeOffLabel, string> = {
  holiday: 'Holiday',
  illness: 'Illness',
  other: 'Other',
}

interface UndoSnapshot {
  timeOffId: string
  previousSessions: Session[]
  insertedSessionIds: string[]
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  )
}

const inputClass =
  'w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100'
const primaryButtonClass =
  'rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950'
const secondaryButtonClass =
  'rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300'
const dangerButtonClass = 'rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-neutral-950'

function GoalSection() {
  const goal = useLiveQuery(() => db.goals.get('goal'), [])
  const [draft, setDraft] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [saved, setSaved] = useState(false)

  if (goal && !initialized) {
    setDraft(formatDuration(goal.targetTimeSeconds))
    setInitialized(true)
  }

  const draftSeconds = parseDurationToSeconds(draft)
  const zones = draftSeconds > 0 ? computePaceZones(draftSeconds) : null

  async function handleSave() {
    if (draftSeconds <= 0) return
    await db.goals.put({ id: 'goal', targetTimeSeconds: draftSeconds, updatedAt: new Date().toISOString() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SectionCard title="Goal time">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="4:30:00"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass}
        />
        <button onClick={handleSave} className={`${primaryButtonClass} shrink-0`}>
          Save
        </button>
      </div>
      {saved && <p className="mt-2 text-xs text-emerald-400">Saved.</p>}

      {zones && (
        <div className="mt-4 flex flex-col gap-2 border-t border-neutral-800 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Marathon pace</span>
            <span className="font-medium text-neutral-100">{formatPace(zones.marathonPaceSecPerKm)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Easy pace</span>
            <span className="font-medium text-neutral-100">
              {formatPaceRange(zones.easyPaceMinSecPerKm, zones.easyPaceMaxSecPerKm)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Tempo pace</span>
            <span className="font-medium text-neutral-100">
              {formatPaceRange(zones.tempoPaceMinSecPerKm, zones.tempoPaceMaxSecPerKm)}
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function TimeOffSection() {
  const timeOffEntries = useLiveQuery(() => db.timeOff.orderBy('startDate').reverse().toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const weeks = useLiveQuery(() => db.weeks.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get('settings'), [])

  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [label, setLabel] = useState<TimeOffLabel>('holiday')
  const [note, setNote] = useState('')

  const [pendingTimeOff, setPendingTimeOff] = useState<TimeOff | null>(null)
  const [preview, setPreview] = useState<AdjustmentPreview | null>(null)
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handlePreview() {
    setError(null)
    if (!sessions || !weeks || !settings) return
    if (endDate < startDate) {
      setError('End date must be on or after the start date.')
      return
    }
    const newTimeOff: TimeOff = {
      id: crypto.randomUUID(),
      startDate,
      endDate,
      label,
      note: note.trim() || undefined,
    }
    const result = computeAdjustment(newTimeOff, sessions, weeks, settings)
    setPendingTimeOff(newTimeOff)
    setPreview(result)
  }

  async function handleConfirm() {
    if (!preview || !pendingTimeOff || !sessions) return
    const previousSessions = sessions.filter((s) =>
      preview.updatedSessions.some((u) => u.id === s.id),
    )

    await db.transaction('rw', db.sessions, db.timeOff, async () => {
      if (preview.updatedSessions.length > 0) {
        await db.sessions.bulkPut(preview.updatedSessions)
      }
      if (preview.insertedSessions.length > 0) {
        await db.sessions.bulkAdd(preview.insertedSessions)
      }
      await db.timeOff.add(pendingTimeOff)
    })

    setUndoSnapshot({
      timeOffId: pendingTimeOff.id,
      previousSessions,
      insertedSessionIds: preview.insertedSessions.map((s) => s.id),
    })
    setPreview(null)
    setPendingTimeOff(null)
    setNote('')
  }

  function handleCancelPreview() {
    setPreview(null)
    setPendingTimeOff(null)
  }

  async function handleUndo() {
    if (!undoSnapshot) return
    await db.transaction('rw', db.sessions, db.timeOff, async () => {
      if (undoSnapshot.previousSessions.length > 0) {
        await db.sessions.bulkPut(undoSnapshot.previousSessions)
      }
      if (undoSnapshot.insertedSessionIds.length > 0) {
        await db.sessions.bulkDelete(undoSnapshot.insertedSessionIds)
      }
      await db.timeOff.delete(undoSnapshot.timeOffId)
    })
    setUndoSnapshot(null)
  }

  return (
    <SectionCard title="Time off">
      {undoSnapshot && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-sky-800/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
          <span>Time off adjustment applied.</span>
          <button onClick={handleUndo} className="font-semibold underline">
            Undo
          </button>
        </div>
      )}

      {timeOffEntries && timeOffEntries.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {timeOffEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs"
            >
              <span className="text-neutral-300">
                {formatDisplayDate(entry.startDate)} – {formatDisplayDate(entry.endDate)}
              </span>
              <span className="text-neutral-500">{TIME_OFF_LABELS[entry.label]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-500">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-500">End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-500">Reason</label>
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value as TimeOffLabel)}
            className={inputClass}
          >
            {(Object.keys(TIME_OFF_LABELS) as TimeOffLabel[]).map((key) => (
              <option key={key} value={key}>
                {TIME_OFF_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-500">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button onClick={handlePreview} className={`${primaryButtonClass} mt-1`}>
          Preview adjustment
        </button>
      </div>

      {preview && (
        <Modal title="Confirm plan adjustment" onClose={handleCancelPreview}>
          <div className="flex flex-col gap-3">
            {preview.summary.length === 0 ? (
              <p className="text-sm text-neutral-400">No sessions fall within this range.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm text-neutral-300">
                {preview.summary.map((line, i) => (
                  <li key={i} className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                    {line}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <button onClick={handleCancelPreview} className={`${secondaryButtonClass} flex-1`}>
                Cancel
              </button>
              <button onClick={handleConfirm} className={`${primaryButtonClass} flex-1`}>
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </SectionCard>
  )
}

function PreferredDaysSection() {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])

  async function toggleDay(day: number) {
    if (!settings) return
    const next = settings.preferredDays.includes(day)
      ? settings.preferredDays.filter((d) => d !== day)
      : [...settings.preferredDays, day]
    await db.settings.update('settings', { preferredDays: next })
  }

  if (!settings) return null

  return (
    <SectionCard title="Preferred run days">
      <div className="flex flex-wrap gap-2">
        {DAY_OPTIONS.map((day) => {
          const active = settings.preferredDays.includes(day.value)
          return (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={`rounded-full px-3 py-2 text-xs font-medium ${
                active ? 'bg-emerald-500 text-neutral-950' : 'border border-neutral-700 text-neutral-400'
              }`}
            >
              {day.label}
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}

function BackupSection() {
  const [message, setMessage] = useState<string | null>(null)

  async function handleExport() {
    const [sessions, runs, goals, timeOff, settings, weeks] = await Promise.all([
      db.sessions.toArray(),
      db.runs.toArray(),
      db.goals.toArray(),
      db.timeOff.toArray(),
      db.settings.toArray(),
      db.weeks.toArray(),
    ])
    const payload = {
      exportedAt: new Date().toISOString(),
      sessions,
      runs,
      goals,
      timeOff,
      settings,
      weeks,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `marathon-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const text = String(reader.result)
        const data = JSON.parse(text)
        if (!data.sessions || !data.weeks || !data.settings || !data.goals) {
          throw new Error('This file does not look like a valid backup.')
        }
        await db.transaction(
          'rw',
          [db.sessions, db.runs, db.goals, db.timeOff, db.settings, db.weeks],
          async () => {
            await Promise.all([
              db.sessions.clear(),
              db.runs.clear(),
              db.goals.clear(),
              db.timeOff.clear(),
              db.settings.clear(),
              db.weeks.clear(),
            ])
            await db.sessions.bulkAdd(data.sessions)
            await db.runs.bulkAdd(data.runs ?? [])
            await db.goals.bulkAdd(data.goals)
            await db.timeOff.bulkAdd(data.timeOff ?? [])
            await db.settings.bulkAdd(data.settings)
            await db.weeks.bulkAdd(data.weeks)
          },
        )
        setMessage('Backup restored.')
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Failed to import backup.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <SectionCard title="Backup">
      <div className="flex flex-col gap-2">
        <button onClick={handleExport} className={secondaryButtonClass}>
          Export backup
        </button>
        <label className={`${secondaryButtonClass} cursor-pointer text-center`}>
          Import backup
          <input type="file" accept="application/json" onChange={handleImportChange} className="hidden" />
        </label>
        {message && <p className="text-xs text-neutral-400">{message}</p>}
      </div>
    </SectionCard>
  )
}

function ResetPlanSection() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  async function handleReset() {
    await resetToOriginalPlan()
    setShowConfirm(false)
    setResetDone(true)
    setTimeout(() => setResetDone(false), 2000)
  }

  return (
    <SectionCard title="Reset plan">
      <p className="mb-3 text-xs text-neutral-500">
        Resets your training plan and completion status back to the original 36-week schedule. Logged
        runs, your goal, time-off history, and preferences are not affected.
      </p>
      <button onClick={() => setShowConfirm(true)} className={dangerButtonClass}>
        Reset to original plan
      </button>
      {resetDone && <p className="mt-2 text-xs text-emerald-400">Plan reset.</p>}

      {showConfirm && (
        <Modal title="Reset to original plan?" onClose={() => setShowConfirm(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-300">
              This replaces all planned sessions and week data with the original 36-week schedule. Any
              moves, skips, or re-entry weeks from time-off adjustments will be lost. This cannot be
              undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className={`${secondaryButtonClass} flex-1`}>
                Cancel
              </button>
              <button onClick={handleReset} className={`${dangerButtonClass} flex-1`}>
                Reset
              </button>
            </div>
          </div>
        </Modal>
      )}
    </SectionCard>
  )
}

export default function Settings() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      <h1 className="text-lg font-semibold text-neutral-100">Settings</h1>
      <GoalSection />
      <TimeOffSection />
      <PreferredDaysSection />
      <BackupSection />
      <ResetPlanSection />
    </div>
  )
}
