import { contextBridge, ipcRenderer } from 'electron'

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

const api = {
  getPetState: (): Promise<PetState> => ipcRenderer.invoke('get-pet-state'),
  updatePetState: (updates: Partial<PetState>): Promise<PetState> =>
    ipcRenderer.invoke('update-pet-state', updates),
  getUserProgress: (): Promise<UserProgress> => ipcRenderer.invoke('get-user-progress'),
  updateUserProgress: (updates: Partial<UserProgress>): Promise<UserProgress> =>
    ipcRenderer.invoke('update-user-progress', updates),
  feedPet: (): Promise<PetState> => ipcRenderer.invoke('feed-pet'),
  playWithPet: (): Promise<PetState> => ipcRenderer.invoke('play-with-pet'),
  resetPet: (): Promise<PetState> => ipcRenderer.invoke('reset-pet'),
  completeLesson: (result: any): Promise<any> => ipcRenderer.invoke('complete-lesson', result),
  getLessonProgress: (): Promise<any[]> => ipcRenderer.invoke('get-lesson-progress'),
  getApiKey: (): Promise<string | null> => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key: string): Promise<boolean> => ipcRenderer.invoke('set-api-key', key),
  deleteApiKey: (): Promise<boolean> => ipcRenderer.invoke('delete-api-key'),
  onPetStateUpdate: (callback: (state: PetState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: PetState): void => {
      callback(state)
    }
    ipcRenderer.on('pet-state-updated', handler)
    return () => ipcRenderer.removeListener('pet-state-updated', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
