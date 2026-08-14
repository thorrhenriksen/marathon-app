import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Session } from '../types'
import SessionDetailSheet from '../components/SessionDetailSheet'

interface SessionDetailContextValue {
  openSessionDetail: (session: Session) => void
}

const SessionDetailContext = createContext<SessionDetailContextValue | null>(null)

export function SessionDetailProvider({ children }: { children: ReactNode }) {
  const [openSession, setOpenSession] = useState<Session | null>(null)

  return (
    <SessionDetailContext.Provider value={{ openSessionDetail: setOpenSession }}>
      {children}
      {openSession && <SessionDetailSheet session={openSession} onClose={() => setOpenSession(null)} />}
    </SessionDetailContext.Provider>
  )
}

export function useSessionDetail(): SessionDetailContextValue {
  const ctx = useContext(SessionDetailContext)
  if (!ctx) throw new Error('useSessionDetail must be used within a SessionDetailProvider')
  return ctx
}
