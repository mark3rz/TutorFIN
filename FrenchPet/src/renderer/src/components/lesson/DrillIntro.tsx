import PixelButton from '../PixelButton'

interface DrillIntroProps {
  onStart: () => void
  questionCount: number
}

export default function DrillIntro({ onStart, questionCount }: DrillIntroProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-pet-bg p-4">
      <div className="w-full max-w-md bg-pet-panel border-3 border-pet-text p-6 space-y-4 text-center">
        <div className="text-4xl">🎯</div>
        <h2 className="font-pixel text-[12px] text-pet-accent">
          Practice Time!
        </h2>
        <p className="font-pixel text-[7px] text-pet-text leading-relaxed">
          {questionCount} question{questionCount !== 1 ? 's' : ''} to test your knowledge
        </p>
        <PixelButton onClick={onStart} className="w-full">
          Start Practice
        </PixelButton>
      </div>
    </div>
  )
}
