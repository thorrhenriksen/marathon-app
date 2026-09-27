import { describe, it, expect } from 'vitest'
import { equivalentTimeSeconds, equivalentTimes, trainingPacesForVdot, vdotFromPerformance, MARATHON_M, HALF_MARATHON_M } from './vdot'

const hms = (h: number, m: number, s: number) => h * 3600 + m * 60 + s

// Published race-equivalent times from Daniels' Running Formula VDOT table.
const DANIELS_TABLE: { vdot: number; fiveK: number; tenK: number; half: number; marathon: number }[] = [
  { vdot: 35, fiveK: hms(0, 27, 0), tenK: hms(0, 56, 3), half: hms(2, 4, 13), marathon: hms(4, 17, 29) },
  { vdot: 40, fiveK: hms(0, 24, 8), tenK: hms(0, 50, 3), half: hms(1, 50, 59), marathon: hms(3, 49, 45) },
  { vdot: 45, fiveK: hms(0, 21, 50), tenK: hms(0, 45, 16), half: hms(1, 40, 20), marathon: hms(3, 28, 26) },
  { vdot: 50, fiveK: hms(0, 19, 57), tenK: hms(0, 41, 21), half: hms(1, 31, 35), marathon: hms(3, 10, 49) },
]

// The published table is rounded/smoothed; the formula reproduces it to
// well under 1% across VDOT 35–50.
const TOLERANCE = 0.006

describe('VDOT vs published Daniels tables (VDOT 35–50)', () => {
  for (const row of DANIELS_TABLE) {
    it(`VDOT ${row.vdot} equivalent race times`, () => {
      const eq = equivalentTimes(row.vdot)
      expect(Math.abs(eq.fiveK - row.fiveK) / row.fiveK).toBeLessThan(TOLERANCE)
      expect(Math.abs(eq.tenK - row.tenK) / row.tenK).toBeLessThan(TOLERANCE)
      expect(Math.abs(eq.half - row.half) / row.half).toBeLessThan(TOLERANCE)
      expect(Math.abs(eq.marathon - row.marathon) / row.marathon).toBeLessThan(TOLERANCE)
    })

    it(`VDOT ${row.vdot} round-trips from its table 10K time`, () => {
      expect(vdotFromPerformance(10000, row.tenK)).toBeCloseTo(row.vdot, 0)
    })
  }
})

describe('equivalentTimeSeconds', () => {
  it('inverts vdotFromPerformance', () => {
    const v = vdotFromPerformance(MARATHON_M, hms(3, 25, 0))
    expect(equivalentTimeSeconds(v, MARATHON_M)).toBeCloseTo(hms(3, 25, 0), 0)
  })

  it('puts a 3:25 marathon at a ~44:25–44:30 10K and ~1:38:40 half', () => {
    const v = vdotFromPerformance(MARATHON_M, hms(3, 25, 0))
    expect(v).toBeGreaterThan(45.7)
    expect(v).toBeLessThan(46)
    const tenK = equivalentTimeSeconds(v, 10000)
    expect(tenK).toBeGreaterThan(hms(0, 44, 20))
    expect(tenK).toBeLessThan(hms(0, 44, 35))
    expect(Math.abs(equivalentTimeSeconds(v, HALF_MARATHON_M) - hms(1, 38, 40))).toBeLessThan(30)
  })
})

describe('trainingPacesForVdot', () => {
  it('orders paces easy slow > easy fast > marathon > threshold', () => {
    const p = trainingPacesForVdot(42)
    expect(p.easySlowSecPerKm).toBeGreaterThan(p.easyFastSecPerKm)
    expect(p.easyFastSecPerKm).toBeGreaterThan(p.marathonSecPerKm)
    expect(p.marathonSecPerKm).toBeGreaterThan(p.thresholdSlowSecPerKm)
    expect(p.thresholdSlowSecPerKm).toBeGreaterThan(p.thresholdFastSecPerKm)
  })

  it('matches Daniels M and T paces at VDOT 50 (4:31–4:32/km, ~4:15/km)', () => {
    const p = trainingPacesForVdot(50)
    expect(p.marathonSecPerKm).toBeGreaterThan(270)
    expect(p.marathonSecPerKm).toBeLessThan(273)
    const tMid = (p.thresholdFastSecPerKm + p.thresholdSlowSecPerKm) / 2
    expect(Math.abs(tMid - 255)).toBeLessThan(4)
  })

  it('gives a ~5:49–6:38/km easy band at VDOT 40', () => {
    const p = trainingPacesForVdot(40)
    expect(Math.abs(p.easyFastSecPerKm - 349)).toBeLessThan(3)
    expect(Math.abs(p.easySlowSecPerKm - 398)).toBeLessThan(3)
  })
})
