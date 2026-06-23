export type UserProgress = {
  streak: number
  lastActiveDate: string | null
  completedLessons: string[]
  currentLesson: {
    lessonId: string
    stepIndex: number
  } | null
}

export type LessonProgress = {
  currentStepIndex: number
  completed: boolean
  distinctConicsSeen?: string[]
  masteryIndex?: number
}

export const defaultUserProgress = (): UserProgress => ({
  streak: 0,
  lastActiveDate: null,
  completedLessons: [],
  currentLesson: null,
})
