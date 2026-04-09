import type { PetState, UserProgress } from './pet'

export interface IElectronAPI {
  getPetState: () => Promise<PetState>
  updatePetState: (updates: Partial<PetState>) => Promise<PetState>
  getUserProgress: () => Promise<UserProgress>
  updateUserProgress: (updates: Partial<UserProgress>) => Promise<UserProgress>
  feedPet: () => Promise<PetState>
  playWithPet: () => Promise<PetState>
  resetPet: () => Promise<PetState>
  completeLesson: (result: any) => Promise<{ petState: PetState; userProgress: UserProgress }>
  getLessonProgress: () => Promise<Array<{ lesson_id: string; completed: number; best_score: number; attempts: number; last_attempt_at: string | null }>>
  getApiKey: () => Promise<string | null>
  setApiKey: (key: string) => Promise<boolean>
  deleteApiKey: () => Promise<boolean>
  onPetStateUpdate: (callback: (state: PetState) => void) => () => void
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}
