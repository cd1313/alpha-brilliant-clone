import type { Course, CourseLesson, Lesson } from '../types/lesson'

export function isLessonUnlocked(
  lesson: CourseLesson,
  completedLessons: string[],
): boolean {
  if (lesson.comingSoon) return false
  if (!lesson.unlockAfter) return true
  return completedLessons.includes(lesson.unlockAfter)
}

/** All lessons across every section, in order. */
export function getCourseLessons(course: Course): CourseLesson[] {
  return course.sections.flatMap((section) => section.lessons)
}

export function getNextLessonId(course: Course, completedLessons: string[]): string | null {
  for (const section of course.sections) {
    if (section.comingSoon) continue
    for (const lesson of section.lessons) {
      if (!isLessonUnlocked(lesson, completedLessons)) continue
      if (!completedLessons.includes(lesson.id)) return lesson.id
    }
  }
  return null
}

export function lessonUsesParabolaSimulator(lesson: Lesson): boolean {
  return lesson.simulator === 'parabola'
}

export function lessonUsesCircleSimulator(lesson: Lesson): boolean {
  return lesson.simulator === 'circle'
}

export function lessonUsesEllipseSimulator(lesson: Lesson): boolean {
  return lesson.simulator === 'ellipse'
}

export function lessonUsesHyperbolaSimulator(lesson: Lesson): boolean {
  return lesson.simulator === 'hyperbola'
}

export function lessonUsesConeSimulator(lesson: Lesson): boolean {
  return !lesson.simulator || lesson.simulator === 'cone'
}
