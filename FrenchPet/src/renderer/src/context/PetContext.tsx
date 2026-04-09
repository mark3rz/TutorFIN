import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { PetState } from '../types/pet'

interface PetContextType {
  petState: PetState | null
  isLoading: boolean
  feedPet: () => Promise<void>
  playWithPet: () => Promise<void>
  resetPet: () => Promise<void>
  refreshPet: () => Promise<void>
}

const PetContext = createContext<PetContextType | null>(null)

export function PetProvider({ children }: { children: ReactNode }) {
  const [petState, setPetState] = useState<PetState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    window.api.getPetState().then((state) => {
      setPetState(state)
      setIsLoading(false)
    })

    const unsubscribe = window.api.onPetStateUpdate((state) => {
      setPetState(state)
    })

    return unsubscribe
  }, [])

  const feedPet = useCallback(async () => {
    const updated = await window.api.feedPet()
    setPetState(updated)
  }, [])

  const playWithPet = useCallback(async () => {
    const updated = await window.api.playWithPet()
    setPetState(updated)
  }, [])

  const resetPet = useCallback(async () => {
    const updated = await window.api.resetPet()
    setPetState(updated)
  }, [])

  const refreshPet = useCallback(async () => {
    const updated = await window.api.getPetState()
    setPetState(updated)
  }, [])

  return (
    <PetContext.Provider value={{ petState, isLoading, feedPet, playWithPet, resetPet, refreshPet }}>
      {children}
    </PetContext.Provider>
  )
}

export function usePet(): PetContextType {
  const ctx = useContext(PetContext)
  if (!ctx) throw new Error('usePet must be used within PetProvider')
  return ctx
}
