import { BrowserWindow } from 'electron'
import { getPetState, updatePetState } from './database'

const DECAY_INTERVAL_MS = 60_000 // 60 seconds
const HUNGER_DECAY = 2
const MOOD_DECAY = 1
const HAPPINESS_DECAY = 1
const HEALTH_DECAY_WHEN_STARVING = 1

let timerHandle: ReturnType<typeof setInterval> | null = null

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function applyRetroactiveDecay(): void {
  const state = getPetState()
  if (state.health <= 0) return // Pet is already dead

  const lastFed = new Date(state.last_fed_at + 'Z').getTime()
  const now = Date.now()
  const elapsedMs = now - lastFed
  const elapsedMinutes = Math.floor(elapsedMs / 60_000)

  // Cap at 24 hours (1440 minutes)
  const cappedMinutes = Math.min(elapsedMinutes, 1440)

  if (cappedMinutes <= 0) return

  let hunger = state.hunger
  let mood = state.mood
  let happiness = state.happiness
  let health = state.health

  for (let i = 0; i < cappedMinutes; i++) {
    hunger = clamp(hunger - HUNGER_DECAY, 0, 100)
    mood = clamp(mood - MOOD_DECAY, 0, 100)
    happiness = clamp(happiness - HAPPINESS_DECAY, 0, 100)

    if (hunger === 0) {
      health = clamp(health - HEALTH_DECAY_WHEN_STARVING, 0, 100)
    }

    if (health === 0) break
  }

  updatePetState({ hunger, mood, happiness, health, last_fed_at: new Date().toISOString() })
}

export function startDecayTimer(mainWindow: BrowserWindow): void {
  if (timerHandle) clearInterval(timerHandle)

  timerHandle = setInterval(() => {
    const state = getPetState()

    if (state.health <= 0) return // Pet is dead, no further decay

    let hunger = clamp(state.hunger - HUNGER_DECAY, 0, 100)
    let mood = clamp(state.mood - MOOD_DECAY, 0, 100)
    let happiness = clamp(state.happiness - HAPPINESS_DECAY, 0, 100)
    let health = state.health

    if (hunger === 0) {
      health = clamp(health - HEALTH_DECAY_WHEN_STARVING, 0, 100)
    }

    const updated = updatePetState({ hunger, mood, happiness, health })

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pet-state-updated', updated)
    }
  }, DECAY_INTERVAL_MS)
}

export function stopDecayTimer(): void {
  if (timerHandle) {
    clearInterval(timerHandle)
    timerHandle = null
  }
}
