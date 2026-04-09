import PixelButton from '../PixelButton'

interface FeedbackOverlayProps {
  isCorrect: boolean
  explanation: string
  correctAnswer: string
  onNext: () => void
}

export default function FeedbackOverlay({
  isCorrect,
  explanation,
  correctAnswer,
  onNext
}: FeedbackOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 animate-in slide-in-from-bottom duration-300">
      <div
        className={`
          w-full max-w-md bg-pet-panel
          border-3 ${isCorrect ? 'border-pet-green' : 'border-pet-red'}
          p-4 space-y-3
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {isCorrect ? '✓' : '✗'}
          </span>
          <h3 className={`font-pixel text-[10px] ${isCorrect ? 'text-pet-green' : 'text-pet-red'}`}>
            {isCorrect ? 'Correct!' : 'Not quite...'}
          </h3>
        </div>

        <div className="bg-pet-bg border-2 border-pet-text-dim p-3">
          <p className="font-pixel text-[7px] text-pet-text leading-relaxed">
            {explanation}
          </p>
        </div>

        {!isCorrect && (
          <div className="bg-pet-bg border-2 border-pet-green p-3">
            <p className="font-pixel text-[6px] text-pet-text-dim mb-1">
              Correct answer:
            </p>
            <p className="font-pixel text-[7px] text-pet-green">
              {correctAnswer}
            </p>
          </div>
        )}

        <PixelButton onClick={onNext} className="w-full">
          Next →
        </PixelButton>
      </div>
    </div>
  )
}
