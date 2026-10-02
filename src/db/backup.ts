// Backup export/import. The payload shape is pure so the round-trip can be
// tested without IndexedDB; the Dexie I/O is a thin wrapper around it.

import { db } from './db'
import { EMPTY_STRAVA_STATE } from '../lib/strava'
import type { Goal, Run, Session, Settings, StravaState, TimeOff, WeekMeta } from '../types'

export interface BackupPayload {
  exportedAt: string
  sessions: Session[]
  runs: Run[]
  goals: Goal[]
  timeOff: TimeOff[]
  settings: Settings[]
  weeks: WeekMeta[]
  /** Absent in backups made before the Strava integration. */
  strava?: StravaState[]
}

export function buildBackupPayload(tables: Omit<BackupPayload, 'exportedAt'>, exportedAt: string): BackupPayload {
  return {
    exportedAt,
    ...tables,
    // An in-flight OAuth state is meaningless on another device or later.
    strava: (tables.strava ?? []).map(({ pendingOAuthState: _pending, ...rest }) => rest),
  }
}

export function parseBackup(text: string): BackupPayload {
  const data = JSON.parse(text)
  if (!data.sessions || !data.weeks || !data.settings || !data.goals) {
    throw new Error('This file does not look like a valid backup.')
  }
  return data as BackupPayload
}

/** Strava state to keep after a restore. Imported/ignored ids are the union
 *  of the device's and the backup's, so restoring never resurfaces a run as
 *  a new card. The device's live connection wins over the backup's (whose
 *  tokens may have been rotated since); the backup's is used when the device
 *  has none. Cached activities come along so pending cards stay accurate. */
export function mergeStravaOnRestore(current: StravaState | undefined, backup: StravaState | undefined): StravaState {
  const cur = current ?? EMPTY_STRAVA_STATE
  const bak = backup ?? EMPTY_STRAVA_STATE
  const union = (a: number[], b: number[]) => Array.from(new Set([...a, ...b]))
  const connection = cur.connection ?? bak.connection
  return {
    id: 'strava',
    connection,
    importedActivityIds: union(cur.importedActivityIds, bak.importedActivityIds ?? []),
    ignoredActivityIds: union(cur.ignoredActivityIds, bak.ignoredActivityIds ?? []),
    recentActivities: cur.connection ? cur.recentActivities : (bak.recentActivities ?? []),
    lastFetchAttemptAt: cur.connection ? cur.lastFetchAttemptAt : undefined,
  }
}

export async function exportBackup(): Promise<BackupPayload> {
  const [sessions, runs, goals, timeOff, settings, weeks, strava] = await Promise.all([
    db.sessions.toArray(),
    db.runs.toArray(),
    db.goals.toArray(),
    db.timeOff.toArray(),
    db.settings.toArray(),
    db.weeks.toArray(),
    db.strava.toArray(),
  ])
  return buildBackupPayload({ sessions, runs, goals, timeOff, settings, weeks, strava }, new Date().toISOString())
}

export async function restoreBackup(data: BackupPayload): Promise<void> {
  await db.transaction(
    'rw',
    [db.sessions, db.runs, db.goals, db.timeOff, db.settings, db.weeks, db.strava],
    async () => {
      const currentStrava = await db.strava.get('strava')
      const strava = mergeStravaOnRestore(currentStrava, data.strava?.[0])
      await Promise.all([
        db.sessions.clear(),
        db.runs.clear(),
        db.goals.clear(),
        db.timeOff.clear(),
        db.settings.clear(),
        db.weeks.clear(),
        db.strava.clear(),
      ])
      await db.sessions.bulkAdd(data.sessions)
      await db.runs.bulkAdd(data.runs ?? [])
      await db.goals.bulkAdd(data.goals)
      await db.timeOff.bulkAdd(data.timeOff ?? [])
      await db.settings.bulkAdd(data.settings)
      await db.weeks.bulkAdd(data.weeks)
      await db.strava.put(strava)
    },
  )
}
