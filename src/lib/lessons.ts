import type { Lesson } from '../types/lesson'
import introductionLesson from '../content/lessons/introduction.json'
import parabolasLesson from '../content/lessons/parabolas.json'
import circlesLesson from '../content/lessons/circles.json'
import ellipsesLesson from '../content/lessons/ellipses.json'
import hyperbolasLesson from '../content/lessons/hyperbolas.json'

const lessons: Record<string, Lesson> = {
  introduction: introductionLesson as Lesson,
  parabolas: parabolasLesson as Lesson,
  circles: circlesLesson as Lesson,
  ellipses: ellipsesLesson as Lesson,
  hyperbolas: hyperbolasLesson as Lesson,
}

export function getLesson(lessonId: string): Lesson | undefined {
  return lessons[lessonId]
}

export function getAllLessons(): Lesson[] {
  return Object.values(lessons)
}
