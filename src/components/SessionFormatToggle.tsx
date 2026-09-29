import type { SessionFormat } from '../types'
import { SESSION_FORMAT_LABELS } from '../lib/guidedPlan'

interface SessionFormatToggleProps {
  value: SessionFormat
  onChange: (format: SessionFormat) => void
  disabled?: boolean
}

/** Compact Straight sets / Circuit segmented control. */
export default function SessionFormatToggle({ value, onChange, disabled }: SessionFormatToggleProps) {
  return (
    <div role="radiogroup" aria-label="Session format" className="inline-flex rounded-full border border-border p-0.5">
      {(Object.keys(SESSION_FORMAT_LABELS) as SessionFormat[]).map((format) => {
        const active = format === value
        return (
          <button
            key={format}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(format)}
            className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
              active ? 'bg-strength text-accent-fg' : 'text-ink-muted'
            }`}
          >
            {SESSION_FORMAT_LABELS[format]}
          </button>
        )
      })}
    </div>
  )
}
