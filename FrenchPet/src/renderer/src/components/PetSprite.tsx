import { useMemo } from 'react'
import { usePet } from '../context/PetContext'
import type { PetVisualState } from '../types/pet'
import '../styles/sprites.css'

function getPetVisualState(health: number, hunger: number, happiness: number): PetVisualState {
  if (health <= 0) return 'dead'
  if (health < 20) return 'sick'
  if (hunger < 30) return 'hungry'
  return 'idle'
}

function getSpriteClass(state: PetVisualState): string {
  switch (state) {
    case 'dead': return 'sprite-dead'
    case 'sick': return 'sprite-sick'
    case 'hungry': return 'sprite-hungry'
    case 'idle': return 'sprite-idle'
  }
}

function getAnimationClass(state: PetVisualState, happiness: number): string {
  switch (state) {
    case 'dead': return ''
    case 'sick': return 'animate-breathe'
    case 'hungry': return 'animate-droop-pixel'
    case 'idle': return happiness > 60 ? 'animate-bounce-pixel' : ''
  }
}

export default function PetSprite() {
  const { petState } = usePet()

  const visualState = useMemo(() => {
    if (!petState) return 'idle' as PetVisualState
    return getPetVisualState(petState.health, petState.hunger, petState.happiness)
  }, [petState?.health, petState?.hunger, petState?.happiness])

  const spriteClass = getSpriteClass(visualState)
  const animationClass = getAnimationClass(visualState, petState?.happiness ?? 0)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="pet-sprite-container flex items-center justify-center">
        <div className={`${spriteClass} ${animationClass}`} />
      </div>
      {visualState === 'dead' && (
        <p className="font-pixel text-[8px] text-pet-red animate-pulse">
          Your pet has passed away...
        </p>
      )}
      {visualState === 'sick' && (
        <p className="font-pixel text-[6px] text-pet-orange">
          Your pet is feeling very sick!
        </p>
      )}
      {visualState === 'hungry' && (
        <p className="font-pixel text-[6px] text-pet-yellow">
          Your pet is hungry...
        </p>
      )}
    </div>
  )
}
