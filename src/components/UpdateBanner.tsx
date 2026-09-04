import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Guards against a reload loop: set right before the deliberate reload,
// cleared on the next normal page load.
const RELOAD_GUARD_KEY = 'sw-update-reload-guard'

/** Opt-in "Update available" banner. Registers the service worker once and
 *  surfaces `needRefresh` instead of silently skipping waiting, so the user
 *  is never mid-action when new code swaps in underneath them. */
export default function UpdateBanner() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  const [needsRefresh] = needRefresh
  const reloadedRef = useRef(false)

  useEffect(() => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
  }, [])

  if (!needsRefresh || reloadedRef.current) return null

  function handleReload() {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
    reloadedRef.current = true
    updateServiceWorker(true)
  }

  return (
    <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 mx-auto flex w-full max-w-md items-center justify-between gap-3 bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
      <span>Update available</span>
      <button onClick={handleReload} className="rounded-full bg-accent-fg/20 px-3 py-1 text-xs font-semibold">
        Reload
      </button>
    </div>
  )
}
