import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatDisplayDate, todayISO } from '../lib/dates'
import { formatDuration, formatPace, formatPaceRange } from '../lib/paceZones'
import { equivalentTimes } from '../lib/vdot'
import {
  DEFAULT_A_GOAL_SECONDS,
  halfGateTarget,
  marathonVdot,
  suggestBGoalSeconds,
  tenKGateTarget,
  type CriterionStatus,
  type GapLevel,
  type GoalEngineState,
} from '../lib/goalEngine'
import { useGoalEngine } from '../lib/useGoalEngine'
import type { FitnessTest, Goal } from '../types'
import DurationInput from './DurationInput'
import Modal from './Modal'

const card = 'rounded-2xl border border-border bg-surface p-4'
const primaryButton = 'min-h-10 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40'
const secondaryButton = 'min-h-10 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted'
const inputClass = 'w-full rounded-xl border border-border bg-surface-inset px-3 py-2 text-sm text-ink'

async function updateGoal(changes: Partial<Goal>) {
  const existing = await db.goals.get('goal')
  const now = new Date().toISOString()
  if (existing) await db.goals.update('goal', { ...changes, updatedAt: now })
  else await db.goals.put({ id: 'goal', targetTimeSeconds: DEFAULT_A_GOAL_SECONDS, updatedAt: now, ...changes })
}

function Row({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-right">
        <span className="text-sm font-medium text-ink">{value}</span>
        {sub && <span className="block text-[11px] text-ink-faint">{sub}</span>}
      </span>
    </div>
  )
}

const GAP_STYLE: Record<GapLevel, string> = {
  none: 'border-accent/40 bg-accent/10 text-accent',
  stretch: 'border-warning/40 bg-warning/10 text-warning',
  acknowledge: 'border-warning/60 bg-warning/15 text-warning',
  aspirational: 'border-danger/40 bg-danger/10 text-danger',
}

const GAP_TEXT: Record<GapLevel, string> = {
  none: 'Your A goal is in line with current fitness.',
  stretch: 'Stretch — within reach with good training, but not yet shown.',
  acknowledge: 'Big stretch — your A goal is 3–5 VDOT above current fitness.',
  aspirational: 'Aspirational — training stays paced to current fitness.',
}

function GapIndicator({ engine, goal }: { engine: GoalEngineState; goal: Goal | undefined }) {
  const { gap, gapVdot, goals } = engine
  const acknowledged = goal?.gapAcknowledgedForSeconds === goals.aSeconds
  return (
    <div className={`rounded-xl border p-3 text-sm ${GAP_STYLE[gap]}`}>
      <p className="font-medium">
        {gap === 'none' ? 'On target' : `Gap: ${gapVdot.toFixed(1)} VDOT`}
      </p>
      <p className="mt-0.5">{GAP_TEXT[gap]}</p>
      {gap === 'acknowledge' &&
        (acknowledged ? (
          <p className="mt-1 text-xs">Acknowledged — the gates will decide whether A-goal pace unlocks.</p>
        ) : (
          <button
            onClick={() => updateGoal({ gapAcknowledgedForSeconds: goals.aSeconds })}
            className="mt-2 rounded-full border border-current px-3 py-1 text-xs font-semibold"
          >
            I understand — keep this A goal
          </button>
        ))}
    </div>
  )
}

const DISTANCE_PRESETS = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half', km: 21.0975 },
]

