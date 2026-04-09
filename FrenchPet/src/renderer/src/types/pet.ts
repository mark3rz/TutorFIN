export interface PetState {
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

export interface UserProgress {
  id: number
  current_level: number
  current_chapter: number
  total_xp: number
  streak_count: number
  last_session_at: string | null
}

export interface SrsItem {
  item_id: number
  type: string
  content: string
  easiness_factor: number
  interval: number
  next_review_date: string
  times_seen: number
  times_correct: number
}

export interface SessionLog {
  session_id: number
  date: string
  questions_answered: number
  correct_count: number
  xp_earned: number
  errors_json: string | null
}

export interface InventoryItem {
  item_id: number
  item_name: string
  equipped: number
}

export type PetVisualState = 'idle' | 'hungry' | 'sick' | 'dead'
