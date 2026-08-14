import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Settings } from '../types'

type ThemeMode = Settings['theme']
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'marathon-theme'

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  return theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#fafafa')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const theme = settings?.theme ?? 'system'
  const resolvedTheme = resolveTheme(theme, systemPrefersDark)

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore storage errors (private browsing, etc.)
    }
  }, [theme, resolvedTheme])

  async function setTheme(next: ThemeMode) {
    await db.settings.update('settings', { theme: next })
  }

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
