export type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola' | 'none'

export type Feedback = {
  correct: string
  incorrect: string
  hint: string
}

export type ExploreStep = {
  type: 'explore'
  title?: string
  prompt: string
  introText?: string
  showLabels?: boolean
  interactive?: boolean
  successCondition: 'continue' | { minDistinctConics: number }
  hints?: string[]
}

export type ChallengeStep = {
  type: 'challenge'
  prompt: string
  targetConic: ConicType
  feedback: Feedback
  miniReflection?: string
  visualReward?: 'glow'
  visualCue?: 'highlightConeEdge'
}

export type ReflectionStep = {
  type: 'reflection'
  prompt: string
  choices: { id: string; label: string }[]
  correctChoiceId: string
  feedback: string
}

export type MasteryCheckStep = {
  type: 'mastery'
  sequence: ConicType[]
  hideLabels: boolean
  completionMessage: string
}

export type Step = ExploreStep | ChallengeStep | ReflectionStep | MasteryCheckStep

export type Lesson = {
  id: string
  title: string
  order: number
  subject: 'conics'
  steps: Step[]
}

export type CourseLesson = {
  id: string
  title: string
  order: number
  locked: boolean
}

export type Course = {
  id: string
  title: string
  subject: string
  lessons: CourseLesson[]
}
