import PixelButton from '../PixelButton'
import ProgressBar from './ProgressBar'

interface LessonHeaderProps {
  currentQuestion: number
  totalQuestions: number
  onBack: () => void
  lessonTitle: string
}

export default function LessonHeader({
  currentQuestion,
  totalQuestions,
  onBack,
  lessonTitle
}: LessonHeaderProps) {
  return (
    <div className="w-full bg-pet-panel border-b-3 border-pet-text px-3 py-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <PixelButton variant="secondary" size="sm" onClick={onBack}>
          ← Back
        </PixelButton>
        <span className="font-pixel text-[6px] text-pet-text-dim truncate flex-1 text-center">
          {lessonTitle}
        </span>
        <span className="font-pixel text-[7px] text-pet-text whitespace-nowrap">
          {currentQuestion}/{totalQuestions}
        </span>
      </div>
      <ProgressBar current={currentQuestion} total={totalQuestions} />
    </div>
  )
}
