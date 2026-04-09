import type { Lesson, Level, LevelId } from '../../types/lesson'
import { a0Ch1 } from './a0-ch1'
import { a1Ch2 } from './a1-ch2'
import { a1PlusCh3 } from './a1plus-ch3'
import { a2Ch4 } from './a2-ch4'
import { a2Ch5 } from './a2-ch5'
import { b1Ch6 } from './b1-ch6'

export const ALL_LEVELS: Level[] = [
  {
    id: 'A0',
    name: 'Complete Beginner',
    chapters: [a0Ch1]
  },
  {
    id: 'A1',
    name: 'Beginner',
    chapters: [a1Ch2]
  },
  {
    id: 'A1+',
    name: 'Elementary',
    chapters: [a1PlusCh3]
  },
  {
    id: 'A2',
    name: 'Pre-Intermediate',
    chapters: [a2Ch4, a2Ch5]
  },
  {
    id: 'B1',
    name: 'Intermediate',
    chapters: [b1Ch6]
  }
]

export function getAllLessons(): Lesson[] {
  return ALL_LEVELS.flatMap(level => level.chapters.flatMap(ch => ch.lessons))
}

export function getLessonById(id: string): Lesson | undefined {
  return getAllLessons().find(l => l.id === id)
}

export function getNextLesson(currentLessonId: string): Lesson | undefined {
  const all = getAllLessons()
  const idx = all.findIndex(l => l.id === currentLessonId)
  return idx >= 0 && idx < all.length - 1 ? all[idx + 1] : undefined
}

export function getLessonsForLevel(levelId: LevelId): Lesson[] {
  const level = ALL_LEVELS.find(l => l.id === levelId)
  return level ? level.chapters.flatMap(ch => ch.lessons) : []
}
