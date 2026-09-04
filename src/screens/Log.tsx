import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatDisplayDate, parseISODate } from '../lib/dates'
import { formatDuration, formatPace } from '../lib/paceZones'
import type { Run, SessionType } from '../types'
import Modal from '../components/Modal'
import LogRunForm from '../components/LogRunForm'
import WeekAgenda from '../components/WeekAgenda'

type TrainViewTab = 'week' | 'log'

function TrainTabs({ tab, onChange }: { tab: TrainViewTab; onChange: (tab: TrainViewTab) => void }) {
  return (
    <div className="flex rounded-full bg-surface-inset p-1">
      {(['week', 'log'] as TrainViewTab[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`flex-1 rounded-full py-1.5 text-sm font-medium capitalize ${
            tab === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

const TYPE_LABELS: Record<SessionType | 'other', string> = {
  easy: 'Easy',
  long: 'Long',
  tempo: 'Tempo',
  'marathon-pace': 'MP',
  strides: 'Strides',
  race: 'Race',
  rest: 'Rest',
  strength: 'Strength',
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

function RunRow({ run, onSelect }: { run: Run; onSelect: (run: Run) => void }) {
  return (
    <button
      onClick={() => onSelect(run)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left"
    >
      <div className="flex w-14 shrink-0 flex-col items-start">
        <span className="text-[11px] uppercase text-ink-faint">
          {formatDisplayDate(run.date).slice(0, 3)}
        </span>
        <span className="text-xs font-medium text-ink-muted">{TYPE_LABELS[run.type]}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-ink">{run.distanceKm} km</span>
          <span className="text-xs text-ink-faint">{formatDuration(run.durationSeconds)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
          <span>{formatPace(run.paceSecPerKm)}</span>
          <span>·</span>
          <span>Effort {run.effort}/10</span>
        </div>
        {run.note && <p className="mt-1 truncate text-xs text-ink-muted">{run.note}</p>}
      </div>
    </button>
  )
}

export default function Log() {
  const runs = useLiveQuery(() => db.runs.orderBy('date').reverse().toArray(), [])
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)

  const tab: TrainViewTab = settings?.trainViewTab ?? 'week'

  function setTab(next: TrainViewTab) {
    db.settings.update('settings', { trainViewTab: next })
  }

  if (!runs) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-ink-faint">Loading…</p>
      </div>
    )
  }

  const groups = groupByMonth(runs)

  return (
    <div className="flex flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Train</h1>
        {tab === 'log' && (
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
          >
            + Add run
          </button>
        )}
      </div>

      <TrainTabs tab={tab} onChange={setTab} />

      {tab === 'week' ? (
        <WeekAgenda />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-faint">
              No runs logged yet. Tap "Add run" to log your first one.
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">
                    {monthLabel(group.key)}
                  </h2>
                  <p className="text-xs text-ink-faint">
                    {group.totalKm.toFixed(1)} km · {formatDuration(group.totalSeconds)} · {group.runs.length}{' '}
                    {group.runs.length === 1 ? 'run' : 'runs'}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {group.runs.map((run) => (
                    <RunRow key={run.id} run={run} onSelect={setSelectedRun} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
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

      {selectedRun && (
        <Modal title="Edit run" onClose={() => setSelectedRun(null)}>
          <LogRunForm
            run={selectedRun}
            onSaved={() => setSelectedRun(null)}
            onCancel={() => setSelectedRun(null)}
          />
        </Modal>
      )}
    </div>
  )
}
