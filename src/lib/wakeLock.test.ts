import { describe, it, expect, vi, afterEach } from 'vitest'

describe('wakeLock', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true })
    vi.resetModules()
  })

  it('resolves false silently when the Wake Lock API is unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
    const { requestWakeLock, isWakeLockHeld } = await import('./wakeLock')

    await expect(requestWakeLock()).resolves.toBe(false)
    expect(isWakeLockHeld()).toBe(false)
  })

  it('resolves false silently when the request is rejected', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { wakeLock: { request: vi.fn().mockRejectedValue(new Error('denied')) } },
      configurable: true,
    })
    const { requestWakeLock, isWakeLockHeld } = await import('./wakeLock')

    await expect(requestWakeLock()).resolves.toBe(false)
    expect(isWakeLockHeld()).toBe(false)
  })

  it('tracks the held state across request/release', async () => {
    const sentinel = { released: false, release: vi.fn().mockImplementation(async function (this: { released: boolean }) {
      this.released = true
    }) }
    Object.defineProperty(globalThis, 'navigator', {
      value: { wakeLock: { request: vi.fn().mockResolvedValue(sentinel) } },
      configurable: true,
    })
    const { requestWakeLock, releaseWakeLock, isWakeLockHeld } = await import('./wakeLock')

    await expect(requestWakeLock()).resolves.toBe(true)
    expect(isWakeLockHeld()).toBe(true)

    await releaseWakeLock()
    expect(isWakeLockHeld()).toBe(false)
  })

  it('release is a silent no-op when nothing is held', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
    const { releaseWakeLock } = await import('./wakeLock')
    await expect(releaseWakeLock()).resolves.toBeUndefined()
  })
})
