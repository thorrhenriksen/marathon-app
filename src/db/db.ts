import Dexie, { type Table } from 'dexie'
import type { Session, Run, Goal, TimeOff, Settings, WeekMeta } from '../types'

export class MarathonDB extends Dexie {
  sessions!: Table<Session, string>
  runs!: Table<Run, string>
  goals!: Table<Goal, string>
  timeOff!: Table<TimeOff, string>
  settings!: Table<Settings, string>
  weeks!: Table<WeekMeta, number>

  constructor() {
    super('marathon-training-db')
    this.version(1).stores({
      sessions: 'id, date, week, status',
      runs: 'id, date, linkedSessionId',
      goals: 'id',
      timeOff: 'id, startDate, endDate',
      settings: 'id',
      weeks: 'week',
    })
  }
}

export const db = new MarathonDB()
