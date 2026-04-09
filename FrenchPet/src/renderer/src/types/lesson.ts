export type QuestionType = 'multiple_choice' | 'fill_blank' | 'translation' | 'error_correction'

export interface MultipleChoiceQuestion {
  id: string
  type: 'multiple_choice'
  prompt: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
}

export interface FillBlankQuestion {
  id: string
  type: 'fill_blank'
  sentence: string
  correctAnswer: string
  acceptableAnswers?: string[]
  explanation: string
}

export interface TranslationQuestion {
  id: string
  type: 'translation'
  direction: 'fr_to_en' | 'en_to_fr'
  sourceText: string
  correctAnswer: string
  acceptableAnswers?: string[]
  explanation: string
}

export interface ErrorCorrectionQuestion {
  id: string
  type: 'error_correction'
  incorrectSentence: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
}

export type Question = MultipleChoiceQuestion | FillBlankQuestion | TranslationQuestion | ErrorCorrectionQuestion

export interface WarmupItem {
  id: string
  question: Question
}

export interface ComprehensibleInput {
  title: string
  frenchText: string
  englishHint: string
  vocabularyHighlights: Array<{ french: string; english: string }>
}

export interface Lesson {
  id: string
  levelId: LevelId
  chapterId: string
  lessonNumber: number
  title: string
  description: string
  warmup: WarmupItem[]
  comprehensibleInput: ComprehensibleInput
  drillQuestions: Question[]
}

export type LevelId = 'A0' | 'A1' | 'A1+' | 'A2' | 'B1'

export interface Chapter {
  id: string
  levelId: LevelId
  title: string
  description: string
  lessons: Lesson[]
}

export interface Level {
  id: LevelId
  name: string
  chapters: Chapter[]
}

export interface LessonResult {
  lessonId: string
  questionsAnswered: number
  correctCount: number
  wrongAnswers: Array<{ questionId: string; userAnswer: string; correctAnswer: string }>
  xpEarned: number
  coinsEarned: number
}

export interface LessonProgress {
  lesson_id: string
  completed: number
  best_score: number
  attempts: number
  last_attempt_at: string | null
}
