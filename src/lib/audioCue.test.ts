import { describe, it, expect, vi, afterEach } from 'vitest'

describe('audioCue', () => {
  const originalAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext

  afterEach(() => {
    ;(globalThis as { AudioContext?: unknown }).AudioContext = originalAudioContext
    vi.resetModules()
  })

  it('primeAudioCue is a silent no-op when AudioContext is unavailable', async () => {
    delete (globalThis as { AudioContext?: unknown }).AudioContext
    const { primeAudioCue, playAudioCue } = await import('./audioCue')

    expect(() => primeAudioCue()).not.toThrow()
    expect(() => playAudioCue()).not.toThrow()
  })

  it('playAudioCue does nothing before primeAudioCue has run', async () => {
    const createOscillator = vi.fn()
    class FakeAudioContext {
      state = 'running'
      currentTime = 0
      createOscillator = createOscillator
      createGain = vi.fn()
      destination = {}
    }
    ;(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext
    const { playAudioCue } = await import('./audioCue')

    expect(() => playAudioCue()).not.toThrow()
    expect(createOscillator).not.toHaveBeenCalled()
  })

  it('plays a short tone through an oscillator/gain node after priming', async () => {
    const oscillator = { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }
    class FakeAudioContext {
      state = 'running'
      currentTime = 0
      createOscillator = vi.fn().mockReturnValue(oscillator)
      createGain = vi.fn().mockReturnValue(gain)
      destination = {}
    }
    ;(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext
    const { primeAudioCue, playAudioCue } = await import('./audioCue')

    primeAudioCue()
    playAudioCue()

    expect(oscillator.connect).toHaveBeenCalledWith(gain)
    expect(gain.connect).toHaveBeenCalled()
    expect(oscillator.start).toHaveBeenCalled()
    expect(oscillator.stop).toHaveBeenCalled()
  })

  it('playAudioCue never throws even if node creation fails', async () => {
    class FakeAudioContext {
      state = 'running'
      currentTime = 0
      createOscillator = () => {
        throw new Error('boom')
      }
      createGain = vi.fn()
      destination = {}
    }
    ;(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext
    const { primeAudioCue, playAudioCue } = await import('./audioCue')

    primeAudioCue()
    expect(() => playAudioCue()).not.toThrow()
  })
})
