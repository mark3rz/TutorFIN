import PixelButton from '../PixelButton'

interface LessonSummaryProps {
  totalCorrect: number
  totalQuestions: number
  xpEarned: number
  coinsEarned: number
  onNextLesson: () => void
  onBackToPet: () => void
  hasNextLesson: boolean
}

export default function LessonSummary({
  totalCorrect,
  totalQuestions,
  xpEarned,
  coinsEarned,
  onNextLesson,
  onBackToPet,
  hasNextLesson
}: LessonSummaryProps) {
  const percentage = Math.round((totalCorrect / totalQuestions) * 100)

  const getStars = () => {
    if (percentage >= 90) return '⭐⭐⭐'
    if (percentage >= 70) return '⭐⭐'
    return '⭐'
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-pet-bg p-4">
      <div className="w-full max-w-md bg-pet-panel border-3 border-pet-text p-6 space-y-4">
        <div className="text-center space-y-3">
          <h2 className="font-pixel text-[14px] text-pet-accent">
            Lesson Complete!
          </h2>

          <div className="text-4xl">
            {getStars()}
          </div>

          <div className="bg-pet-bg border-2 border-pet-text-dim p-3">
            <div className="font-pixel text-[12px] text-pet-text">
              {totalCorrect}/{totalQuestions}
            </div>
            <div className="font-pixel text-[8px] text-pet-accent">
              {percentage}%
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between bg-pet-bg-light border-2 border-pet-blue p-2">
            <span className="font-pixel text-[7px] text-pet-text">XP Earned:</span>
            <span className="font-pixel text-[8px] text-pet-blue">+{xpEarned}</span>
          </div>

          <div className="flex items-center justify-between bg-pet-bg-light border-2 border-pet-gold p-2">
            <span className="font-pixel text-[7px] text-pet-text">Coins Earned:</span>
            <span className="font-pixel text-[8px] text-pet-gold">+{coinsEarned}</span>
          </div>
        </div>

        <div className="bg-pet-green/20 border-2 border-pet-green p-3 text-center">
          <p className="font-pixel text-[7px] text-pet-text">
            Your pet was fed! 🍖
          </p>
        </div>

        <div className="space-y-2">
          {hasNextLesson && (
            <PixelButton onClick={onNextLesson} className="w-full">
              Next Lesson →
            </PixelButton>
          )}
          <PixelButton
            variant="secondary"
            onClick={onBackToPet}
            className="w-full"
          >
            Back to Pet
          </PixelButton>
        </div>
      </div>
    </div>
  )
}
