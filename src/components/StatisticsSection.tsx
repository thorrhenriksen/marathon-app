import { useMemo } from 'react'
import { addDays, formatDisplayDate } from '../lib/dates'
import { formatDuration, formatPace } from '../lib/paceZones'
import { computeAdherence } from '../lib/achievements'
import {
  findQualityRun,
  predictRaceTimes,
  classifyAdherence,
  computeLongRunProgressionRatio,
  classifyLongRunProgression,
  classifyMarathonGoal,
  computeOnTrackStatus,
  computeACWR,
  classifyACWR,
  shouldSuppressACWR,
  computePersonalRecords,
  type OnTrackTier,
  type ACWRBand,
} from '../lib/statistics'
import type { Run, Session, WeekMeta } from '../types'

interface StatisticsSectionProps {
  sessions: Session[]
  runs: Run[]
  weeks: WeekMeta[]
  goalSeconds: number
  today: string
}

const ON_TRACK_LABEL: Record<OnTrackTier, string> = {
  'on-track': 'On track',
  'slightly-behind': 'Slightly behind',
  behind: 'Behind',
}

const ON_TRACK_STYLE: Record<OnTrackTier, string> = {
  'on-track': 'border-accent/40 bg-accent/10 text-accent',
  'slightly-behind': 'border-warning/40 bg-warning/10 text-warning',
  behind: 'border-danger/40 bg-danger/10 text-danger',
}

const METRIC_LABEL: Record<'on-track' | 'slightly-behind' | 'behind', string> = {
  'on-track': 'On track',
  'slightly-behind': 'Slightly behind',
  behind: 'Behind',
}

const ACWR_LABEL: Record<ACWRBand, string> = {
  steady: 'Steady',
  ramping: 'Ramping up',
  spike: 'Big spike',
}

const ACWR_STYLE: Record<ACWRBand, string> = {
  steady: 'border-accent/40 bg-accent/10 text-accent',
  ramping: 'border-warning/40 bg-warning/10 text-warning',
  spike: 'border-danger/40 bg-danger/10 text-danger',
}

function PredictionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-inset/40 p-3 text-center">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-inset/40 p-3">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  )
}

