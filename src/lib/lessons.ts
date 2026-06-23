import type { Lesson } from '../types/lesson'
import introductionLesson from '../content/lessons/introduction.json'
import parabolasLesson from '../content/lessons/parabolas.json'

const lessons: Record<string, Lesson> = {
  introduction: introductionLesson as Lesson,
  parabolas: parabolasLesson as Lesson,
}

export function getLesson(lessonId: string): Lesson | undefined {
  return lessons[lessonId]
}

export function getAllLessons(): Lesson[] {
  return Object.values(lessons)
}
