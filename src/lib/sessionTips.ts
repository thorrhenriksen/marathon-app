// Per-session-type guidance shown in the session detail sheet. Tips rotate
// deterministically per session (stable across re-renders/reloads) via a
// hash of the session id, rather than being randomised on every render.

import type { Session, SessionType } from '../types'

export const SESSION_TIPS: Record<SessionType, string[]> = {
  easy: [
    'Keep the effort conversational — you should be able to talk in full sentences.',
    "Resist the urge to speed up just because you feel good early on.",
    'Use this run to shake out stiffness from harder sessions.',
    'Nasal breathing is a good gut-check that you\'re not going too hard.',
    'Easy days build aerobic base — the pace is the point, not the distance.',
  ],
  long: [
    'Start slower than you think you need to; most long runs are won in the last third.',
    'Practice your race-day fueling and hydration strategy on this run.',
    'Break the distance into smaller mental chunks rather than thinking about the whole run.',
    'Wear the shoes and kit you plan to race in at least once before race day.',
    "If you slow down in the last few km, that's normal fatigue, not a sign of poor fitness.",
    'Plan your route in advance so you\'re not making pace decisions on tired legs.',
  ],
  tempo: [
    'Aim for "comfortably hard" — sustainable, not a sprint.',
    'A short warm-up and cool-down jog help you settle into and out of the effort.',
    'Even pacing beats starting fast and fading — check your splits.',
    'Tempo pace should feel controlled, not desperate.',
  ],
  'marathon-pace': [
    'This is about rehearsing goal pace, not proving fitness — stay disciplined.',
    'Practice fueling at marathon pace since it feels different than at easy pace.',
    'Focus on relaxed form: efficient arm swing, quiet feet.',
    'If pace drifts, correct gradually rather than surging.',
  ],
  strides: [
    'Strides are about form and turnover, not effort — stay relaxed even as you speed up.',
    'Build up to near-top speed gradually over the first two-thirds of each stride.',
    'Take full recovery between reps; the point is quality, not fatigue.',
    'Good posture and quick cadence matter more than raw speed here.',
  ],
  race: [
    'Trust your training — race day is not the day to try anything new.',
    'Lay out your kit, bib, and fueling the night before.',
    'Start conservatively; it is far easier to speed up late than recover from an early blowout.',
    'Have a fueling plan and stick to it, especially in the first half.',
  ],
  rest: [
    'Recovery is when your body actually adapts to training — treat it as part of the plan.',
    'Light stretching, sleep, and nutrition all support tomorrow\'s session.',
    'It is normal to feel a little restless on rest days — trust the plan.',
  ],
}

/** Deterministic hash of a string into a non-negative 32-bit integer. */
function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Picks a stable, session-specific subset of tips for the given session's type. */
export function pickTips(session: Session, count = 3): string[] {
  const tips = SESSION_TIPS[session.type]
  if (tips.length <= count) return tips

  const start = hashString(session.id) % tips.length
  const picked: string[] = []
  for (let i = 0; i < count; i++) {
    picked.push(tips[(start + i) % tips.length])
  }
  return picked
}

/** True when the session's distance is within ~2km of the longest 'long' session in the plan. */
export function isNearLongestLongRun(session: Session, allSessions: Session[]): boolean {
  if (session.type !== 'long') return false
  const longestKm = allSessions
    .filter((s) => s.type === 'long')
    .reduce((max, s) => Math.max(max, s.plannedDistanceKm), 0)
  if (longestKm === 0) return false
  return longestKm - session.plannedDistanceKm <= 2
}
