// One-time coin-economy initialization against existing data: grandfathers
// themes/card accents already unlocked under the old streak/km rules, and
// credits achievements already earned before the collect flow existed.
// Additive only (writes new Settings fields), idempotent via
// Settings.coinEconomyInitializedAt, and runs inside one transaction so
// StrictMode's double effect or multiple tabs can't double-credit.

import { db } from './db'
import { computeAchievements, computeStreaks, computeTotalDistanceKm } from '../lib/achievements'
import { initializeCoinEconomy } from '../lib/coins'
import { todayISO } from '../lib/dates'

export async function runCoinEconomyMigration(): Promise<void> {
  await db.transaction('rw', [db.settings, db.sessions, db.runs, db.weeks, db.timeOff], async () => {
    const settings = await db.settings.get('settings')
    if (!settings || settings.coinEconomyInitializedAt) return

    const [sessions, runs, weeks, timeOffEntries] = await Promise.all([
      db.sessions.toArray(),
      db.runs.toArray(),
      db.weeks.toArray(),
      db.timeOff.toArray(),
    ])
    const today = todayISO()
    const now = new Date().toISOString()

    const { collections, purchases } = initializeCoinEconomy({
      achievements: computeAchievements({ sessions, runs, weeks, timeOffEntries, today }),
      longestStreak: computeStreaks(sessions, weeks, timeOffEntries, today).longest,
      totalDistanceKm: computeTotalDistanceKm(runs),
      currentTheme: settings.theme,
      currentAccent: settings.cardAccent,
      existingCollections: settings.achievementCollections ?? [],
      existingPurchases: settings.shopPurchases ?? [],
      now,
    })

    await db.settings.update('settings', {
      achievementCollections: collections,
      shopPurchases: purchases,
      coinEconomyInitializedAt: now,
    })
  })
}
