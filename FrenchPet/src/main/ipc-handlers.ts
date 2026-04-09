import { ipcMain } from 'electron'
import { getPetState, updatePetState, getUserProgress, updateUserProgress, getLessonProgress, upsertLessonProgress, insertSessionLog } from './database'
import { saveApiKey, loadApiKey, deleteApiKey } from './safe-storage'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function registerIpcHandlers(): void {
  ipcMain.handle('get-pet-state', () => {
    return getPetState()
  })

  ipcMain.handle('update-pet-state', (_event, updates) => {
    return updatePetState(updates)
  })

  ipcMain.handle('get-user-progress', () => {
    return getUserProgress()
  })

  ipcMain.handle('update-user-progress', (_event, updates) => {
    return updateUserProgress(updates)
  })

  ipcMain.handle('feed-pet', () => {
    const state = getPetState()
    if (state.health <= 0) return state // Can't feed a dead pet
    if (state.coins < 5) return state // Not enough coins

    return updatePetState({
      hunger: clamp(state.hunger + 20, 0, 100),
      coins: state.coins - 5
    })
  })

  ipcMain.handle('play-with-pet', () => {
    const state = getPetState()
    if (state.health <= 0) return state // Can't play with dead pet

    return updatePetState({
      mood: clamp(state.mood + 15, 0, 100),
      happiness: clamp(state.happiness + 10, 0, 100)
    })
  })

  ipcMain.handle('get-api-key', () => {
    return loadApiKey()
  })

  ipcMain.handle('set-api-key', (_event, key: string) => {
    saveApiKey(key)
    return true
  })

  ipcMain.handle('delete-api-key', () => {
    deleteApiKey()
    return true
  })

  ipcMain.handle('reset-pet', () => {
    return updatePetState({
      health: 100,
      mood: 100,
      hunger: 100,
      happiness: 100,
      coins: 100,
      last_fed_at: new Date().toISOString()
    })
  })

  ipcMain.handle('complete-lesson', (_event, result: {
    lessonId: string
    questionsAnswered: number
    correctCount: number
    wrongAnswers: Array<{ questionId: string; userAnswer: string; correctAnswer: string }>
    xpEarned: number
    coinsEarned: number
  }) => {
    const state = getPetState()

    const updatedPet = updatePetState({
      hunger: clamp(state.hunger + 40, 0, 100),
      mood: clamp(state.mood + 10, 0, 100),
      intelligence: clamp(state.intelligence + Math.floor((result.correctCount / result.questionsAnswered) * 10), 0, 100),
      coins: state.coins + result.coinsEarned,
      last_fed_at: new Date().toISOString()
    })

    const progress = getUserProgress()
    const updatedProgress = updateUserProgress({
      total_xp: progress.total_xp + result.xpEarned,
      last_session_at: new Date().toISOString()
    })

    insertSessionLog({
      questions_answered: result.questionsAnswered,
      correct_count: result.correctCount,
      xp_earned: result.xpEarned,
      errors_json: JSON.stringify(result.wrongAnswers)
    })

    const score = result.questionsAnswered > 0 ? (result.correctCount / result.questionsAnswered) * 100 : 0
    upsertLessonProgress(result.lessonId, score)

    return { petState: updatedPet, userProgress: updatedProgress }
  })

  ipcMain.handle('get-lesson-progress', () => {
    return getLessonProgress()
  })
}
