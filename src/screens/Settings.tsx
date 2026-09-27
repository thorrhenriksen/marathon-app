import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatDisplayDate, todayISO } from '../lib/dates'
import { isStoragePersisted } from '../lib/storage'
import { computeAdjustment, type AdjustmentPreview } from '../lib/adjustmentEngine'
import { applyTimeOff } from '../db/timeOffAdjustments'
import { resetToOriginalPlan } from '../db/seed'
import type { CelebrationStyle, IconPack, TimeOff, TimeOffLabel } from '../types'
import Modal from '../components/Modal'
import AdjustmentSummaryModal from '../components/AdjustmentSummaryModal'
import GoalSettings from '../components/GoalSettings'
import { useTheme } from '../context/ThemeContext'
import type { ThemeUnlock, CardAccentUnlock } from '../lib/achievements'
import {
  DEFAULT_CELEBRATION_STYLE,
  DEFAULT_ICON_PACK,
  SHOP_ITEMS,
  ownsItem,
  shopItemId,
  type ShopCategory,
} from '../lib/coins'
import { celebrate } from '../lib/celebrate'
import { CARD_ACCENT_SWATCH, sessionDotColor } from '../lib/sessionColors'
import SessionMarker from '../components/SessionMarker'

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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">{title}</h2>
      {children}
    </section>
  )
}

const inputClass =
  'w-full rounded-xl border border-border bg-surface-inset px-3 py-2 text-sm text-ink'
const primaryButtonClass =
  'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg'
const secondaryButtonClass =
  'rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted'
const dangerButtonClass = 'rounded-full bg-danger px-4 py-2 text-sm font-semibold text-accent-fg'

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const UNLOCKABLE_THEME_OPTIONS: { value: ThemeUnlock; label: string }[] = [
  { value: 'dawn', label: 'Dawn' },
  { value: 'midnight', label: 'Midnight' },
]

const CARD_ACCENT_OPTIONS: { value: CardAccentUnlock; label: string }[] = [
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
]

const CELEBRATION_OPTIONS: { value: CelebrationStyle; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'fireworks', label: 'Fireworks' },
  { value: 'pulse', label: 'Minimal pulse' },
]

const ICON_PACK_OPTIONS: { value: IconPack; label: string }[] = [
  { value: 'dots', label: 'Classic dots' },
  { value: 'glyphs', label: 'Tiny glyphs' },
  { value: 'squares', label: 'Filled squares' },
]

function priceLabel(category: ShopCategory, value: string): string {
  const item = SHOP_ITEMS.find((i) => i.id === shopItemId(category, value))
  return item ? `${item.price} 🪙 in the shop` : ''
}

function usePurchases() {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  return { settings, purchases: settings?.shopPurchases ?? [] }
}

function pillClass(active: boolean, owned: boolean): string {
  return active
    ? 'bg-accent text-accent-fg'
    : owned
      ? 'border border-border text-ink-muted'
      : 'border border-border text-ink-faint opacity-50'
}

