import type { Lesson } from '../types/lesson'
import introductionLesson from '../content/lessons/introduction.json'
import parabolasLesson from '../content/lessons/parabolas.json'
import circlesLesson from '../content/lessons/circles.json'
import ellipsesLesson from '../content/lessons/ellipses.json'
import hyperbolasLesson from '../content/lessons/hyperbolas.json'
import trigAnglesLesson from '../content/lessons/trig-angles.json'
import trigUnitCircleLesson from '../content/lessons/trig-unit-circle.json'
import trigSineCosineLesson from '../content/lessons/trig-sine-cosine.json'
import trigTangentLesson from '../content/lessons/trig-tangent.json'

const lessons: Record<string, Lesson> = {
  introduction: introductionLesson as Lesson,
  parabolas: parabolasLesson as Lesson,
  circles: circlesLesson as Lesson,
  ellipses: ellipsesLesson as Lesson,
  hyperbolas: hyperbolasLesson as Lesson,
  'trig-angles': trigAnglesLesson as Lesson,
  'trig-unit-circle': trigUnitCircleLesson as Lesson,
  'trig-sine-cosine': trigSineCosineLesson as Lesson,
  'trig-tangent': trigTangentLesson as Lesson,
}

export function getLesson(lessonId: string): Lesson | undefined {
  return lessons[lessonId]
}
