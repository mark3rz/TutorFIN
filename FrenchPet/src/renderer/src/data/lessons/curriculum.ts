import type { LevelId } from '../../types/lesson'

export interface CurriculumLevel {
  id: LevelId
  name: string
  description: string
  chapters: CurriculumChapter[]
}

export interface CurriculumChapter {
  id: string
  title: string
  lessonCount: number
}

export const CURRICULUM: CurriculumLevel[] = [
  {
    id: 'A0',
    name: 'Complete Beginner',
    description: 'Alphabet, greetings, and numbers',
    chapters: [{ id: 'ch1', title: 'Alphabet, Salutations, Chiffres', lessonCount: 6 }]
  },
  {
    id: 'A1',
    name: 'Beginner',
    description: 'Articles, adjectives, and present tense',
    chapters: [{ id: 'ch2', title: 'Articles, Adjectifs, Verbes Présent', lessonCount: 7 }]
  },
  {
    id: 'A1+',
    name: 'Elementary',
    description: 'Past tense, near future, and expressions',
    chapters: [{ id: 'ch3', title: 'Passé Composé, Futur Proche, Expressions', lessonCount: 7 }]
  },
  {
    id: 'A2',
    name: 'Pre-Intermediate',
    description: 'Narration, future tense, and travel',
    chapters: [
      { id: 'ch4', title: 'Narration & Futur Simple', lessonCount: 6 },
      { id: 'ch5', title: 'Voyages', lessonCount: 6 }
    ]
  },
  {
    id: 'B1',
    name: 'Intermediate',
    description: 'Opinions, conditional, and hypotheses',
    chapters: [{ id: 'ch6', title: 'Opinions, Conditionnel, Hypothèse', lessonCount: 6 }]
  }
]
