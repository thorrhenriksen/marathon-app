// Coin economy: purely cosmetic rewards layered on top of the derived
// achievements. Only two kinds of events are ever stored (on the Settings
// record, so they ride along with backup/restore): achievement collections
// and shop purchases. The balance, ownership, and the collect queue are all
// derived from those events plus the (still fully derived) achievement list.
//
// Rules this module must never break: nothing here gates functionality or
// touches training logic, and nothing nudges the user to train more.

import type { Achievement, CardAccentUnlock, ThemeUnlock } from './achievements'
import type { AchievementCollection, CelebrationStyle, IconPack, ShopPurchase } from '../types'

export type AchievementSection = 'firsts' | 'consistency' | 'distance' | 'recovery' | 'phases'

export const ACHIEVEMENT_SECTIONS: { id: AchievementSection; title: string }[] = [
  { id: 'firsts', title: 'Firsts' },
  { id: 'consistency', title: 'Consistency' },
  { id: 'distance', title: 'Distance' },
  { id: 'recovery', title: 'Recovery' },
  { id: 'phases', title: 'Phases' },
]

export const SECTION_COIN_VALUE: Record<AchievementSection, number> = {
  firsts: 10,
  consistency: 20,
  distance: 25,
  phases: 40,
  recovery: 10,
}

export function sectionForAchievement(achievement: Pick<Achievement, 'id' | 'category'>): AchievementSection {
  const { id, category } = achievement
  if (id.startsWith('phase-') || id === 'race-week-reached') return 'phases'
  if (category === 'recovery') return 'recovery'
  if (category === 'streak' || category === 'consistency' || id === 'adherence') return 'consistency'
  if (category === 'distance') return 'distance'
  return 'firsts'
}

export function coinValueFor(achievement: Pick<Achievement, 'id' | 'category'>): number {
  return SECTION_COIN_VALUE[sectionForAchievement(achievement)]
}

export type ShopCategory = 'theme' | 'accent' | 'celebration' | 'icons'

export interface ShopItem {
  id: string
  category: ShopCategory
  value: string
  label: string
  price: number
}

export const SHOP_CATEGORY_TITLES: Record<ShopCategory, string> = {
  theme: 'Themes',
  accent: 'Card accents',
  celebration: 'Celebration styles',
  icons: 'Calendar icon packs',
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'theme-dawn', category: 'theme', value: 'dawn', label: 'Dawn', price: 50 },
  { id: 'theme-midnight', category: 'theme', value: 'midnight', label: 'Midnight', price: 80 },
  { id: 'accent-bronze', category: 'accent', value: 'bronze', label: 'Bronze', price: 20 },
  { id: 'accent-silver', category: 'accent', value: 'silver', label: 'Silver', price: 40 },
  { id: 'accent-gold', category: 'accent', value: 'gold', label: 'Gold', price: 60 },
  { id: 'accent-platinum', category: 'accent', value: 'platinum', label: 'Platinum', price: 80 },
  { id: 'celebration-fireworks', category: 'celebration', value: 'fireworks', label: 'Fireworks', price: 40 },
  { id: 'celebration-pulse', category: 'celebration', value: 'pulse', label: 'Minimal pulse', price: 30 },
  { id: 'icons-glyphs', category: 'icons', value: 'glyphs', label: 'Tiny glyphs', price: 30 },
  { id: 'icons-squares', category: 'icons', value: 'squares', label: 'Filled squares', price: 30 },
]

/** Cosmetics everyone owns without buying anything. */
export const FREE_ITEM_VALUES: Record<ShopCategory, string[]> = {
  theme: ['light', 'dark', 'system'],
  accent: [],
  celebration: ['classic'],
  icons: ['dots'],
}

export const DEFAULT_CELEBRATION_STYLE: CelebrationStyle = 'classic'
export const DEFAULT_ICON_PACK: IconPack = 'dots'

export function shopItemId(category: ShopCategory, value: string): string {
  return `${category}-${value}`
}

export function computeCoinBalance(collections: AchievementCollection[], purchases: ShopPurchase[]): number {
  const earned = collections.reduce((sum, c) => sum + c.coins, 0)
  const spent = purchases.reduce((sum, p) => sum + p.price, 0)
  return earned - spent
}

