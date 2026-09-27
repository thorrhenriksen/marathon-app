// Thin wrapper around the Wake Lock API. Every call site tolerates a
// rejection silently — support is inconsistent (iOS 16.4+, broken in
// installed PWAs pre-iOS 18.4) and this is a nice-to-have, never required.

let currentLock: WakeLockSentinel | null = null

export async function requestWakeLock(): Promise<boolean> {
  if (!('wakeLock' in navigator)) return false
  try {
    currentLock = await navigator.wakeLock.request('screen')
    return true
  } catch {
    currentLock = null
    return false
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (!currentLock) return
  try {
    await currentLock.release()
  } catch {
    // ignore
  } finally {
    currentLock = null
  }
}

export function isWakeLockHeld(): boolean {
  return currentLock !== null && !currentLock.released
}
