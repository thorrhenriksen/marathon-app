/**
 * Requests persistent storage so the browser (in particular iOS Safari) is
 * less likely to evict IndexedDB data under storage pressure. Safe to call
 * repeatedly; resolves false in browsers that don't support the API.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  const alreadyPersisted = await navigator.storage.persisted()
  if (alreadyPersisted) return true
  return navigator.storage.persist()
}
