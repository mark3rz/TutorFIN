import { useState, useCallback } from 'react'
import type { Question, Lesson } from '../types/lesson'
import {
  LESSON_BASE_XP,
  LESSON_XP_PER_CORRECT,
  LESSON_PERFECT_XP_BONUS,
  LESSON_BASE_COINS,
  LESSON_COIN_PER_CORRECT,
  LESSON_COMPLETION_COIN_BONUS
} from '../lib/constants'

type LessonPhase =
  | 'selecting'
  | 'warmup_intro'
  | 'warmup_question'
  | 'warmup_feedback'
  | 'input_intro'
  | 'comprehensible_input'
  | 'drill_intro'
  | 'drill_question'
  | 'drill_feedback'
  | 'summary'

interface AnswerRecord {
  questionId: string
  correct: boolean
  userAnswer: string
  correctAnswer: string
}

interface LessonEngineState {
  phase: LessonPhase
  currentLesson: Lesson | null
  currentQuestionIndex: number
  currentQuestion: Question | null
  isWarmupPhase: boolean
  userAnswer: string | number | null
  isCorrect: boolean | null
  answers: AnswerRecord[]
  totalCorrect: number
  totalAnswered: number
  totalQuestions: number
}

export interface LessonEngine {
  state: LessonEngineState
  selectLesson: (lesson: Lesson) => void
  submitAnswer: (answer: string | number) => void
  nextQuestion: () => void
  acknowledgeInput: () => void
  startDrills: () => void
  startWarmup: () => void
  backToSelector: () => void
  calculateRewards: () => { xpEarned: number; coinsEarned: number }
}

const ACCENT_MAP: Record<string, string> = {
  'é': 'e',
  'è': 'e',
  'ê': 'e',
  'ë': 'e',
  'à': 'a',
  'â': 'a',
  'ù': 'u',
  'û': 'u',
  'ç': 'c',
  'ô': 'o',
  'î': 'i',
  'ï': 'i'
}

function normalizeAnswer(answer: string): string {
  let normalized = answer.toLowerCase().trim()
  for (const [accented, plain] of Object.entries(ACCENT_MAP)) {
    normalized = normalized.replace(new RegExp(accented, 'g'), plain)
  }
  return normalized
}

function validateAnswer(question: Question, answer: string | number): boolean {
  switch (question.type) {
    case 'multiple_choice':
    case 'error_correction':
      return answer === question.correctIndex

    case 'fill_blank':
    case 'translation': {
      const normalizedAnswer = normalizeAnswer(String(answer))
      const normalizedCorrect = normalizeAnswer(question.correctAnswer)

      if (normalizedAnswer === normalizedCorrect) {
        return true
      }

      if (question.acceptableAnswers) {
        return question.acceptableAnswers.some(
          (acceptable) => normalizeAnswer(acceptable) === normalizedAnswer
        )
      }

      return false
    }

    default:
      return false
  }
}

const initialState: LessonEngineState = {
  phase: 'selecting',
  currentLesson: null,
  currentQuestionIndex: 0,
  currentQuestion: null,
  isWarmupPhase: false,
  userAnswer: null,
  isCorrect: null,
  answers: [],
  totalCorrect: 0,
  totalAnswered: 0,
  totalQuestions: 0
}

