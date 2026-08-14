import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatDisplayDate, parseISODate } from '../lib/dates'
import { formatDuration, formatPace } from '../lib/paceZones'
import type { Run, SessionType } from '../types'
import Modal from '../components/Modal'
import LogRunForm from '../components/LogRunForm'

const TYPE_LABELS: Record<SessionType | 'other', string> = {
  easy: 'Easy',
  long: 'Long',
  tempo: 'Tempo',
  'marathon-pace': 'MP',
  strides: 'Strides',
  race: 'Race',
  rest: 'Rest',
  other: 'Other',
}

const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function monthLabel(key: string): string {
  return MONTH_FMT.format(parseISODate(`${key}-01`))
}

interface MonthGroup {
  key: string
  runs: Run[]
  totalKm: number
  totalSeconds: number
}

function groupByMonth(runs: Run[]): MonthGroup[] {
  const map = new Map<string, Run[]>()
  for (const run of runs) {
    const key = monthKey(run.date)
    const list = map.get(key)
    if (list) {
      list.push(run)
    } else {
      map.set(key, [run])
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, groupRuns]) => ({
      key,
      runs: groupRuns,
      totalKm: groupRuns.reduce((sum, r) => sum + r.distanceKm, 0),
      totalSeconds: groupRuns.reduce((sum, r) => sum + r.durationSeconds, 0),
    }))
}

function RunRow({ run }: { run: Run }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex w-14 shrink-0 flex-col items-start">
        <span className="text-[11px] uppercase text-neutral-500">
          {formatDisplayDate(run.date).slice(0, 3)}
        </span>
        <span className="text-xs font-medium text-neutral-300">{TYPE_LABELS[run.type]}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-neutral-50">{run.distanceKm} km</span>
          <span className="text-xs text-neutral-500">{formatDuration(run.durationSeconds)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
          <span>{formatPace(run.paceSecPerKm)}</span>
          <span>·</span>
          <span>Effort {run.effort}/10</span>
        </div>
        {run.note && <p className="mt-1 truncate text-xs text-neutral-400">{run.note}</p>}
      </div>
    </div>
  )
}

export default function Log() {
  const runs = useLiveQuery(() => db.runs.orderBy('date').reverse().toArray(), [])
  const [showAddForm, setShowAddForm] = useState(false)

  if (!runs) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-500">Loading log…</p>
      </div>
    )
  }

  const groups = groupByMonth(runs)

  return (
    <div className="flex flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-100">Log</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950"
        >
          + Add run
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
          No runs logged yet. Tap "Add run" to log your first one.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                {monthLabel(group.key)}
              </h2>
              <p className="text-xs text-neutral-500">
                {group.totalKm.toFixed(1)} km · {formatDuration(group.totalSeconds)} · {group.runs.length}{' '}
                {group.runs.length === 1 ? 'run' : 'runs'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {group.runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          </section>
        ))
      )}

      {showAddForm && (
        <Modal title="Log a run" onClose={() => setShowAddForm(false)}>
          <LogRunForm
            session={null}
            onSaved={() => setShowAddForm(false)}
            onCancel={() => setShowAddForm(false)}
          />
        </Modal>
      )}
    </div>
  )
}
