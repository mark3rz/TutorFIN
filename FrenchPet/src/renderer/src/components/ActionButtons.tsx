import { usePet } from '../context/PetContext'
import PixelButton from './PixelButton'
import { FEED_COST } from '../lib/constants'

interface ActionButtonsProps {
  onStartLesson: () => void
}

export default function ActionButtons({ onStartLesson }: ActionButtonsProps) {
  const { petState, feedPet, playWithPet, resetPet } = usePet()

  const isDead = petState?.health === 0
  const canFeed = !isDead && (petState?.coins ?? 0) >= FEED_COST
  const canPlay = !isDead

  return (
    <div className="flex flex-col gap-2 w-full px-4">
      {isDead ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-pixel text-[7px] text-pet-text-dim text-center leading-relaxed">
            Your pet has died. Start a new life to continue learning French.
          </p>
          <PixelButton variant="danger" onClick={resetPet}>
            New Life
          </PixelButton>
        </div>
      ) : (
        <>
          <div className="flex gap-2 justify-center">
            <PixelButton
              size="sm"
              onClick={feedPet}
              disabled={!canFeed}
              title={!canFeed ? `Need ${FEED_COST} coins` : 'Feed your pet'}
            >
              🍖 Feed ({FEED_COST}c)
            </PixelButton>
            <PixelButton
              size="sm"
              onClick={playWithPet}
              disabled={!canPlay}
              title="Play with your pet"
            >
              🎮 Play
            </PixelButton>
          </div>
          <PixelButton
            variant="primary"
            onClick={onStartLesson}
            className="w-full"
          >
            📚 Start Lesson
          </PixelButton>
        </>
      )}
    </div>
  )
}
