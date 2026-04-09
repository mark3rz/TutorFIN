import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database

export function initDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'frenchpet.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      health INTEGER NOT NULL DEFAULT 100,
      mood INTEGER NOT NULL DEFAULT 100,
      hunger INTEGER NOT NULL DEFAULT 100,
      intelligence INTEGER NOT NULL DEFAULT 0,
      happiness INTEGER NOT NULL DEFAULT 100,
      evolution_stage INTEGER NOT NULL DEFAULT 1,
      coins INTEGER NOT NULL DEFAULT 100,
      last_fed_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_level INTEGER NOT NULL DEFAULT 1,
      current_chapter INTEGER NOT NULL DEFAULT 1,
      total_xp INTEGER NOT NULL DEFAULT 0,
      streak_count INTEGER NOT NULL DEFAULT 0,
      last_session_at TEXT
    );

    CREATE TABLE IF NOT EXISTS srs_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      easiness_factor REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 1,
      next_review_date TEXT NOT NULL DEFAULT (date('now')),
      times_seen INTEGER NOT NULL DEFAULT 0,
      times_correct INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_log (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL DEFAULT (datetime('now')),
      questions_answered INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      equipped INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      lesson_id TEXT PRIMARY KEY,
      completed INTEGER NOT NULL DEFAULT 0,
      best_score REAL NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT
    );
  `)

  // Insert default rows if they don't exist
  const petRow = db.prepare('SELECT id FROM pet_state WHERE id = 1').get()
  if (!petRow) {
    db.prepare('INSERT INTO pet_state (id) VALUES (1)').run()
  }

  const progressRow = db.prepare('SELECT id FROM user_progress WHERE id = 1').get()
  if (!progressRow) {
    db.prepare('INSERT INTO user_progress (id) VALUES (1)').run()
  }

  return db
}

export function getDb(): Database.Database {
  return db
}

export interface PetStateRow {
  id: number
  health: number
  mood: number
  hunger: number
  intelligence: number
  happiness: number
  evolution_stage: number
  coins: number
  last_fed_at: string
  created_at: string
}

export interface UserProgressRow {
  id: number
  current_level: number
  current_chapter: number
  total_xp: number
  streak_count: number
  last_session_at: string | null
}

export function getPetState(): PetStateRow {
  return db.prepare('SELECT * FROM pet_state WHERE id = 1').get() as PetStateRow
}

export function updatePetState(updates: Partial<PetStateRow>): PetStateRow {
  const fields = Object.keys(updates).filter(k => k !== 'id')
  if (fields.length === 0) return getPetState()

  const setClause = fields.map(f => `${f} = @${f}`).join(', ')
  db.prepare(`UPDATE pet_state SET ${setClause} WHERE id = 1`).run(updates)
  return getPetState()
}

export function getUserProgress(): UserProgressRow {
  return db.prepare('SELECT * FROM user_progress WHERE id = 1').get() as UserProgressRow
}

export function updateUserProgress(updates: Partial<UserProgressRow>): UserProgressRow {
  const fields = Object.keys(updates).filter(k => k !== 'id')
  if (fields.length === 0) return getUserProgress()

  const setClause = fields.map(f => `${f} = @${f}`).join(', ')
  db.prepare(`UPDATE user_progress SET ${setClause} WHERE id = 1`).run(updates)
  return getUserProgress()
}

export function getLessonProgress(): Array<{lesson_id: string; completed: number; best_score: number; attempts: number; last_attempt_at: string | null}> {
  return db.prepare('SELECT * FROM lesson_progress').all() as any[]
}

export function upsertLessonProgress(lessonId: string, score: number): void {
  const existing = db.prepare('SELECT * FROM lesson_progress WHERE lesson_id = ?').get(lessonId) as any
  if (existing) {
    db.prepare(`
      UPDATE lesson_progress
      SET completed = 1,
          best_score = MAX(best_score, ?),
          attempts = attempts + 1,
          last_attempt_at = datetime('now')
      WHERE lesson_id = ?
    `).run(score, lessonId)
  } else {
    db.prepare(`
      INSERT INTO lesson_progress (lesson_id, completed, best_score, attempts, last_attempt_at)
      VALUES (?, 1, ?, 1, datetime('now'))
    `).run(lessonId, score)
  }
}

export function insertSessionLog(data: { questions_answered: number; correct_count: number; xp_earned: number; errors_json: string }): void {
  db.prepare(`
    INSERT INTO session_log (questions_answered, correct_count, xp_earned, errors_json)
    VALUES (?, ?, ?, ?)
  `).run(data.questions_answered, data.correct_count, data.xp_earned, data.errors_json)
}
