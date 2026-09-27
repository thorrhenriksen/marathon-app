// Daniels–Gilbert VDOT model ("Oxygen Power", 1979): the standard formulas
// behind Jack Daniels' VDOT tables. Converts a race result into a VDOT
// fitness score, and back into equivalent race times and training paces.
// Pure math — no data access.

export const MARATHON_M = 42195
export const HALF_MARATHON_M = 21097.5

/** Oxygen cost (ml/kg/min) of running at velocity v (metres/minute). */
function oxygenCost(vMetersPerMin: number): number {
  return -4.6 + 0.182258 * vMetersPerMin + 0.000104 * vMetersPerMin * vMetersPerMin
}

/** Fraction of VO2max sustainable for an effort lasting t minutes. */
function sustainableFraction(tMinutes: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMinutes) + 0.2989558 * Math.exp(-0.1932605 * tMinutes)
}

/** VDOT from a race/time-trial result. */
export function vdotFromPerformance(distanceMeters: number, durationSeconds: number): number {
  const tMinutes = durationSeconds / 60
  return oxygenCost(distanceMeters / tMinutes) / sustainableFraction(tMinutes)
}

/** Equivalent race time (seconds) for a distance at a given VDOT — the
 *  inverse of vdotFromPerformance, solved by bisection (VDOT falls
 *  monotonically as time grows). */
export function equivalentTimeSeconds(vdot: number, distanceMeters: number): number {
  let lo = (distanceMeters / 1000) * 120 // 2:00/km
  let hi = (distanceMeters / 1000) * 1200 // 20:00/km
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (vdotFromPerformance(distanceMeters, mid) > vdot) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Pace (sec/km) whose oxygen cost is `fraction` of VDOT. */
export function paceAtFraction(vdot: number, fraction: number): number {
  const vo2 = vdot * fraction
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  const vMetersPerMin = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  return (1000 / vMetersPerMin) * 60
}

// Training-intensity bands as fractions of VDOT. Easy sits inside Daniels'
// 59–74% E range (the slow end trimmed to 63% so the band stays a useful
// running pace rather than a shuffle); threshold is centred on his ~88%.
export const EASY_FRACTION_FAST = 0.745
export const EASY_FRACTION_SLOW = 0.63
export const THRESHOLD_FRACTION_FAST = 0.89
export const THRESHOLD_FRACTION_SLOW = 0.86

export interface VdotTrainingPaces {
  easyFastSecPerKm: number
  easySlowSecPerKm: number
  marathonSecPerKm: number
  thresholdFastSecPerKm: number
  thresholdSlowSecPerKm: number
}

export function trainingPacesForVdot(vdot: number): VdotTrainingPaces {
  return {
    easyFastSecPerKm: paceAtFraction(vdot, EASY_FRACTION_FAST),
    easySlowSecPerKm: paceAtFraction(vdot, EASY_FRACTION_SLOW),
    marathonSecPerKm: equivalentTimeSeconds(vdot, MARATHON_M) / (MARATHON_M / 1000),
    thresholdFastSecPerKm: paceAtFraction(vdot, THRESHOLD_FRACTION_FAST),
    thresholdSlowSecPerKm: paceAtFraction(vdot, THRESHOLD_FRACTION_SLOW),
  }
}

export interface EquivalentTimes {
  fiveK: number
  tenK: number
  half: number
  marathon: number
}

export function equivalentTimes(vdot: number): EquivalentTimes {
  return {
    fiveK: equivalentTimeSeconds(vdot, 5000),
    tenK: equivalentTimeSeconds(vdot, 10000),
    half: equivalentTimeSeconds(vdot, HALF_MARATHON_M),
    marathon: equivalentTimeSeconds(vdot, MARATHON_M),
  }
}
