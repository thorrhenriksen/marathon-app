import { useRef, useState } from 'react'

interface DurationInputProps {
  /** Current value, total seconds (0 = empty). */
  seconds: number
  onChange: (seconds: number) => void
}

function clamp2(value: string, max?: number): string {
  const digits = value.replace(/\D/g, '').slice(0, 2)
  if (max === undefined || digits === '') return digits
  const n = Math.min(Number(digits), max)
  return String(n)
}

const fieldClass = 'w-full rounded-lg border border-border bg-surface-inset px-2 py-3 text-center text-base text-ink'

export default function DurationInput({ seconds, onChange }: DurationInputProps) {
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [secs, setSecs] = useState('')
  const [initialized, setInitialized] = useState(false)

  const minutesRef = useRef<HTMLInputElement>(null)
  const secsRef = useRef<HTMLInputElement>(null)

  if (seconds > 0 && !initialized) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    setHours(h > 0 ? String(h) : '')
    setMinutes(String(m))
    setSecs(String(s).padStart(2, '0'))
    setInitialized(true)
  }

  function emit(h: string, m: string, s: string) {
    const total = Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(s || 0)
    onChange(total)
  }

  function handleHours(value: string) {
    const next = clamp2(value)
    setHours(next)
    emit(next, minutes, secs)
    if (next.length === 2) minutesRef.current?.focus()
  }

  function handleMinutes(value: string) {
    const next = clamp2(value, 59)
    setMinutes(next)
    emit(hours, next, secs)
    if (next.length === 2) secsRef.current?.focus()
  }

  function handleSeconds(value: string) {
    const next = clamp2(value, 59)
    setSecs(next)
    emit(hours, minutes, next)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={hours}
          onChange={(e) => handleHours(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="0"
          className={fieldClass}
        />
        <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-ink-faint">hr</p>
      </div>
      <span className="pb-4 text-base text-ink-muted">:</span>
      <div className="flex-1">
        <input
          ref={minutesRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={minutes}
          onChange={(e) => handleMinutes(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="00"
          className={fieldClass}
        />
        <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-ink-faint">min</p>
      </div>
      <span className="pb-4 text-base text-ink-muted">:</span>
      <div className="flex-1">
        <input
          ref={secsRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={secs}
          onChange={(e) => handleSeconds(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="00"
          className={fieldClass}
        />
        <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-ink-faint">sec</p>
      </div>
    </div>
  )
}
