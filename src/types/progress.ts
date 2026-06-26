export type UserProgress = {
  streak: number
  lastActiveDate: string | null
  completedLessons: string[]
  currentLesson: {
    lessonId: string
    stepIndex: number
  } | null
  /** Local date (YYYY-MM-DD) of the last completed Smart Review/Practice session, or null. */
  lastReviewDate: string | null
}

export type LessonProgress = {
  currentStepIndex: number
  completed: boolean
  distinctConicsSeen?: string[]
  distinctPValues?: number[]
  distinctRValues?: number[]
  movedFocus?: boolean
  movedDirectrix?: boolean
  movedCenter?: boolean
  movedRadius?: boolean
  masteryIndex?: number
}

/** Per-skill struggle stats used to tailor Smart Review. */
export type SkillStat = {
  attempts: number
  misses: number
  lastResult: 'correct' | 'incorrect'
  /** Coarse sub-areas the learner missed most (e.g. 'center', 'radius', 'foci'). */
  weakComponents?: string[]
  /** Exponential moving average of recent miss rate (0-1); weights recent attempts more. */
  recentMissRate?: number
}

export const defaultUserProgress = (): UserProgress => ({
  streak: 0,
  lastActiveDate: null,
  completedLessons: [],
  currentLesson: null,
  lastReviewDate: null,
})
