import type { Course, CourseLesson, CourseSection, Lesson } from '../types/lesson'
import { getPracticeSkill } from './reviewSkills'

/**
 * A section "has a unit test" when it contains at least one lesson with a conic
 * practice skill (i.e. parabolas, circles, ellipses, hyperbolas).
 */
export function sectionHasUnitTest(section: CourseSection): boolean {
  if (section.comingSoon) return false
  return section.lessons.some((l) => !!getPracticeSkill(l.id))
}

/** True when every non-comingSoon lesson in the section is in completedLessons. */
export function allSectionLessonsComplete(
  section: CourseSection,
  completedLessons: string[],
): boolean {
  return section.lessons
    .filter((l) => !l.comingSoon)
    .every((l) => completedLessons.includes(l.id))
}

/**
 * Returns the section id whose unit test must be passed before this lesson unlocks,
 * or null if no such requirement exists. This applies to the first lesson of any
 * section that follows a section with a unit test.
 */
function requiredPriorSectionTest(lesson: CourseLesson, course: Course): string | null {
  // Only first lessons of a section (those without unlockAfter pointing to a lesson
  // in the SAME section) can be gated by a prior section's unit test.
  if (lesson.unlockAfter) return null  // gated by a prior lesson in the same section
  for (let i = 1; i < course.sections.length; i++) {
    const section = course.sections[i]
    if (section.lessons[0]?.id === lesson.id) {
      const priorSection = course.sections[i - 1]
      return sectionHasUnitTest(priorSection) ? priorSection.id : null
    }
  }
  return null
}

export function isLessonUnlocked(
  lesson: CourseLesson,
  completedLessons: string[],
  passedUnitTests: string[] = [],
  course?: Course,
): boolean {
  if (lesson.comingSoon) return false
  if (lesson.unlockAfter) {
    return completedLessons.includes(lesson.unlockAfter)
  }
  // First lesson in a section — check if the prior section's unit test is required.
  if (course) {
    const requiredSection = requiredPriorSectionTest(lesson, course)
    if (requiredSection && !passedUnitTests.includes(requiredSection)) return false
  }
  return true
}

/** All lessons across every section, in order. */
export function getCourseLessons(course: Course): CourseLesson[] {
  return course.sections.flatMap((section) => section.lessons)
}

export function getNextLessonId(
  course: Course,
  completedLessons: string[],
  passedUnitTests: string[] = [],
): string | null {
  for (const section of course.sections) {
    if (section.comingSoon) continue
    for (const lesson of section.lessons) {
      if (!isLessonUnlocked(lesson, completedLessons, passedUnitTests, course)) continue
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

export function lessonUsesUnitCircleSimulator(lesson: Lesson): boolean {
  return lesson.simulator === 'unit-circle'
}

export function lessonUsesTrigGraphSimulator(lesson: Lesson): boolean {
  return lesson.simulator === 'trig-graph'
}

export function lessonUsesConeSimulator(lesson: Lesson): boolean {
  return !lesson.simulator || lesson.simulator === 'cone'
}