export default function useLessonEngine(): LessonEngine {
  const [state, setState] = useState<LessonEngineState>(initialState)

  const selectLesson = useCallback((lesson: Lesson) => {
    const hasWarmup = lesson.warmup && lesson.warmup.length > 0
    const totalQuestions = (lesson.warmup?.length || 0) + lesson.drillQuestions.length

    setState({
      ...initialState,
      phase: hasWarmup ? 'warmup_intro' : 'input_intro',
      currentLesson: lesson,
      totalQuestions
    })
  }, [])

  const startWarmup = useCallback(() => {
    setState((prev) => {
      if (!prev.currentLesson || !prev.currentLesson.warmup || prev.currentLesson.warmup.length === 0) {
        return prev
      }

      return {
        ...prev,
        phase: 'warmup_question',
        isWarmupPhase: true,
        currentQuestionIndex: 0,
        currentQuestion: prev.currentLesson.warmup[0].question,
        userAnswer: null,
        isCorrect: null
      }
    })
  }, [])

  const submitAnswer = useCallback((answer: string | number) => {
    setState((prev) => {
      if (!prev.currentQuestion) return prev

      const isCorrect = validateAnswer(prev.currentQuestion, answer)
      const q = prev.currentQuestion
      const correctAnswer =
        q.type === 'fill_blank' || q.type === 'translation'
          ? q.correctAnswer
          : q.type === 'multiple_choice' || q.type === 'error_correction'
            ? q.options[q.correctIndex]
            : String(answer)
      const answerRecord: AnswerRecord = {
        questionId: q.id,
        correct: isCorrect,
        userAnswer: String(answer),
        correctAnswer
      }

      return {
        ...prev,
        phase: prev.isWarmupPhase ? 'warmup_feedback' : 'drill_feedback',
        userAnswer: answer,
        isCorrect,
        answers: [...prev.answers, answerRecord],
        totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
        totalAnswered: prev.totalAnswered + 1
      }
    })
  }, [])

  const nextQuestion = useCallback(() => {
    setState((prev) => {
      if (!prev.currentLesson) return prev

      // From warmup_feedback
      if (prev.phase === 'warmup_feedback') {
        const warmup = prev.currentLesson.warmup || []
        const nextIndex = prev.currentQuestionIndex + 1

        if (nextIndex < warmup.length) {
          // More warmup questions
          return {
            ...prev,
            phase: 'warmup_question',
            currentQuestionIndex: nextIndex,
            currentQuestion: warmup[nextIndex].question,
            userAnswer: null,
            isCorrect: null
          }
        } else {
          // Warmup complete, go to input
          return {
            ...prev,
            phase: 'input_intro',
            currentQuestionIndex: 0,
            currentQuestion: null,
            isWarmupPhase: false,
            userAnswer: null,
            isCorrect: null
          }
        }
      }

      // From drill_feedback
      if (prev.phase === 'drill_feedback') {
        const nextIndex = prev.currentQuestionIndex + 1

        if (nextIndex < prev.currentLesson.drillQuestions.length) {
          // More drill questions
          return {
            ...prev,
            phase: 'drill_question',
            currentQuestionIndex: nextIndex,
            currentQuestion: prev.currentLesson.drillQuestions[nextIndex],
            userAnswer: null,
            isCorrect: null
          }
        } else {
          // Drills complete, go to summary
          return {
            ...prev,
            phase: 'summary',
            currentQuestion: null,
            userAnswer: null,
            isCorrect: null
          }
        }
      }

      // From input_intro
      if (prev.phase === 'input_intro') {
        return {
          ...prev,
          phase: 'comprehensible_input'
        }
      }

      return prev
    })
  }, [])

  const acknowledgeInput = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: 'drill_intro'
    }))
  }, [])

  const startDrills = useCallback(() => {
    setState((prev) => {
      if (!prev.currentLesson || prev.currentLesson.drillQuestions.length === 0) {
        return prev
      }

      return {
        ...prev,
        phase: 'drill_question',
        isWarmupPhase: false,
        currentQuestionIndex: 0,
        currentQuestion: prev.currentLesson.drillQuestions[0],
        userAnswer: null,
        isCorrect: null
      }
    })
  }, [])

  const backToSelector = useCallback(() => {
    setState(initialState)
  }, [])

  const calculateRewards = useCallback(() => {
    const accuracy = state.totalAnswered > 0 ? state.totalCorrect / state.totalAnswered : 0
    const xpEarned =
      LESSON_BASE_XP +
      state.totalCorrect * LESSON_XP_PER_CORRECT +
      (accuracy === 1 ? LESSON_PERFECT_XP_BONUS : 0)
    const coinsEarned =
      LESSON_BASE_COINS +
      state.totalCorrect * LESSON_COIN_PER_CORRECT +
      LESSON_COMPLETION_COIN_BONUS

    return { xpEarned, coinsEarned }
  }, [state.totalCorrect, state.totalAnswered])

  return {
    state,
    selectLesson,
    submitAnswer,
    nextQuestion,
    acknowledgeInput,
    startDrills,
    startWarmup,
    backToSelector,
    calculateRewards
  }
}
