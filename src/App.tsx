import { useEffect, useState, type ReactElement } from 'react'
import Today from './screens/Today'
import Plan from './screens/Plan'
import Log from './screens/Log'
import Progress from './screens/Progress'
import Settings from './screens/Settings'
import { seedDatabaseIfEmpty } from './db/seed'
import { runWeekRebaseMigration } from './db/weekRebaseMigration'
import { requestPersistentStorage } from './lib/storage'
import { SessionDetailProvider } from './context/SessionDetailContext'

type Tab = 'today' | 'plan' | 'log' | 'progress' | 'settings'

interface TabDef {
  id: Tab
  label: string
  icon: (active: boolean) => ReactElement
}

function TodayIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M12 2 15 8 21 9 16.5 13.2 17.8 19.5 12 16.3 6.2 19.5 7.5 13.2 3 9 9 8Z"
        className={active ? 'fill-accent' : 'fill-ink-faint'}
      />
    </svg>
  )
}

function PlanIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" className={active ? 'stroke-accent' : 'stroke-ink-faint'} strokeWidth="1.6" />
      <path d="M3.5 9.5h17" className={active ? 'stroke-accent' : 'stroke-ink-faint'} strokeWidth="1.6" />
      <path d="M8 2.5v4M16 2.5v4" className={active ? 'stroke-accent' : 'stroke-ink-faint'} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function LogIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path d="M5 3.5h14v17l-3-2-2 2-2-2-2 2-2-2-3 2Z" className={active ? 'stroke-accent' : 'stroke-ink-faint'} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" className={active ? 'stroke-accent' : 'stroke-ink-faint'} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ProgressIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path d="M4 20V10M10 20V4M16 20v-7M20 20V13" className={active ? 'stroke-accent' : 'stroke-ink-faint'} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SettingsIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <circle cx="12" cy="12" r="3" className={active ? 'stroke-accent' : 'stroke-ink-faint'} strokeWidth="1.6" />
      <path
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.5-2.4.7a7.7 7.7 0 0 0-1.7-1L15 3h-6l-.3 2.7a7.7 7.7 0 0 0-1.7 1l-2.4-.7-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-.7a7.7 7.7 0 0 0 1.7 1L9 21h6l.3-2.7a7.7 7.7 0 0 0 1.7-1l2.4.7 2-3.5Z"
        className={active ? 'stroke-accent' : 'stroke-ink-faint'}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const TABS: TabDef[] = [
  { id: 'today', label: 'Today', icon: TodayIcon },
  { id: 'plan', label: 'Plan', icon: PlanIcon },
  { id: 'log', label: 'Log', icon: LogIcon },
  { id: 'progress', label: 'Progress', icon: ProgressIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

function App() {
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('today')

  useEffect(() => {
    let cancelled = false
    async function init() {
      await runWeekRebaseMigration()
      await seedDatabaseIfEmpty()
      await requestPersistentStorage()
      if (!cancelled) setReady(true)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg">
        <p className="text-sm text-ink-faint">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-bg text-ink">
      <div className="flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
        <SessionDetailProvider>
          {activeTab === 'today' && <Today />}
          {activeTab === 'plan' && <Plan />}
          {activeTab === 'log' && <Log />}
          {activeTab === 'progress' && <Progress />}
          {activeTab === 'settings' && <Settings />}
        </SessionDetailProvider>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {TABS.map((tab) => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              {tab.icon(active)}
              <span className={`text-[11px] font-medium ${active ? 'text-accent' : 'text-ink-faint'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default App
