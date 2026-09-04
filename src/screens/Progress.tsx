import { useEffect, useMemo, useState } from 'react'
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
import { computeAchievements, computeStreaks, computeAdherence, type Achievement } from '../lib/achievements'
import type { Run, Session, WeekMeta } from '../types'

const GRID_COLOR = 'var(--chart-grid)'
const AXIS_COLOR = 'var(--chart-axis)'
const PLANNED_COLOR = 'var(--chart-planned)'
const ACTUAL_COLOR = 'var(--chart-actual)'
const LONG_RUN_COLOR = 'var(--chart-long-run)'
const PACE_COLOR = 'var(--chart-pace)'
const TOOLTIP_BG = 'var(--chart-tooltip-bg)'
const TOOLTIP_BORDER = 'var(--chart-tooltip-border)'
const TOOLTIP_TEXT = 'var(--chart-tooltip-text)'

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

function computeStrengthAdherence(
  sessions: Session[],
  today: string,
): { completed: number; planned: number; streak: number } {
  const elapsed = sessions
    .filter((s) => s.type === 'strength' && s.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const planned = elapsed.length
  const completed = elapsed.filter((s) => s.status === 'completed').length

  let streak = 0
  for (let i = elapsed.length - 1; i >= 0; i--) {
    if (elapsed[i].status === 'completed') streak++
    else break
  }

  return { completed, planned, streak }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-[11px] text-ink-faint">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function AchievementBanner({ achievement, onDismiss }: { achievement: Achievement; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Achievement unlocked</p>
        <p className="mt-1 text-sm font-semibold text-ink">{achievement.title}</p>
      </div>
      <button onClick={onDismiss} className="shrink-0 text-xs font-medium text-ink-faint">
        Dismiss
      </button>
    </div>
  )
}

function AchievementTile({ achievement }: { achievement: Achievement }) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        achievement.unlocked ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface-inset opacity-50'
      }`}
    >
      <p className={`text-[11px] font-medium ${achievement.unlocked ? 'text-ink' : 'text-ink-faint'}`}>
        {achievement.unlocked ? achievement.title : '???'}
      </p>
      <p className="mt-0.5 text-[10px] text-ink-faint">
        {achievement.unlocked ? (achievement.progress ?? achievement.condition) : achievement.condition}
      </p>
    </div>
  )
}

function AchievementsSection({
  achievements,
  isExpanded,
  hasUnseenUnlock,
  onToggle,
}: {
  achievements: Achievement[]
  isExpanded: boolean
  hasUnseenUnlock: boolean
  onToggle: () => void
}) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          Achievements — {unlockedCount} of {achievements.length} unlocked
          {!isExpanded && hasUnseenUnlock && <span className="h-2 w-2 rounded-full bg-accent" />}
        </span>
        <span className={`shrink-0 text-ink-faint transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {isExpanded && (
        <div className="grid grid-cols-3 gap-1.5 px-4 pb-4">
          {achievements.map((achievement) => (
            <AchievementTile key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function Progress() {
  const today = todayISO()
  const weeks = useLiveQuery(() => db.weeks.orderBy('week').toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const runs = useLiveQuery(() => db.runs.orderBy('date').toArray(), [])
  const timeOffEntries = useLiveQuery(() => db.timeOff.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get('settings'), [])

  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([])

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
    () =>
      weeks && sessions && timeOffEntries
        ? computeStreaks(sessions, weeks, timeOffEntries, today)
        : { current: 0, longest: 0 },
    [weeks, sessions, timeOffEntries, today],
  )
  const adherence = useMemo(
    () => (sessions ? computeAdherence(sessions, today) : 0),
    [sessions, today],
  )
  const strengthAdherence = useMemo(
    () => (sessions ? computeStrengthAdherence(sessions, today) : { completed: 0, planned: 0, streak: 0 }),
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

  const achievements = useMemo(
    () =>
      weeks && sessions && runs && timeOffEntries
        ? computeAchievements({ sessions, runs, weeks, timeOffEntries, today })
        : [],
    [weeks, sessions, runs, timeOffEntries, today],
  )

  useEffect(() => {
    if (!settings || achievements.length === 0) return
    const shown = new Set(settings.shownAchievementIds ?? [])
    const unlocked = achievements.filter((a) => a.unlocked && !shown.has(a.id))
    if (unlocked.length === 0) return
    setNewlyUnlocked((prev) => [...prev, ...unlocked])
    const nextShown = [...shown, ...unlocked.map((a) => a.id)]
    db.settings.update('settings', { shownAchievementIds: nextShown, achievementsHasUnseenUnlock: true })
    // Only re-run when the achievement set itself changes, not on every settings write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievements, settings?.id])

  function dismissBanner(id: string) {
    setNewlyUnlocked((prev) => prev.filter((a) => a.id !== id))
  }

  const achievementsExpanded = settings?.achievementsExpanded ?? false

  function toggleAchievements() {
    const next = !achievementsExpanded
    db.settings.update('settings', { achievementsExpanded: next, ...(next ? { achievementsHasUnseenUnlock: false } : {}) })
  }

  if (!weeks || !sessions || !runs) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-ink-faint">Loading progress…</p>
      </div>
    )
  }

  const hasRuns = runs.length > 0

  return (
    <div className="flex flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      <h1 className="text-lg font-semibold text-ink">Progress</h1>

      {newlyUnlocked.map((achievement) => (
        <AchievementBanner
          key={achievement.id}
          achievement={achievement}
          onDismiss={() => dismissBanner(achievement.id)}
        />
      ))}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total distance" value={`${totalKm.toFixed(1)} km`} />
        <StatCard label="Sessions completed" value={`${totalSessionsCompleted}`} />
        <StatCard label="Plan adherence" value={`${adherence}%`} />
        <StatCard label="Current streak" value={`${streaks.current} ${streaks.current === 1 ? 'week' : 'weeks'}`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Best streak" value={`${streaks.longest} ${streaks.longest === 1 ? 'week' : 'weeks'}`} />
        <StatCard
          label="Strength adherence"
          value={`${strengthAdherence.completed}/${strengthAdherence.planned} · ${strengthAdherence.streak} streak`}
        />
      </div>

      {!hasRuns ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-faint">
          No runs logged yet. Charts will appear here once you start logging runs.
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">
              Weekly volume
            </h2>
            <div className="rounded-2xl border border-border bg-surface p-4">
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
                    contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, fontSize: 12 }}
                    labelStyle={{ color: TOOLTIP_TEXT }}
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
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">
              Long run progression
            </h2>
            <div className="rounded-2xl border border-border bg-surface p-4">
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
                    contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, fontSize: 12 }}
                    labelStyle={{ color: TOOLTIP_TEXT }}
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
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">
              Pace trend (easy runs)
            </h2>
            {paceTrend.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-faint">
                No easy runs logged yet.
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-4">
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
                      contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, fontSize: 12 }}
                      labelStyle={{ color: TOOLTIP_TEXT }}
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

      <AchievementsSection
        achievements={achievements}
        isExpanded={achievementsExpanded}
        hasUnseenUnlock={settings?.achievementsHasUnseenUnlock ?? false}
        onToggle={toggleAchievements}
      />
    </div>
  )
}
