import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  ACHIEVEMENT_SECTIONS,
  SHOP_CATEGORY_TITLES,
  SHOP_ITEMS,
  checkPurchase,
  coinValueFor,
  computeCoinBalance,
  sectionForAchievement,
  type ShopCategory,
  type ShopItem,
} from '../lib/coins'
import { celebrate } from '../lib/celebrate'
import type { Achievement } from '../lib/achievements'
import type { CelebrationStyle, IconPack, SessionType, Settings } from '../types'
import SessionMarker from './SessionMarker'
import { CARD_ACCENT_SWATCH } from '../lib/sessionColors'

function Medal({ unlocked }: { unlocked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 shrink-0 ${unlocked ? 'text-accent' : 'text-border'}`} aria-hidden="true">
      <path d="M8 2h3l1 5-2.5 1ZM16 2h-3l-1 5 2.5 1Z" fill="currentColor" opacity={unlocked ? 0.6 : 1} />
      <circle cx="12" cy="14.5" r="6.5" fill={unlocked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
      {unlocked && <path d="M9.2 14.6l1.9 1.9 3.8-3.8" fill="none" stroke="var(--color-surface)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

function AchievementTile({ achievement, collected }: { achievement: Achievement; collected: boolean }) {
  const { unlocked } = achievement
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-xl p-2 ${unlocked ? 'bg-surface-inset' : ''}`}>
      <div className="flex items-center justify-between gap-1">
        <Medal unlocked={unlocked} />
        {unlocked && !collected && (
          <span className="rounded-full bg-highlight/15 px-1.5 text-[9px] font-semibold text-highlight">Collect</span>
        )}
      </div>
      <p className={`truncate text-[11px] font-medium ${unlocked ? 'text-ink' : 'text-ink-faint'}`}>{achievement.title}</p>
      <p className="line-clamp-2 text-[10px] leading-snug text-ink-faint">
        {unlocked ? (achievement.progress ?? `${coinValueFor(achievement)} 🪙`) : achievement.condition}
      </p>
    </div>
  )
}

