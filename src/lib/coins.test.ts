import { describe, it, expect } from 'vitest'
import {
  checkPurchase,
  coinValueFor,
  collectAchievement,
  computeCoinBalance,
  initializeCoinEconomy,
  ownsItem,
  pendingCollections,
  sectionForAchievement,
} from './coins'
import type { Achievement } from './achievements'
import type { AchievementCollection, ShopPurchase } from '../types'

function ach(id: string, category: Achievement['category'], unlocked = true): Achievement {
  return { id, category, title: id, condition: '', unlocked }
}

const NOW = '2026-09-27T10:00:00.000Z'

describe('sections and coin values', () => {
  it('maps every achievement family to its section and value', () => {
    expect(sectionForAchievement(ach('first-run', 'badge'))).toBe('firsts')
    expect(sectionForAchievement(ach('distance-first-15', 'badge'))).toBe('firsts')
    expect(sectionForAchievement(ach('streak-5', 'streak'))).toBe('consistency')
    expect(sectionForAchievement(ach('adherence', 'badge'))).toBe('consistency')
    expect(sectionForAchievement(ach('distance-100', 'distance'))).toBe('distance')
    expect(sectionForAchievement(ach('phase-2', 'badge'))).toBe('phases')
    expect(sectionForAchievement(ach('race-week-reached', 'badge'))).toBe('phases')
    expect(sectionForAchievement(ach('smart-call', 'recovery'))).toBe('recovery')

    expect(coinValueFor(ach('first-run', 'badge'))).toBe(10)
    expect(coinValueFor(ach('consistency-4', 'consistency'))).toBe(20)
    expect(coinValueFor(ach('distance-200', 'distance'))).toBe(25)
    expect(coinValueFor(ach('phase-1', 'badge'))).toBe(40)
    expect(coinValueFor(ach('rest-days-honored', 'recovery'))).toBe(10)
  })
})

describe('balance derivation', () => {
  it('is collected earnings minus purchases', () => {
    const collections: AchievementCollection[] = [
      { achievementId: 'a', collectedAt: NOW, coins: 40 },
      { achievementId: 'b', collectedAt: NOW, coins: 25 },
    ]
    const purchases: ShopPurchase[] = [
      { itemId: 'accent-bronze', purchasedAt: NOW, price: 20 },
      { itemId: 'theme-dawn', purchasedAt: NOW, price: 0, grandfathered: true },
    ]
    expect(computeCoinBalance(collections, purchases)).toBe(45)
  })

  it('survives a backup/restore JSON round-trip unchanged', () => {
    const collections: AchievementCollection[] = [{ achievementId: 'a', collectedAt: NOW, coins: 40 }]
    const purchases: ShopPurchase[] = [{ itemId: 'accent-bronze', purchasedAt: NOW, price: 20 }]
    const restored = JSON.parse(JSON.stringify({ collections, purchases }))
    expect(computeCoinBalance(restored.collections, restored.purchases)).toBe(20)
  })
})

describe('collection', () => {
  it('queues unlocked, uncollected achievements in section order', () => {
    const achievements = [
      ach('phase-1', 'badge'),
      ach('smart-call', 'recovery'),
      ach('first-run', 'badge'),
      ach('distance-100', 'distance', false),
    ]
    const collections: AchievementCollection[] = [{ achievementId: 'smart-call', collectedAt: NOW, coins: 10 }]
    expect(pendingCollections(achievements, collections).map((a) => a.id)).toEqual(['first-run', 'phase-1'])
  })

  it('is idempotent and ignores locked achievements', () => {
    const once = collectAchievement(ach('first-run', 'badge'), [], NOW)
    expect(once).toEqual([{ achievementId: 'first-run', collectedAt: NOW, coins: 10 }])
    expect(collectAchievement(ach('first-run', 'badge'), once, NOW)).toBe(once)
    expect(collectAchievement(ach('phase-1', 'badge', false), once, NOW)).toBe(once)
  })
})

describe('purchases', () => {
  const collections: AchievementCollection[] = [{ achievementId: 'a', collectedAt: NOW, coins: 50 }]

  it('allows a purchase the balance covers and rejects the rest', () => {
    expect(checkPurchase('theme-dawn', collections, [])).toEqual({ ok: true })
    expect(checkPurchase('theme-midnight', collections, [])).toEqual({ ok: false, reason: 'insufficient' })
    expect(checkPurchase('nope', collections, [])).toEqual({ ok: false, reason: 'unknown' })
    const owned: ShopPurchase[] = [{ itemId: 'theme-dawn', purchasedAt: NOW, price: 50 }]
    expect(checkPurchase('theme-dawn', collections, owned)).toEqual({ ok: false, reason: 'owned' })
  })

  it('treats default cosmetics as always owned', () => {
    expect(ownsItem('theme', 'dark', [])).toBe(true)
    expect(ownsItem('celebration', 'classic', [])).toBe(true)
    expect(ownsItem('icons', 'dots', [])).toBe(true)
    expect(ownsItem('icons', 'glyphs', [])).toBe(false)
  })
})

describe('initializeCoinEconomy (grandfathering)', () => {
  const base = {
    achievements: [ach('first-run', 'badge'), ach('phase-1', 'badge'), ach('distance-600', 'distance', false)],
    longestStreak: 6,
    totalDistanceKm: 250,
    existingCollections: [] as AchievementCollection[],
    existingPurchases: [] as ShopPurchase[],
    now: NOW,
  }

  it('grants previously-unlocked themes and accents at no cost', () => {
    const { purchases } = initializeCoinEconomy(base)
    expect(purchases.map((p) => p.itemId).sort()).toEqual(['accent-bronze', 'accent-silver', 'theme-dawn'])
    expect(purchases.every((p) => p.price === 0 && p.grandfathered)).toBe(true)
  })

  it('grandfathers whatever theme/accent is currently selected', () => {
    const { purchases } = initializeCoinEconomy({ ...base, longestStreak: 0, totalDistanceKm: 0, currentTheme: 'midnight', currentAccent: 'gold' })
    expect(purchases.map((p) => p.itemId).sort()).toEqual(['accent-gold', 'theme-midnight'])
  })

  it('credits already-earned achievements retroactively, without charging for grants', () => {
    const { collections, purchases } = initializeCoinEconomy(base)
    expect(collections.map((c) => c.achievementId)).toEqual(['first-run', 'phase-1'])
    expect(collections.every((c) => c.retroactive)).toBe(true)
    expect(computeCoinBalance(collections, purchases)).toBe(50)
  })

  it('never duplicates or re-prices existing events', () => {
    const existingPurchases: ShopPurchase[] = [{ itemId: 'theme-dawn', purchasedAt: '2026-01-01', price: 50 }]
    const existingCollections: AchievementCollection[] = [{ achievementId: 'first-run', collectedAt: '2026-01-01', coins: 10 }]
    const { collections, purchases } = initializeCoinEconomy({ ...base, existingPurchases, existingCollections })
    expect(purchases.filter((p) => p.itemId === 'theme-dawn')).toEqual(existingPurchases)
    expect(collections.filter((c) => c.achievementId === 'first-run')).toEqual(existingCollections)
  })
})
