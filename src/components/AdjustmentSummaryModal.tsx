import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatDisplayDate } from '../lib/dates'
import { previewReversal } from '../lib/adjustmentPersistence'
import { reverseTimeOff } from '../db/timeOffAdjustments'
import type { TimeOff, TimeOffLabel } from '../types'
import Modal from './Modal'

const TIME_OFF_LABELS: Record<TimeOffLabel, string> = {
  holiday: 'Holiday',
  illness: 'Illness',
  other: 'Other',
}

interface AdjustmentSummaryModalProps {
  timeOff: TimeOff
  onClose: () => void
  onRemoved: () => void
}

/** Shows the persisted effect of a time-off adjustment and lets the user undo
 *  it / remove the time-off entry — both are the same underlying operation. */
export default function AdjustmentSummaryModal({ timeOff, onClose, onRemoved }: AdjustmentSummaryModalProps) {
  const adjustments = useLiveQuery(
    () => db.timeOffAdjustments.where('timeOffId').equals(timeOff.id).toArray(),
    [timeOff.id],
  )

  async function handleRemove() {
    await reverseTimeOff(timeOff.id)
    onRemoved()
  }

  const summary = adjustments?.flatMap((a) => a.summary) ?? []
  const reversalLines = adjustments?.flatMap((a) => previewReversal(a)) ?? []

  return (
    <Modal title="Time off adjustment" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-surface-inset p-3 text-sm">
          <p className="font-medium text-ink">{TIME_OFF_LABELS[timeOff.label]}</p>
          <p className="text-ink-muted">
            {formatDisplayDate(timeOff.startDate)} – {formatDisplayDate(timeOff.endDate)}
          </p>
          {timeOff.note && <p className="mt-1 text-xs text-ink-faint">{timeOff.note}</p>}
        </div>

        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">What changed</h3>
          {summary.length === 0 ? (
            <p className="text-sm text-ink-muted">No sessions were affected.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm text-ink-muted">
              {summary.map((line, i) => (
                <li key={i} className="rounded-lg border border-border bg-surface-inset p-2">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Undoing this will
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-ink-muted">
            {reversalLines.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleRemove}
          className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-accent-fg"
        >
          Undo adjustment
        </button>
      </div>
    </Modal>
  )
}
