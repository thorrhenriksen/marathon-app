import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../db/db'
import { addDays, todayISO } from '../lib/dates'
import { formatPace } from '../lib/paceZones'
import type { Run, Session, WeekMeta } from '../types'

const GRID_COLOR = '#262626'
const AXIS_COLOR = '#737373'
const PLANNED_COLOR = '#525252'
const ACTUAL_COLOR = '#10b981'
const LONG_RUN_COLOR = '#0ea5e9'
const PACE_COLOR = '#f59e0b'

interface WeeklyVolumePoint {
  label: string
  planned: number
  actual: number
}

interface LongRunPoint {
  label: string
  planned: number
  actual: number | null
}

interface PacePoint {
  date: string
  paceSecPerKm: number
}

function findRunForSession(session: Session, runs: Run[]): Run | undefined {
  if (session.linkedRunId) {
    const byId = runs.find((r) => r.id === session.linkedRunId)
    if (byId) return byId
  }
  return (
    runs.find((r) => r.linkedSessionId === session.id) ??
    runs.find((r) => r.date === session.date && r.type === session.type)
  )
}

function buildWeeklyVolume(weeks: WeekMeta[], runs: Run[]): WeeklyVolumePoint[] {
  return weeks
    .slice()
    .sort((a, b) => a.week - b.week)
    .map((week) => {
      const weekEnd = addDays(week.startDate, 6)
      const actual = runs
        .filter((r) => r.date >= week.startDate && r.date <= weekEnd)
        .reduce((sum, r) => sum + r.distanceKm, 0)
      return {
        label: `W${week.week}`,
        planned: Math.round(week.targetVolumeKm * 10) / 10,
        actual: Math.round(actual * 10) / 10,
      }
    })
}

function buildLongRunProgression(weeks: WeekMeta[], sessions: Session[], runs: Run[]): LongRunPoint[] {
  return weeks
    .slice()
    .sort((a, b) => a.week - b.week)
    .map((week) => {
      const longSession = sessions.find(
        (s) => s.week === week.week && (s.type === 'long' || s.type === 'race'),
      )
      if (!longSession) {
        return { label: `W${week.week}`, planned: 0, actual: null }
      }
      const run = findRunForSession(longSession, runs)
      return {
        label: `W${week.week}`,
        planned: longSession.plannedDistanceKm,
        actual: run ? Math.round(run.distanceKm * 10) / 10 : null,
      }
    })
}

function buildPaceTrend(runs: Run[]): PacePoint[] {
  return runs
    .filter((r) => r.type === 'easy' && r.paceSecPerKm > 0)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({ date: r.date, paceSecPerKm: Math.round(r.paceSecPerKm) }))
}

function computeStreaks(weeks: WeekMeta[], sessions: Session[], today: string) {
  const sessionsByWeek = new Map<number, Session[]>()
  for (const s of sessions) {
    if (s.type === 'rest') continue
    const list = sessionsByWeek.get(s.week)
    if (list) list.push(s)
    else sessionsByWeek.set(s.week, [s])
  }

  const elapsedWeeks = weeks
    .filter((w) => addDays(w.startDate, 6) < today)
    .sort((a, b) => a.week - b.week)

  const completedFlags = elapsedWeeks.map((w) => {
    const weekSessions = sessionsByWeek.get(w.week) ?? []
    if (weekSessions.length === 0) return false
    return weekSessions.every((s) => s.status === 'completed')
  })

  let best = 0
  let running = 0
  for (const flag of completedFlags) {
    running = flag ? running + 1 : 0
    best = Math.max(best, running)
  }

  let current = 0
  for (let i = completedFlags.length - 1; i >= 0; i--) {
    if (completedFlags[i]) current++
    else break
  }

  return { current, best }
}