function FitnessTestForm({ onDone }: { onDone: () => void }) {
  const [date, setDate] = useState(todayISO())
  const [distanceKm, setDistanceKm] = useState('10')
  const [seconds, setSeconds] = useState(0)
  const [kind, setKind] = useState<FitnessTest['kind']>('time-trial')
  const distance = Number(distanceKm)
  const canSave = distance >= 1 && seconds > 0 && date.length === 10

  async function save() {
    if (!canSave) return
    const goal = await db.goals.get('goal')
    const tests = [...(goal?.fitnessTests ?? []), { id: crypto.randomUUID(), date, distanceKm: distance, durationSeconds: seconds, kind }]
    await updateGoal({ fitnessTests: tests })
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-full bg-surface-inset p-1">
        {(['time-trial', 'race'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`min-h-9 flex-1 rounded-full text-sm font-medium ${kind === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'}`}
          >
            {k === 'race' ? 'Race' : 'Time trial'}
          </button>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-faint">Date</label>
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-faint">Distance (km)</label>
        <div className="flex gap-2">
          {DISTANCE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDistanceKm(String(p.km))}
              className={`min-h-9 flex-1 rounded-full text-xs font-medium ${Number(distanceKm) === p.km ? 'bg-accent text-accent-fg' : 'border border-border text-ink-muted'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          className={`${inputClass} mt-2`}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-faint">Finish time</label>
        <DurationInput seconds={seconds} onChange={setSeconds} />
      </div>
      <p className="text-xs text-ink-faint">
        Races and time trials update current fitness immediately — the +1 VDOT per 4 weeks cap only applies to training runs.
      </p>
      <button onClick={save} disabled={!canSave} className={primaryButton}>
        Save result
      </button>
    </div>
  )
}

function FitnessCard({ engine, goal }: { engine: GoalEngineState; goal: Goal | undefined }) {
  const [adding, setAdding] = useState(false)
  const { fitness, currentVdot, provisional, zones } = engine
  const eq = equivalentTimes(currentVdot)
  const tests = (goal?.fitnessTests ?? []).slice().sort((a, b) => (a.date < b.date ? 1 : -1))

  async function removeTest(id: string) {
    await updateGoal({ fitnessTests: (goal?.fitnessTests ?? []).filter((t) => t.id !== id) })
  }

  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-ink-faint">Current fitness</h2>
      <p className="text-2xl font-semibold text-ink">VDOT {currentVdot.toFixed(1)}</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        {provisional || !fitness
          ? 'Provisional — no run of 3 km+ logged yet. Log one or enter a time trial.'
          : `From ${fitness.source.kind === 'run' ? 'your' : `your ${fitness.source.kind === 'race' ? 'race' : 'time trial'}:`} ${fitness.source.distanceKm} km on ${formatDisplayDate(fitness.source.date)} in ${formatDuration(fitness.source.durationSeconds)}.`}
      </p>
      {fitness?.capped && (
        <p className="mt-1 text-xs text-info">
          Recent runs suggest VDOT {fitness.uncappedVdot.toFixed(1)}. Automatic updates rise at most 1 VDOT per 4 weeks —
          a race or time trial moves it straight away.
        </p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
        {[
          ['5K', eq.fiveK],
          ['10K', eq.tenK],
          ['Half', eq.half],
          ['Marathon', eq.marathon],
        ].map(([label, secs]) => (
          <div key={label as string} className="rounded-xl bg-surface-inset p-2">
            <p className="text-[10px] uppercase text-ink-faint">{label}</p>
            <p className="mt-0.5 text-xs font-semibold text-ink">{formatDuration(secs as number)}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-border pt-2">
        <Row label="Easy / long" value={formatPaceRange(zones.easyPaceMinSecPerKm, zones.easyPaceMaxSecPerKm)} />
        <Row label="Tempo" value={formatPaceRange(zones.tempoPaceMinSecPerKm, zones.tempoPaceMaxSecPerKm)} />
        <Row
          label="Marathon-pace sessions"
          value={formatPace(zones.marathonPaceSecPerKm)}
          sub={engine.gateStatus.unlocked ? 'A-goal pace (gates passed)' : 'From current fitness until the gates pass'}
        />
        <Row
          label="Race-day plan"
          value={formatDuration(zones.raceGoalTimeSeconds)}
          sub={engine.gateStatus.unlocked ? 'A goal' : 'B goal'}
        />
      </div>

      {tests.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 text-xs text-ink-faint">Races & time trials</p>
          {tests.map((t) => (
            <div key={t.id} className="flex min-h-9 items-center justify-between gap-2 text-sm">
              <span className="text-ink-muted">
                {formatDisplayDate(t.date)} · {t.distanceKm} km · {formatDuration(t.durationSeconds)}
              </span>
              <button onClick={() => removeTest(t.id)} className="px-2 text-xs text-ink-faint" aria-label="Remove result">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setAdding(true)} className={`${secondaryButton} mt-3 w-full`}>
        Enter a race or time trial
      </button>

      {adding && (
        <Modal title="Race or time trial" onClose={() => setAdding(false)}>
          <FitnessTestForm onDone={() => setAdding(false)} />
        </Modal>
      )}
    </section>
  )
}

function GoalEditModal({
  which,
  engine,
  onClose,
}: {
  which: 'a' | 'b'
  engine: GoalEngineState
  onClose: () => void
}) {
  const current = which === 'a' ? engine.goals.aSeconds : engine.goals.bSeconds
  const [draft, setDraft] = useState(current)
  const changed = draft > 0 && draft !== current

  async function confirm() {
    if (!changed) return
    await updateGoal(which === 'a' ? { aGoalSeconds: draft } : { bGoalSeconds: draft })
    onClose()
  }

  const willChange =
    which === 'a'
      ? [
          `Gate targets: 10K ${formatDuration(tenKGateTarget(draft))}, half ${formatDuration(halfGateTarget(draft))}`,
          `Goal gap: ${(marathonVdot(draft) - engine.currentVdot).toFixed(1)} VDOT`,
          'Race-day pacing and MP sessions — but only once the gates are passed',
        ]
      : ['Race-day pacing plan while the A goal is still locked']

  return (
    <Modal title={which === 'a' ? 'Edit A goal' : 'Edit B goal'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <DurationInput seconds={current} onChange={setDraft} />
        {which === 'b' && (
          <p className="text-xs text-ink-faint">
            Suggested from current fitness: {formatDuration(suggestBGoalSeconds(engine.currentVdot))}
          </p>
        )}
        {changed && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="rounded-xl border border-border p-3">
              <p className="font-medium text-ink">Will change</p>
              <ul className="mt-1 list-disc pl-4 text-ink-muted">
                {willChange.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="font-medium text-ink">Won't change</p>
              <ul className="mt-1 list-disc pl-4 text-ink-muted">
                <li>Easy, long-run and tempo paces (always from current fitness)</li>
                <li>Your plan's weekly volume and sessions</li>
                <li>Logged runs, session outcomes and achievements</li>
              </ul>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className={`${secondaryButton} flex-1`}>
            Cancel
          </button>
          <button onClick={confirm} disabled={!changed} className={`${primaryButton} flex-1`}>
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}

const STATUS_ICON: Record<CriterionStatus, { icon: string; className: string }> = {
  passed: { icon: '✓', className: 'bg-accent/20 text-accent' },
  failed: { icon: '✕', className: 'bg-danger/20 text-danger' },
  pending: { icon: '·', className: 'bg-surface-inset text-ink-faint' },
}

function StatusDot({ status }: { status: CriterionStatus }) {
  const s = STATUS_ICON[status]
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s.className}`}>
      {s.icon}
    </span>
  )
}

function GatesCard({ engine }: { engine: GoalEngineState }) {
  const { gateStatus } = engine
  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-ink-faint">Earn the faster target</h2>
      <p className="mb-3 text-xs text-ink-faint">
        Pass every gate and A-goal pace unlocks for marathon-pace sessions and race day.
      </p>
      <ul className="flex flex-col gap-3">
        {gateStatus.gates.map((g) => (
          <li key={g.id} className="flex gap-3">
            <StatusDot status={g.status} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-ink">
                {g.label} · weeks {g.weeks[0]}–{g.weeks[1]}
              </p>
              <p className="text-xs text-ink-muted">
                Target {formatDuration(g.targetSeconds)}
                {g.result && ` · you ran ${formatDuration(g.result.durationSeconds)} (${g.result.distanceKm} km)`}
                {!g.result && g.status === 'failed' && ' · no result logged in the window'}
              </p>
              {g.recommendedGoalSeconds && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface-inset p-2">
                  <span className="text-xs text-ink-muted">
                    Your result supports a {formatDuration(g.recommendedGoalSeconds)} marathon.
                  </span>
                  <button
                    onClick={() => updateGoal({ aGoalSeconds: g.recommendedGoalSeconds })}
                    className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-fg"
                  >
                    Adopt as A goal
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
        {gateStatus.criteria.map((c) => (
          <li key={c.id} className="flex gap-3">
            <StatusDot status={c.status} />
            <div className="text-sm">
              <p className="font-medium text-ink">{c.label}</p>
              <p className="text-xs text-ink-muted">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {gateStatus.unlocked && (
        <p className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm font-medium text-accent">
          Unlocked — A-goal pace now drives marathon-pace sessions and race day.
        </p>
      )}
    </section>
  )
}

export default function GoalSettings() {
  const engine = useGoalEngine()
  const goal = useLiveQuery(() => db.goals.get('goal'), [])
  const [editing, setEditing] = useState<'a' | 'b' | null>(null)
  if (!engine) return null
  const { goals } = engine

  return (
    <div className="flex flex-col gap-4">
      <FitnessCard engine={engine} goal={goal} />

      <section className={card}>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">Goals</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-faint">A goal · aspiration</p>
              <p className="text-lg font-semibold text-ink">{formatDuration(goals.aSeconds)}</p>
            </div>
            <button onClick={() => setEditing('a')} className={secondaryButton}>
              Edit
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-faint">B goal · {goals.bAuto ? 'auto from current fitness' : 'set by you'}</p>
              <p className="text-lg font-semibold text-ink">{formatDuration(goals.bSeconds)}</p>
            </div>
            <div className="flex gap-2">
              {!goals.bAuto && (
                <button onClick={() => updateGoal({ bGoalSeconds: undefined })} className="px-2 text-xs text-ink-faint">
                  Auto
                </button>
              )}
              <button onClick={() => setEditing('b')} className={secondaryButton}>
                Edit
              </button>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <GapIndicator engine={engine} goal={goal} />
        </div>
      </section>

      <GatesCard engine={engine} />

      {editing && <GoalEditModal which={editing} engine={engine} onClose={() => setEditing(null)} />}
    </div>
  )
}