function AchievementSections({ achievements, collectedIds }: { achievements: Achievement[]; collectedIds: Set<string> }) {
  return (
    <div className="flex flex-col gap-4">
      {ACHIEVEMENT_SECTIONS.map((section) => {
        const items = achievements.filter((a) => sectionForAchievement(a) === section.id)
        if (items.length === 0) return null
        const unlocked = items.filter((a) => a.unlocked).length
        return (
          <section key={section.id} className="rounded-2xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-sm font-medium text-ink">{section.title}</h3>
              <span className="text-[11px] text-ink-faint">
                {unlocked}/{items.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {items.map((a) => (
                <AchievementTile key={a.id} achievement={a} collected={collectedIds.has(a.id)} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

const PREVIEW_TYPES: SessionType[] = ['easy', 'long', 'tempo', 'strength', 'race']
const TYPE_BG: Record<SessionType, string> = {
  easy: 'bg-accent',
  long: 'bg-info',
  tempo: 'bg-warning',
  'marathon-pace': 'bg-highlight',
  strides: 'bg-accent',
  race: 'bg-danger',
  rest: 'bg-ink-faint',
  strength: 'bg-strength',
}

const THEME_SWATCH: Record<string, string> = {
  dawn: 'bg-[#fff7ed] ring-1 ring-[#ea580c]',
  midnight: 'bg-[#0f0f23] ring-1 ring-[#818cf8]',
}

function ItemPreview({ item }: { item: ShopItem }) {
  switch (item.category) {
    case 'theme':
      return <span className={`h-5 w-5 shrink-0 rounded-full ${THEME_SWATCH[item.value]}`} />
    case 'accent':
      return <span className={`h-5 w-5 shrink-0 rounded-full ${CARD_ACCENT_SWATCH[item.value as keyof typeof CARD_ACCENT_SWATCH]}`} />
    case 'icons':
      return (
        <span className="flex shrink-0 items-center gap-1">
          {PREVIEW_TYPES.map((t) => (
            <SessionMarker key={t} type={t} colorClass={TYPE_BG[t]} pack={item.value as IconPack} size={8} />
          ))}
        </span>
      )
    case 'celebration':
      return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm" aria-hidden="true">
          {item.value === 'fireworks' ? '🎆' : '◎'}
        </span>
      )
  }
}

function isItemActive(item: ShopItem, settings: Settings): boolean {
  switch (item.category) {
    case 'theme':
      return settings.theme === item.value
    case 'accent':
      return settings.cardAccent === item.value
    case 'celebration':
      return (settings.celebrationStyle ?? 'classic') === item.value
    case 'icons':
      return (settings.iconPack ?? 'dots') === item.value
  }
}

async function applyItem(item: ShopItem) {
  switch (item.category) {
    case 'theme':
      return db.settings.update('settings', { theme: item.value as Settings['theme'] })
    case 'accent':
      return db.settings.update('settings', { cardAccent: item.value as Settings['cardAccent'] })
    case 'celebration':
      return db.settings.update('settings', { celebrationStyle: item.value as CelebrationStyle })
    case 'icons':
      return db.settings.update('settings', { iconPack: item.value as IconPack })
  }
}

function ShopRow({ item, settings, balance }: { item: ShopItem; settings: Settings; balance: number }) {
  const purchases = settings.shopPurchases ?? []
  const owned = purchases.some((p) => p.itemId === item.id)
  const active = isItemActive(item, settings)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const id = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(id)
  }, [confirming])

  async function handleBuy() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    await db.transaction('rw', db.settings, async () => {
      const fresh = await db.settings.get('settings')
      if (!fresh) return
      const collections = fresh.achievementCollections ?? []
      const current = fresh.shopPurchases ?? []
      if (!checkPurchase(item.id, collections, current).ok) return
      await db.settings.update('settings', {
        shopPurchases: [...current, { itemId: item.id, purchasedAt: new Date().toISOString(), price: item.price }],
      })
    })
  }

  const affordable = balance >= item.price
  const button = 'min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold'

  return (
    <div className="flex min-h-12 items-center gap-3 py-1.5">
      <ItemPreview item={item} />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.label}</span>
      {item.category === 'celebration' && (
        <button onClick={() => celebrate({ style: item.value as CelebrationStyle })} className={`${button} text-ink-muted`}>
          Preview
        </button>
      )}
      {owned ? (
        active ? (
          <span className={`${button} flex items-center bg-accent/15 text-accent`}>In use</span>
        ) : (
          <button onClick={() => applyItem(item)} className={`${button} border border-border text-ink`}>
            Use
          </button>
        )
      ) : (
        <button
          onClick={handleBuy}
          disabled={!affordable}
          className={`${button} ${confirming ? 'bg-accent text-accent-fg' : 'border border-border text-ink'} disabled:opacity-40`}
        >
          {confirming ? `Spend ${item.price} 🪙?` : `${item.price} 🪙`}
        </button>
      )}
    </div>
  )
}

function Shop({ settings, balance }: { settings: Settings; balance: number }) {
  const categories = Object.keys(SHOP_CATEGORY_TITLES) as ShopCategory[]
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-ink">Shop</h3>
      <p className="mt-0.5 text-xs text-ink-faint">Cosmetic only — nothing here changes your training.</p>
      <div className="mt-2 flex flex-col divide-y divide-border">
        {categories.map((category) => (
          <div key={category} className="py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{SHOP_CATEGORY_TITLES[category]}</p>
            {SHOP_ITEMS.filter((i) => i.category === category).map((item) => (
              <ShopRow key={item.id} item={item} settings={settings} balance={balance} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export default function AchievementsTab({ achievements }: { achievements: Achievement[] }) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  if (!settings) return null

  const collections = settings.achievementCollections ?? []
  const balance = computeCoinBalance(collections, settings.shopPurchases ?? [])
  const collectedIds = new Set(collections.map((c) => c.achievementId))
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Achievements</p>
          <p className="text-sm font-medium text-ink">
            {unlockedCount} of {achievements.length} earned
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Balance</p>
          <p className="text-lg font-semibold text-ink">{balance} 🪙</p>
        </div>
      </div>

      <AchievementSections achievements={achievements} collectedIds={collectedIds} />
      <Shop settings={settings} balance={balance} />
    </div>
  )
}
