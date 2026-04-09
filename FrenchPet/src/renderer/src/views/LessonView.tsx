import { useState, useEffect } from 'react'
import useLessonEngine from '../hooks/useLessonEngine'
import { usePet } from '../context/PetContext'
import { getNextLesson } from '../data/lessons'
import LessonSelector from '../components/lesson/LessonSelector'
import LessonHeader from '../components/lesson/LessonHeader'
import WarmupIntro from '../components/lesson/WarmupIntro'
import QuestionCard from '../components/lesson/QuestionCard'
import FeedbackOverlay from '../components/lesson/FeedbackOverlay'
import ComprehensibleInputView from '../components/lesson/ComprehensibleInputView'
import DrillIntro from '../components/lesson/DrillIntro'
import LessonSummary from '../components/lesson/LessonSummary'
import PetReactionCorner from '../components/lesson/PetReactionCorner'
import type { LessonProgress, LessonResult } from '../types/lesson'

interface LessonViewProps {
  onBack: () => void
}

export default function LessonView({ onBack }: LessonViewProps) {
  const {
    state,
    selectLesson,
    submitAnswer,
    nextQuestion,
    acknowledgeInput,
    startDrills,
    startWarmup,
    backToSelector,
    calculateRewards
  } = useLessonEngine()

  const { refreshPet } = usePet()
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load completed lesson IDs on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const progress: LessonProgress[] = await window.api.getLessonProgress()
        const completed = progress.filter(p => p.completed === 1).map(p => p.lesson_id)
        setCompletedLessonIds(completed)
      } catch (error) {
        console.error('Failed to load lesson progress:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadProgress()
  }, [])

  // Auto-skip input_intro phase
  useEffect(() => {
    if (state.phase === 'input_intro') {
      nextQuestion()
    }
  }, [state.phase, nextQuestion])

  // Handle lesson completion
  useEffect(() => {
    if (state.phase === 'summary' && state.currentLesson) {
      const handleCompletion = async () => {
        const rewards = calculateRewards()

        // Build wrong answers array
        const wrongAnswers = state.answers
          .filter(a => !a.correct)
          .map(a => ({
            questionId: a.questionId,
            userAnswer: a.userAnswer,
            correctAnswer: a.correctAnswer
          }))

        const result: LessonResult = {
          lessonId: state.currentLesson.id,
          questionsAnswered: state.totalAnswered,
          correctCount: state.totalCorrect,
          wrongAnswers,
          xpEarned: rewards.xpEarned,
          coinsEarned: rewards.coinsEarned
        }

        try {
          await window.api.completeLesson(result)

          // Update completed lessons
          if (!completedLessonIds.includes(state.currentLesson.id)) {
            setCompletedLessonIds(prev => [...prev, state.currentLesson!.id])
          }

          // Refresh pet state
          await refreshPet()
        } catch (error) {
          console.error('Failed to save lesson completion:', error)
        }
      }

      handleCompletion()
    }
  }, [state.phase, state.currentLesson, state.answers, state.totalAnswered, state.totalCorrect, calculateRewards, completedLessonIds, refreshPet])

  // Handle back button in lesson header
  const handleBackFromLesson = () => {
    const confirmed = window.confirm('Are you sure you want to exit this lesson? Your progress will be lost.')
    if (confirmed) {
      backToSelector()
    }
  }

  // Handle next lesson
  const handleNextLesson = () => {
    if (state.currentLesson) {
      const nextLesson = getNextLesson(state.currentLesson.id)
      if (nextLesson) {
        selectLesson(nextLesson)
      }
    }
  }

  // Get correct answer string for feedback
  const getCorrectAnswer = (): string => {
    if (!state.currentQuestion) return ''

    const question = state.currentQuestion
    if (question.type === 'multiple_choice' || question.type === 'error_correction') {
      return question.options[question.correctIndex]
    } else {
      return question.correctAnswer
    }
  }

  // Determine pet reaction
  const getPetReaction = (): 'neutral' | 'happy' | 'sad' => {
    if (state.phase === 'warmup_feedback' || state.phase === 'drill_feedback') {
      return state.isCorrect ? 'happy' : 'sad'
    }
    return 'neutral'
  }

  // Determine if there's a next lesson
  const getHasNextLesson = (): boolean => {
    if (!state.currentLesson) return false
    return getNextLesson(state.currentLesson.id) !== undefined
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-pet-bg">
        <p className="font-pixel text-[8px] text-pet-text-dim">Loading lessons...</p>
      </div>
    )
  }

  // Render based on phase
  switch (state.phase) {
    case 'selecting':
      return (
        <LessonSelector
          onSelectLesson={selectLesson}
          completedLessonIds={completedLessonIds}
          onBack={onBack}
        />
      )

    case 'warmup_intro':
      return (
        <WarmupIntro
          onStart={startWarmup}
          questionCount={state.currentLesson?.warmup.length ?? 0}
        />
      )

    case 'warmup_question':
      return (
        <div className="relative h-screen bg-pet-bg">
          <LessonHeader
            currentQuestion={state.currentQuestionIndex + 1}
            totalQuestions={state.totalQuestions}
            onBack={handleBackFromLesson}
            lessonTitle={state.currentLesson?.title ?? ''}
          />
          <div className="flex items-center justify-center pt-20 pb-16 px-4">
            {state.currentQuestion && (
              <QuestionCard
                question={state.currentQuestion}
                onSubmit={submitAnswer}
              />
            )}
          </div>
          <PetReactionCorner reaction={getPetReaction()} />
        </div>
      )

    case 'warmup_feedback':
      return (
        <div className="relative h-screen bg-pet-bg">
          <LessonHeader
            currentQuestion={state.currentQuestionIndex + 1}
            totalQuestions={state.totalQuestions}
            onBack={handleBackFromLesson}
            lessonTitle={state.currentLesson?.title ?? ''}
          />
          <div className="flex items-center justify-center pt-20 pb-16 px-4">
            {state.currentQuestion && (
              <>
                <QuestionCard
                  question={state.currentQuestion}
                  onSubmit={submitAnswer}
                  disabled={true}
                />
                <FeedbackOverlay
                  isCorrect={state.isCorrect ?? false}
                  explanation={state.currentQuestion.explanation}
                  correctAnswer={getCorrectAnswer()}
                  onNext={nextQuestion}
                />
              </>
            )}
          </div>
          <PetReactionCorner reaction={getPetReaction()} />
        </div>
      )

    case 'comprehensible_input':
      return (
        <ComprehensibleInputView
          input={state.currentLesson?.comprehensibleInput ?? {
            title: '',
            frenchText: '',
            englishHint: '',
            vocabularyHighlights: []
          }}
          onContinue={acknowledgeInput}
        />
      )

    case 'drill_intro':
      return (
        <DrillIntro
          onStart={startDrills}
          questionCount={state.currentLesson?.drillQuestions.length ?? 0}
        />
      )

    case 'drill_question':
      return (
        <div className="relative h-screen bg-pet-bg">
          <LessonHeader
            currentQuestion={state.currentQuestionIndex + 1}
            totalQuestions={state.totalQuestions}
            onBack={handleBackFromLesson}
            lessonTitle={state.currentLesson?.title ?? ''}
          />
          <div className="flex items-center justify-center pt-20 pb-16 px-4">
            {state.currentQuestion && (
              <QuestionCard
                question={state.currentQuestion}
                onSubmit={submitAnswer}
              />
            )}
          </div>
          <PetReactionCorner reaction={getPetReaction()} />
        </div>
      )

    case 'drill_feedback':
      return (
        <div className="relative h-screen bg-pet-bg">
          <LessonHeader
            currentQuestion={state.currentQuestionIndex + 1}
            totalQuestions={state.totalQuestions}
            onBack={handleBackFromLesson}
            lessonTitle={state.currentLesson?.title ?? ''}
          />
          <div className="flex items-center justify-center pt-20 pb-16 px-4">
            {state.currentQuestion && (
              <>
                <QuestionCard
                  question={state.currentQuestion}
                  onSubmit={submitAnswer}
                  disabled={true}
                />
                <FeedbackOverlay
                  isCorrect={state.isCorrect ?? false}
                  explanation={state.currentQuestion.explanation}
                  correctAnswer={getCorrectAnswer()}
                  onNext={nextQuestion}
                />
              </>
            )}
          </div>
          <PetReactionCorner reaction={getPetReaction()} />
        </div>
      )

    case 'summary':
      const rewards = calculateRewards()
      return (
        <LessonSummary
          totalCorrect={state.totalCorrect}
          totalQuestions={state.totalQuestions}
          xpEarned={rewards.xpEarned}
          coinsEarned={rewards.coinsEarned}
          onNextLesson={handleNextLesson}
          onBackToPet={onBack}
          hasNextLesson={getHasNextLesson()}
        />
      )

    default:
      return (
        <div className="flex items-center justify-center h-screen bg-pet-bg">
          <p className="font-pixel text-[8px] text-pet-text-dim">Unknown lesson state</p>
        </div>
      )
  }
}
