import type { Question } from '../../types/lesson'
import MultipleChoiceCard from './MultipleChoiceCard'
import FillBlankCard from './FillBlankCard'
import TranslationCard from './TranslationCard'
import ErrorCorrectionCard from './ErrorCorrectionCard'

interface QuestionCardProps {
  question: Question
  onSubmit: (answer: string | number) => void
  disabled?: boolean
}

export default function QuestionCard({
  question,
  onSubmit,
  disabled = false
}: QuestionCardProps) {
  switch (question.type) {
    case 'multiple_choice':
      return (
        <MultipleChoiceCard
          prompt={question.prompt}
          options={question.options}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      )

    case 'fill_blank':
      return (
        <FillBlankCard
          sentence={question.sentence}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      )

    case 'translation':
      return (
        <TranslationCard
          direction={question.direction}
          sourceText={question.sourceText}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      )

    case 'error_correction':
      return (
        <ErrorCorrectionCard
          incorrectSentence={question.incorrectSentence}
          options={question.options}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      )

    default:
      return null
  }
}