function ThemeSection() {
  const { theme, setTheme } = useTheme()
  const { purchases } = usePurchases()

  return (
    <SectionCard title="Appearance">
      <div className="flex gap-2">
        {THEME_OPTIONS.map((option) => {
          const active = theme === option.value
          return (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`min-h-9 flex-1 rounded-full px-3 py-2 text-xs font-medium ${pillClass(active, true)}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        {UNLOCKABLE_THEME_OPTIONS.map((option) => {
          const owned = ownsItem('theme', option.value, purchases)
          const active = theme === option.value
          return (
            <div key={option.value} className="flex items-center justify-between gap-2">
              <button
                onClick={() => owned && setTheme(option.value)}
                disabled={!owned}
                className={`min-h-9 flex-1 rounded-full px-3 py-2 text-left text-xs font-medium ${pillClass(active, owned)}`}
              >
                {option.label}
              </button>
              {!owned && <span className="text-[11px] text-ink-faint">{priceLabel('theme', option.value)}</span>}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

function CardAccentSection() {
  const { settings, purchases } = usePurchases()

  async function selectAccent(accent: CardAccentUnlock | undefined) {
    await db.settings.update('settings', { cardAccent: accent })
  }

  return (
    <SectionCard title="Card accent">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => selectAccent(undefined)}
          className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium text-ink-muted ${
            !settings?.cardAccent ? 'border-accent' : 'border-border'
          }`}
        >
          <span className="h-3 w-3 shrink-0 rounded-full border border-border" />
          None
        </button>
        {CARD_ACCENT_OPTIONS.map((option) => {
          const owned = ownsItem('accent', option.value, purchases)
          const active = settings?.cardAccent === option.value
          return (
            <button
              key={option.value}
              onClick={() => owned && selectAccent(option.value)}
              disabled={!owned}
              className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium ${
                active ? 'border-accent' : 'border-border'
              } ${owned ? 'text-ink-muted' : 'text-ink-faint opacity-50'}`}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${CARD_ACCENT_SWATCH[option.value]}`} />
              <span className="flex flex-col">
                {option.label}
                {!owned && <span className="text-[10px] text-ink-faint">{priceLabel('accent', option.value)}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}

function CosmeticsSection() {
  const { settings, purchases } = usePurchases()
  const celebrationStyle = settings?.celebrationStyle ?? DEFAULT_CELEBRATION_STYLE
  const iconPack = settings?.iconPack ?? DEFAULT_ICON_PACK

  return (
    <SectionCard title="Celebrations & icons">
      <p className="mb-2 text-xs text-ink-faint">Celebration style</p>
      <div className="flex flex-col gap-2">
        {CELEBRATION_OPTIONS.map((option) => {
          const owned = ownsItem('celebration', option.value, purchases)
          const active = celebrationStyle === option.value
          return (
            <div key={option.value} className="flex items-center gap-2">
              <button
                onClick={() => owned && db.settings.update('settings', { celebrationStyle: option.value })}
                disabled={!owned}
                className={`min-h-9 flex-1 rounded-full px-3 py-2 text-left text-xs font-medium ${pillClass(active, owned)}`}
              >
                {option.label}
              </button>
              {owned ? (
                <button onClick={() => celebrate({ style: option.value })} className="px-2 text-[11px] font-medium text-ink-muted">
                  Preview
                </button>
              ) : (
                <span className="text-[11px] text-ink-faint">{priceLabel('celebration', option.value)}</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 mb-2 text-xs text-ink-faint">Calendar icon pack</p>
      <div className="flex flex-col gap-2">
        {ICON_PACK_OPTIONS.map((option) => {
          const owned = ownsItem('icons', option.value, purchases)
          const active = iconPack === option.value
          return (
            <div key={option.value} className="flex items-center gap-2">
              <button
                onClick={() => owned && db.settings.update('settings', { iconPack: option.value })}
                disabled={!owned}
                className={`flex min-h-9 flex-1 items-center justify-between rounded-full px-3 py-2 text-left text-xs font-medium ${pillClass(active, owned)}`}
              >
                {option.label}
                <span className="flex items-center gap-1">
                  {(['easy', 'long', 'tempo', 'strength'] as const).map((t) => (
                    <SessionMarker key={t} type={t} colorClass={active ? 'bg-accent-fg' : sessionDotColor(t)} pack={option.value} />
                  ))}
                </span>
              </button>
              {!owned && <span className="text-[11px] text-ink-faint">{priceLabel('icons', option.value)}</span>}
            </div>
          )
        })}
      </div>
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
  const [selectedTimeOff, setSelectedTimeOff] = useState<TimeOff | null>(null)
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

    await applyTimeOff(pendingTimeOff, preview, previousSessions)

    setPreview(null)
    setPendingTimeOff(null)
    setNote('')
  }

  function handleCancelPreview() {
    setPreview(null)
    setPendingTimeOff(null)
  }

  return (
    <SectionCard title="Time off">
      {timeOffEntries && timeOffEntries.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {timeOffEntries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setSelectedTimeOff(entry)}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-inset px-3 py-2 text-left text-xs"
            >
              <span className="text-ink-muted">
                {formatDisplayDate(entry.startDate)} – {formatDisplayDate(entry.endDate)}
              </span>
              <span className="text-ink-faint">{TIME_OFF_LABELS[entry.label]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ink-faint">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ink-faint">End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-faint">Reason</label>
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
          <label className="mb-1 block text-xs text-ink-faint">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button onClick={handlePreview} className={`${primaryButtonClass} mt-1`}>
          Preview adjustment
        </button>
      </div>

      {preview && (
        <Modal title="Confirm plan adjustment" onClose={handleCancelPreview}>
          <div className="flex flex-col gap-3">
            {preview.summary.length === 0 ? (
              <p className="text-sm text-ink-muted">No sessions fall within this range.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm text-ink-muted">
                {preview.summary.map((line, i) => (
                  <li key={i} className="rounded-lg border border-border bg-surface-inset p-2">
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

      {selectedTimeOff && (
        <AdjustmentSummaryModal
          timeOff={selectedTimeOff}
          onClose={() => setSelectedTimeOff(null)}
          onRemoved={() => setSelectedTimeOff(null)}
        />
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
                active ? 'bg-accent text-accent-fg' : 'border border-border text-ink-muted'
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

const DEFAULT_REST_TIMER_SECONDS = 45

function GuidedSessionPreferencesSection() {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  if (!settings) return null

  const restTimerSeconds = settings.restTimerSeconds ?? DEFAULT_REST_TIMER_SECONDS
  const audioCueEnabled = settings.audioCueEnabled ?? true
  const wakeLockEnabled = settings.wakeLockEnabled ?? true

  return (
    <SectionCard title="Guided strength session">
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs text-ink-faint">Rest timer (seconds)</label>
          <input
            type="number"
            min={0}
            step={5}
            value={restTimerSeconds}
            onChange={(e) => db.settings.update('settings', { restTimerSeconds: Number(e.target.value) || 0 })}
            className={inputClass}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Audio cue at end of rest</span>
          <button
            onClick={() => db.settings.update('settings', { audioCueEnabled: !audioCueEnabled })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              audioCueEnabled ? 'bg-accent text-accent-fg' : 'border border-border text-ink-muted'
            }`}
          >
            {audioCueEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Keep screen awake</span>
          <button
            onClick={() => db.settings.update('settings', { wakeLockEnabled: !wakeLockEnabled })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              wakeLockEnabled ? 'bg-accent text-accent-fg' : 'border border-border text-ink-muted'
            }`}
          >
            {wakeLockEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

function BackupSection() {
  const [message, setMessage] = useState<string | null>(null)
  const [storagePersisted, setStoragePersisted] = useState(true)

  useEffect(() => {
    isStoragePersisted().then(setStoragePersisted)
  }, [])

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
        {message && <p className="text-xs text-ink-muted">{message}</p>}
        {!storagePersisted && (
          <p className="text-xs text-warning">
            Storage isn't guaranteed by the browser — keep backups in case data is evicted.
          </p>
        )}
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
      <p className="mb-3 text-xs text-ink-faint">
        Resets your training plan and completion status back to the original 35-week schedule. Logged
        runs, your goal, time-off history, and preferences are not affected.
      </p>
      <button onClick={() => setShowConfirm(true)} className={dangerButtonClass}>
        Reset to original plan
      </button>
      {resetDone && <p className="mt-2 text-xs text-accent">Plan reset.</p>}

      {showConfirm && (
        <Modal title="Reset to original plan?" onClose={() => setShowConfirm(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">
              This replaces all planned sessions and week data with the original 35-week schedule. Any
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
      <h1 className="text-lg font-semibold text-ink">Settings</h1>
      <GoalSettings />
      <TimeOffSection />
      <PreferredDaysSection />
      <GuidedSessionPreferencesSection />
      <ThemeSection />
      <CardAccentSection />
      <CosmeticsSection />
      <BackupSection />
      <ResetPlanSection />
    </div>
  )
}
