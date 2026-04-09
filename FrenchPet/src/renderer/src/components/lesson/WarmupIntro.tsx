import PixelButton from '../PixelButton'

interface WarmupIntroProps {
  onStart: () => void
  questionCount: number
}

export default function WarmupIntro({ onStart, questionCount }: WarmupIntroProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-pet-bg p-4">
      <div className="w-full max-w-md bg-pet-panel border-3 border-pet-text p-6 space-y-4 text-center">
        <div className="text-4xl">🔄</div>
        <h2 className="font-pixel text-[12px] text-pet-accent">
          Warm Up!
        </h2>
        <p className="font-pixel text-[7px] text-pet-text leading-relaxed">
          Let's review {questionCount} question{questionCount !== 1 ? 's' : ''} from previous lessons
        </p>
        <PixelButton onClick={onStart} className="w-full">
          Let's Go!
        </PixelButton>
      </div>
    </div>
  )
}
