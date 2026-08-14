import type { PaceZones } from '../types'

const MARATHON_KM = 42.195

/** Default goal: 4:30:00 marathon finish time, in seconds. */
export const DEFAULT_GOAL_SECONDS = 4 * 3600 + 30 * 60

export function computePaceZones(targetTimeSeconds: number): PaceZones {
  const marathonPaceSecPerKm = targetTimeSeconds / MARATHON_KM
  return {
    marathonPaceSecPerKm,
    easyPaceMinSecPerKm: marathonPaceSecPerKm + 45,
    easyPaceMaxSecPerKm: marathonPaceSecPerKm + 75,
    tempoPaceMinSecPerKm: marathonPaceSecPerKm - 30,
    tempoPaceMaxSecPerKm: marathonPaceSecPerKm - 20,
    raceGoalTimeSeconds: targetTimeSeconds,
  }
}

/** Formats seconds-per-km as "M:SS/km". */
export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—'
  const mins = Math.floor(secPerKm / 60)
  const secs = Math.round(secPerKm % 60)
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

export function formatPaceRange(minSecPerKm: number, maxSecPerKm: number): string {
  // "Min" pace (faster) has the smaller sec/km value.
  const faster = Math.min(minSecPerKm, maxSecPerKm)
  const slower = Math.max(minSecPerKm, maxSecPerKm)
  return `${formatPace(faster)} – ${formatPace(slower)}`
}

/** Formats a duration in seconds as "H:MM:SS" (or "M:SS" under an hour). */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Parses "H:MM:SS", "MM:SS", or a bare minute count into total seconds. */
export function parseDurationToSeconds(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 0
  const parts = trimmed.split(':').map((p) => Number(p))
  if (parts.some((p) => Number.isNaN(p))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 60
}

export function computePaceSecPerKm(distanceKm: number, durationSeconds: number): number {
  if (distanceKm <= 0) return 0
  return durationSeconds / distanceKm
}
