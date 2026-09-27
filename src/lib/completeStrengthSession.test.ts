import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from '../types'

const putMock = vi.fn()

vi.mock('../db/db', () => ({
  db: {
    sessions: {
      put: (...args: unknown[]) => putMock(...args),
    },
  },
}))

const { completeStrengthSession } = await import('./completeStrengthSession')

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    week: 1,
    date: '2026-01-06',
    type: 'strength',
    plannedDistanceKm: 0,
    description: 'Strength A',
    status: 'planned',
    variant: 'A',
    exercises: [
      { exerciseId: 'goblet-squat', name: 'Goblet squat', sets: 2, reps: 8, formCue: 'cue', completed: false },
      { exerciseId: 'side-plank', name: 'Side plank', sets: 2, holdSeconds: 20, formCue: 'cue', completed: false },
    ],
    guidedProgress: { currentExerciseIndex: 1, completedExerciseIds: ['goblet-squat'] },
    ...overrides,
  }
}

describe('completeStrengthSession', () => {
  beforeEach(() => {
    putMock.mockClear()
  })

  it('marks every exercise completed, sets status/completedAt, and clears guidedProgress', async () => {
    const session = makeSession()
    await completeStrengthSession(session, 'Felt good')

    expect(putMock).toHaveBeenCalledTimes(1)
    const saved = putMock.mock.calls[0][0]
    expect(saved.status).toBe('completed')
    expect(saved.completionNote).toBe('Felt good')
    expect(saved.guidedProgress).toBeUndefined()
    expect(saved.completedAt).toEqual(expect.any(String))
    expect(saved.exercises.every((e: { completed: boolean }) => e.completed)).toBe(true)
  })

  it('trims a blank completion note down to undefined', async () => {
    const session = makeSession()
    await completeStrengthSession(session, '   ')

    const saved = putMock.mock.calls[0][0]
    expect(saved.completionNote).toBeUndefined()
  })

  it('handles a session with no exercises without throwing', async () => {
    const session = makeSession({ exercises: undefined })
    await completeStrengthSession(session)

    const saved = putMock.mock.calls[0][0]
    expect(saved.exercises).toEqual([])
  })
})