function computeAdherence(sessions: Session[], today: string): number {
  const elapsed = sessions.filter((s) => s.type !== 'rest' && s.date <= today)
  if (elapsed.length === 0) return 0
  const completed = elapsed.filter((s) => s.status === 'completed').length
  return Math.round((completed / elapsed.length) * 100)
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-50">{value}</p>
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-[11px] text-neutral-500">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function Progress() {
  const today = todayISO()
  const weeks = useLiveQuery(() => db.weeks.orderBy('week').toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const runs = useLiveQuery(() => db.runs.orderBy('date').toArray(), [])

  const weeklyVolume = useMemo(
    () => (weeks && runs ? buildWeeklyVolume(weeks, runs) : []),
    [weeks, runs],
  )
  const longRunProgression = useMemo(
    () => (weeks && sessions && runs ? buildLongRunProgression(weeks, sessions, runs) : []),
    [weeks, sessions, runs],
  )
  const paceTrend = useMemo(() => (runs ? buildPaceTrend(runs) : []), [runs])
  const streaks = useMemo(
    () => (weeks && sessions ? computeStreaks(weeks, sessions, today) : { current: 0, best: 0 }),
    [weeks, sessions, today],
  )
  const adherence = useMemo(
    () => (sessions ? computeAdherence(sessions, today) : 0),
    [sessions, today],
  )
  const totalKm = useMemo(
    () => (runs ? runs.reduce((sum, r) => sum + r.distanceKm, 0) : 0),
    [runs],
  )
  const totalSessionsCompleted = useMemo(
    () => (sessions ? sessions.filter((s) => s.status === 'completed').length : 0),
    [sessions],
  )

  if (!weeks || !sessions || !runs) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-500">Loading progress…</p>
      </div>
    )
  }

  const hasRuns = runs.length > 0

  return (
    <div className="flex flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      <h1 className="text-lg font-semibold text-neutral-100">Progress</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total distance" value={`${totalKm.toFixed(1)} km`} />
        <StatCard label="Sessions completed" value={`${totalSessionsCompleted}`} />
        <StatCard label="Plan adherence" value={`${adherence}%`} />
        <StatCard label="Current streak" value={`${streaks.current} ${streaks.current === 1 ? 'week' : 'weeks'}`} />
      </div>

      <StatCard label="Best streak" value={`${streaks.best} ${streaks.best === 1 ? 'week' : 'weeks'}`} />

      {!hasRuns ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
          No runs logged yet. Charts will appear here once you start logging runs.
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Weekly volume
            </h2>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyVolume}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                    axisLine={{ stroke: GRID_COLOR }}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: '1px solid #262626', fontSize: 12 }}
                    labelStyle={{ color: '#e5e5e5' }}
                    formatter={(value, name) => [`${value} km`, name === 'planned' ? 'Planned' : 'Actual']}
                  />
                  <Bar dataKey="planned" fill={PLANNED_COLOR} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" fill={ACTUAL_COLOR} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Legend items={[{ color: PLANNED_COLOR, label: 'Planned' }, { color: ACTUAL_COLOR, label: 'Actual' }]} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Long run progression
            </h2>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={longRunProgression}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                    axisLine={{ stroke: GRID_COLOR }}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: '1px solid #262626', fontSize: 12 }}
                    labelStyle={{ color: '#e5e5e5' }}
                    formatter={(value, name) => [`${value} km`, name === 'planned' ? 'Planned' : 'Actual']}
                  />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    stroke={PLANNED_COLOR}
                    strokeDasharray="4 3"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={LONG_RUN_COLOR}
                    dot={{ r: 2, fill: LONG_RUN_COLOR }}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <Legend items={[{ color: PLANNED_COLOR, label: 'Planned' }, { color: LONG_RUN_COLOR, label: 'Actual' }]} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Pace trend (easy runs)
            </h2>
            {paceTrend.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-500">
                No easy runs logged yet.
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={paceTrend}>
                    <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                      axisLine={{ stroke: GRID_COLOR }}
                      tickLine={false}
                      tickFormatter={(value: string) => value.slice(5)}
                    />
                    <YAxis
                      tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      tickFormatter={(value: number) => formatPace(value)}
                    />
                    <Tooltip
                      contentStyle={{ background: '#171717', border: '1px solid #262626', fontSize: 12 }}
                      labelStyle={{ color: '#e5e5e5' }}
                      formatter={(value) => [formatPace(Number(value)), 'Pace']}
                    />
                    <Line
                      type="monotone"
                      dataKey="paceSecPerKm"
                      stroke={PACE_COLOR}
                      dot={{ r: 2, fill: PACE_COLOR }}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
