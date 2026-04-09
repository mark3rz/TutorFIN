export const DECAY_RATES = {
  hunger: 2,
  mood: 1,
  happiness: 1,
  healthWhenStarving: 1
}

export const MAX_STAT = 100
export const FEED_COST = 5
export const FEED_AMOUNT = 20
export const PLAY_MOOD_BOOST = 15
export const PLAY_HAPPINESS_BOOST = 10

export const BAR_CONFIGS = [
  { key: 'health', label: 'HP', icon: '❤️', color: 'bg-pet-red' },
  { key: 'mood', label: 'MOOD', icon: '😊', color: 'bg-pet-blue' },
  { key: 'hunger', label: 'FOOD', icon: '🍖', color: 'bg-pet-orange' },
  { key: 'intelligence', label: 'INT', icon: '🧠', color: 'bg-pet-purple' },
  { key: 'happiness', label: 'JOY', icon: '✨', color: 'bg-pet-yellow' }
] as const

export const PET_STATE_THRESHOLDS = {
  dead: { health: 0 },
  sick: { health: 20 },
  hungry: { hunger: 30 },
  happy: { happiness: 60, health: 60 }
}

export const EVOLUTION_NAMES: Record<number, string> = {
  1: 'Egg',
  2: 'Chick',
  3: 'Cat',
  4: 'Fox',
  5: 'Wolf',
  6: 'Dragon'
}

// Lesson reward constants
export const LESSON_HUNGER_BOOST = 40
export const LESSON_MOOD_BOOST = 10
export const LESSON_BASE_XP = 50
export const LESSON_XP_PER_CORRECT = 5
export const LESSON_PERFECT_XP_BONUS = 25
export const LESSON_BASE_COINS = 50
export const LESSON_COIN_PER_CORRECT = 10
export const LESSON_COMPLETION_COIN_BONUS = 25
