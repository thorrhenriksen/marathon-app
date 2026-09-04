/**
 * Requests persistent storage so the browser (in particular iOS Safari) is
 * less likely to evict IndexedDB data under storage pressure. Called on
 * every launch — never gated on a past attempt, since the browser can grant
 * or revoke persistence independently of anything we've stored.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  const alreadyPersisted = await navigator.storage.persisted()
  const granted = alreadyPersisted || (await navigator.storage.persist())
  if (!granted) {
    console.warn(
      'Persistent storage was not granted — data may be evicted under storage pressure. Keep backups.',
    )
  }
  return granted
}

/** Live check of the browser's current persistence grant, for display in Settings. */
export function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return Promise.resolve(false)
  return navigator.storage.persisted()
}
