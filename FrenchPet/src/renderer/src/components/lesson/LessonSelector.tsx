import { useState } from 'react'
import type { Lesson } from '../../types/lesson'
import { ALL_LEVELS } from '../../data/lessons'
import PixelButton from '../PixelButton'

interface LessonSelectorProps {
  onSelectLesson: (lesson: Lesson) => void
  completedLessonIds: string[]
  onBack: () => void
}

export default function LessonSelector({
  onSelectLesson,
  completedLessonIds,
  onBack
}: LessonSelectorProps) {
  const [expandedLevelId, setExpandedLevelId] = useState<string | null>(ALL_LEVELS[0]?.id || null)
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null)

  // Get all lessons in order to find the next uncompleted one
  const allLessons = ALL_LEVELS.flatMap(level =>
    level.chapters.flatMap(chapter => chapter.lessons)
  )

  const nextUncompletedLesson = allLessons.find(
    lesson => !completedLessonIds.includes(lesson.id)
  )

  const isLessonLocked = (lesson: Lesson, chapter: any): boolean => {
    // First lesson of each chapter is always unlocked
    const firstLessonInChapter = chapter.lessons[0]
    if (lesson.id === firstLessonInChapter.id) return false

    // Already completed lessons are unlocked
    if (completedLessonIds.includes(lesson.id)) return false

    // Next uncompleted lesson is unlocked
    if (nextUncompletedLesson?.id === lesson.id) return false

    // Find all lessons in this chapter before this one
    const lessonIndex = chapter.lessons.findIndex((l: Lesson) => l.id === lesson.id)
    const previousLessons = chapter.lessons.slice(0, lessonIndex)

    // Check if all previous lessons in chapter are completed
    const allPreviousCompleted = previousLessons.every((l: Lesson) =>
      completedLessonIds.includes(l.id)
    )

    // Locked if not all previous lessons are completed
    return !allPreviousCompleted
  }

  const toggleLevel = (levelId: string) => {
    setExpandedLevelId(expandedLevelId === levelId ? null : levelId)
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapterId(expandedChapterId === chapterId ? null : chapterId)
  }

  return (
    <div className="min-h-screen bg-pet-bg p-4">
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <PixelButton variant="secondary" size="sm" onClick={onBack}>
            ← Back
          </PixelButton>
          <h2 className="font-pixel text-[10px] text-pet-accent">
            Select Lesson
          </h2>
        </div>

        <div className="space-y-2">
          {ALL_LEVELS.map((level) => (
            <div key={level.id} className="bg-pet-panel border-3 border-pet-text">
              <button
                onClick={() => toggleLevel(level.id)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-pet-bg-light transition-colors"
              >
                <div className="text-left">
                  <div className="font-pixel text-[8px] text-pet-accent">
                    {level.id} - {level.name}
                  </div>
                </div>
                <span className="font-pixel text-[8px] text-pet-text-dim">
                  {expandedLevelId === level.id ? '▼' : '▶'}
                </span>
              </button>

              {expandedLevelId === level.id && (
                <div className="border-t-2 border-pet-text-dim">
                  {level.chapters.map((chapter) => (
                    <div key={chapter.id}>
                      <button
                        onClick={() => toggleChapter(chapter.id)}
                        className="w-full px-4 py-2 flex items-center justify-between hover:bg-pet-bg transition-colors border-b border-pet-text-dim/50"
                      >
                        <div className="text-left">
                          <div className="font-pixel text-[7px] text-pet-text">
                            {chapter.title}
                          </div>
                          <div className="font-pixel text-[6px] text-pet-text-dim">
                            {chapter.description}
                          </div>
                        </div>
                        <span className="font-pixel text-[7px] text-pet-text-dim">
                          {expandedChapterId === chapter.id ? '▼' : '▶'}
                        </span>
                      </button>

                      {expandedChapterId === chapter.id && (
                        <div className="bg-pet-bg-light">
                          {chapter.lessons.map((lesson) => {
                            const isCompleted = completedLessonIds.includes(lesson.id)
                            const isNext = nextUncompletedLesson?.id === lesson.id
                            const isLocked = isLessonLocked(lesson, chapter)

                            return (
                              <button
                                key={lesson.id}
                                onClick={() => !isLocked && onSelectLesson(lesson)}
                                disabled={isLocked}
                                className={`
                                  w-full px-6 py-2 text-left
                                  border-b border-pet-text-dim/30
                                  transition-colors
                                  ${isLocked
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-pet-panel cursor-pointer'
                                  }
                                  ${isNext ? 'bg-pet-accent/10 border-l-3 border-l-pet-accent' : ''}
                                `}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-pixel text-[7px] text-pet-text">
                                      {lesson.lessonNumber}. {lesson.title}
                                    </div>
                                    <div className="font-pixel text-[6px] text-pet-text-dim mt-1">
                                      {lesson.description}
                                    </div>
                                  </div>
                                  <div className="ml-2 font-pixel text-[8px]">
                                    {isCompleted && '✓'}
                                    {isLocked && '🔒'}
                                    {isNext && !isCompleted && '➜'}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