export function ownsItem(category: ShopCategory, value: string, purchases: ShopPurchase[]): boolean {
  if (FREE_ITEM_VALUES[category].includes(value)) return true
  const id = shopItemId(category, value)
  return purchases.some((p) => p.itemId === id)
}

export type PurchaseCheck = { ok: true } | { ok: false; reason: 'owned' | 'insufficient' | 'unknown' }

export function checkPurchase(itemId: string, collections: AchievementCollection[], purchases: ShopPurchase[]): PurchaseCheck {
  const item = SHOP_ITEMS.find((i) => i.id === itemId)
  if (!item) return { ok: false, reason: 'unknown' }
  if (purchases.some((p) => p.itemId === itemId)) return { ok: false, reason: 'owned' }
  if (computeCoinBalance(collections, purchases) < item.price) return { ok: false, reason: 'insufficient' }
  return { ok: true }
}

/** Unlocked achievements that haven't been collected yet, in display order
 *  (section order, then catalog order) — the Today tab shows the first. */
export function pendingCollections(achievements: Achievement[], collections: AchievementCollection[]): Achievement[] {
  const collected = new Set(collections.map((c) => c.achievementId))
  const sectionOrder = ACHIEVEMENT_SECTIONS.map((s) => s.id)
  return achievements
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.unlocked && !collected.has(a.id))
    .sort(
      (x, y) =>
        sectionOrder.indexOf(sectionForAchievement(x.a)) - sectionOrder.indexOf(sectionForAchievement(y.a)) ||
        x.index - y.index,
    )
    .map(({ a }) => a)
}

export function collectAchievement(
  achievement: Achievement,
  collections: AchievementCollection[],
  now: string,
): AchievementCollection[] {
  if (!achievement.unlocked || collections.some((c) => c.achievementId === achievement.id)) return collections
  return [...collections, { achievementId: achievement.id, collectedAt: now, coins: coinValueFor(achievement) }]
}

/** Thresholds of the pre-shop unlock rules, kept only to grandfather anyone
 *  who had already met them when the shop replaced streak/km gating. */
export const LEGACY_THEME_STREAK_WEEKS: Record<ThemeUnlock, number> = { dawn: 5, midnight: 10 }
export const LEGACY_ACCENT_KM: Record<CardAccentUnlock, number> = { bronze: 100, silver: 200, gold: 400, platinum: 600 }

export interface CoinEconomyInitInput {
  achievements: Achievement[]
  longestStreak: number
  totalDistanceKm: number
  currentTheme?: string
  currentAccent?: string
  existingCollections: AchievementCollection[]
  existingPurchases: ShopPurchase[]
  now: string
}

/** One-time initialization when the coin economy first runs against
 *  existing data: grandfathers already-unlocked themes/accents as free
 *  purchases and credits already-earned achievements. Purely additive —
 *  never removes or re-prices an existing event. */
export function initializeCoinEconomy(input: CoinEconomyInitInput): {
  collections: AchievementCollection[]
  purchases: ShopPurchase[]
} {
  const purchases = [...input.existingPurchases]
  const grant = (category: ShopCategory, value: string) => {
    const itemId = shopItemId(category, value)
    if (!purchases.some((p) => p.itemId === itemId)) {
      purchases.push({ itemId, purchasedAt: input.now, price: 0, grandfathered: true })
    }
  }

  for (const theme of ['dawn', 'midnight'] as ThemeUnlock[]) {
    if (input.longestStreak >= LEGACY_THEME_STREAK_WEEKS[theme] || input.currentTheme === theme) grant('theme', theme)
  }
  for (const accent of ['bronze', 'silver', 'gold', 'platinum'] as CardAccentUnlock[]) {
    if (input.totalDistanceKm >= LEGACY_ACCENT_KM[accent] || input.currentAccent === accent) grant('accent', accent)
  }

  let collections = [...input.existingCollections]
  for (const achievement of input.achievements) {
    const before = collections.length
    collections = collectAchievement(achievement, collections, input.now)
    if (collections.length > before) collections[collections.length - 1].retroactive = true
  }

  return { collections, purchases }
}
