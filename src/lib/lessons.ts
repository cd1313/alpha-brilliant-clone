import type { Lesson } from '../types/lesson'
import introductionLesson from '../content/lessons/introduction.json'

const lessons: Record<string, Lesson> = {
  introduction: introductionLesson as Lesson,
}

export function getLesson(lessonId: string): Lesson | undefined {
  return lessons[lessonId]
}
