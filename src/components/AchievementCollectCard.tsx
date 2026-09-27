import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { collectAchievement, coinValueFor, pendingCollections } from '../lib/coins'
import { celebrate } from '../lib/celebrate'
import { useAchievements } from '../lib/useAchievements'

/** Shows one newly-earned achievement at a time on the Today tab. Tapping
 *  collects it: plays the selected celebration and credits its coins. */
export default function AchievementCollectCard() {
  const achievements = useAchievements()
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const [collecting, setCollecting] = useState(false)

  if (!achievements || !settings) return null
  const collections = settings.achievementCollections ?? []
  const queue = pendingCollections(achievements, collections)
  const next = queue[0]
  if (!next) return null

  async function handleCollect() {
    if (collecting || !next) return
    setCollecting(true)
    try {
      await db.transaction('rw', db.settings, async () => {
        const fresh = await db.settings.get('settings')
        if (!fresh) return
        const updated = collectAchievement(next, fresh.achievementCollections ?? [], new Date().toISOString())
        await db.settings.update('settings', { achievementCollections: updated })
      })
      celebrate()
    } finally {
      setCollecting(false)
    }
  }

  return (
    <button
      onClick={handleCollect}
      disabled={collecting}
      className="flex w-full items-center gap-3 rounded-2xl border border-highlight/40 bg-highlight/10 p-4 text-left active:bg-highlight/20"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight/20 text-xl" aria-hidden="true">
        🏅
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-highlight">
          Achievement earned — tap to collect
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{next.title}</span>
        {queue.length > 1 && (
          <span className="block text-[11px] text-ink-faint">{queue.length - 1} more waiting</span>
        )}
      </span>
      <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
        +{coinValueFor(next)} 🪙
      </span>
    </button>
  )
}
