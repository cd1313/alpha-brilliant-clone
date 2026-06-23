import type {
  Course,
  CourseLesson,
  Lesson,
  ParabolaChallengeTarget,
  ParabolaMasteryTarget,
  Step,
} from '../types/lesson'

export function isLessonUnlocked(
  lesson: CourseLesson,
  completedLessons: string[],
): boolean {
  if (lesson.comingSoon) return false
  if (!lesson.unlockAfter) return true
  return completedLessons.includes(lesson.unlockAfter)
}

export function getNextLessonId(course: Course, completedLessons: string[]): string | null {
  for (const lesson of course.lessons) {
    if (!isLessonUnlocked(lesson, completedLessons)) continue
    if (!completedLessons.includes(lesson.id)) return lesson.id
  }
  return null
}

export function lessonUsesParabolaSimulator(lesson: Lesson): boolean {
  return lesson.simulator === 'parabola'
}

export function isParabolaChallenge(step: Step): step is Step & {
  type: 'challenge'
  parabolaTarget: ParabolaChallengeTarget
} {
  return step.type === 'challenge' && Boolean(step.parabolaTarget)
}

export function isParabolaMastery(step: Step): step is Step & {
  type: 'mastery'
  parabolaSequence: ParabolaMasteryTarget[]
} {
  return step.type === 'mastery' && Boolean(step.parabolaSequence?.length)
}