export default function StatisticsSection({ sessions, runs, weeks, goalSeconds, today }: StatisticsSectionProps) {
  const qualityRun = useMemo(() => findQualityRun(runs, today), [runs, today])
  const predictions = useMemo(() => (qualityRun ? predictRaceTimes(qualityRun) : undefined), [qualityRun])

  const onTrack = useMemo(() => {
    if (!predictions) return undefined

    const trailingWeeks = weeks
      .filter((w) => w.startDate <= today)
      .sort((a, b) => b.week - a.week)
      .slice(0, 4)
    const trailingWeekNumbers = new Set(trailingWeeks.map((w) => w.week))
    const trailingSessions = sessions.filter((s) => trailingWeekNumbers.has(s.week))
    const adherence4wk = classifyAdherence(computeAdherence(trailingSessions, today))

    const longRunRatio = computeLongRunProgressionRatio(sessions, runs, today)
    const longRunProgression = classifyLongRunProgression(longRunRatio)

    const marathonRangeVsGoal = classifyMarathonGoal(goalSeconds, predictions.marathonLowSeconds, predictions.marathonHighSeconds)
    const tier = computeOnTrackStatus({ adherence4wk, longRunProgression, marathonRangeVsGoal })
    return { tier, adherence4wk, longRunProgression, marathonRangeVsGoal }
  }, [weeks, sessions, runs, today, predictions, goalSeconds])

  const acwr = useMemo(() => {
    const elapsedWeeks = weeks.filter((w) => w.startDate <= today).sort((a, b) => a.week - b.week)
    const weeklyDistancesKm = elapsedWeeks.map((w) => {
      const weekEnd = addDays(w.startDate, 6)
      return runs.filter((r) => r.date >= w.startDate && r.date <= weekEnd).reduce((sum, r) => sum + r.distanceKm, 0)
    })
    const currentWeek = elapsedWeeks[elapsedWeeks.length - 1]
    if (shouldSuppressACWR(weeklyDistancesKm.length, currentWeek)) return undefined
    const ratio = computeACWR(weeklyDistancesKm)
    if (ratio === undefined) return undefined
    return { ratio, band: classifyACWR(ratio) }
  }, [weeks, runs, today])

  const records = useMemo(() => computePersonalRecords(runs), [runs])
  const hasAnyRecord = !!(records.fiveKPlus || records.tenKPlus || records.longestRun)

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">Race predictor</h2>
        {!qualityRun || !predictions ? (
          <p className="text-sm text-ink-faint">
            No qualifying run in the last 6 weeks (3km+) — log one to see race-time predictions.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-ink-faint">
              Based on {qualityRun.distanceKm} km on {formatDisplayDate(qualityRun.date)} at{' '}
              {formatPace(qualityRun.paceSecPerKm)}.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <PredictionTile label="5K" value={formatDuration(predictions.fiveKSeconds)} />
              <PredictionTile label="10K" value={formatDuration(predictions.tenKSeconds)} />
              <PredictionTile label="Half" value={formatDuration(predictions.halfMarathonSeconds)} />
            </div>
            <div className="rounded-xl border border-border bg-surface-inset/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">Marathon (range)</p>
              <p className="mt-1 text-base font-semibold text-ink">
                {formatDuration(predictions.marathonLowSeconds)} – {formatDuration(predictions.marathonHighSeconds)}
              </p>
              <p className="mt-1 text-[11px] text-ink-faint">
                A range, not a single number — longer extrapolations carry more uncertainty (Vickers &amp; Vertosick,
                2016).
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">On track for goal</h2>
        {!onTrack ? (
          <p className="text-sm text-ink-faint">Log a quality run to see your on-track status.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <span
              className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${ON_TRACK_STYLE[onTrack.tier]}`}
            >
              {ON_TRACK_LABEL[onTrack.tier]}
            </span>
            <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-faint">
              <li>Adherence (last 4 weeks): {METRIC_LABEL[onTrack.adherence4wk]}</li>
              <li>Long-run progression: {METRIC_LABEL[onTrack.longRunProgression]}</li>
              <li>Goal vs predicted range: {METRIC_LABEL[onTrack.marathonRangeVsGoal]}</li>
            </ul>
          </div>
        )}
      </section>

      {acwr && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">Training load</h2>
          <span
            className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${ACWR_STYLE[acwr.band]}`}
          >
            {ACWR_LABEL[acwr.band]} · {acwr.ratio.toFixed(2)}x
          </span>
          <p className="mt-2 text-[11px] text-ink-faint">
            This week's volume vs. your trailing 4-week average — a guideline, not a diagnosis. Ramping up too fast is
            linked to higher injury risk.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">Personal records</h2>
        {!hasAnyRecord ? (
          <p className="text-sm text-ink-faint">No runs logged yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {records.fiveKPlus && (
              <RecordRow
                label="Best pace, 5K+"
                value={`${formatPace(records.fiveKPlus.bestPaceSecPerKm)} · ${records.fiveKPlus.distanceKm} km on ${formatDisplayDate(records.fiveKPlus.date)}`}
              />
            )}
            {records.tenKPlus && (
              <RecordRow
                label="Best pace, 10K+"
                value={`${formatPace(records.tenKPlus.bestPaceSecPerKm)} · ${records.tenKPlus.distanceKm} km on ${formatDisplayDate(records.tenKPlus.date)}`}
              />
            )}
            {records.longestRun && (
              <RecordRow
                label="Longest run"
                value={`${records.longestRun.distanceKm} km on ${formatDisplayDate(records.longestRun.date)}`}
              />
            )}
          </div>
        )}
      </section>
    </div>
  )
}
