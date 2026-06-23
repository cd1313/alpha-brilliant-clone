export type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola' | 'none'

export type LessonSimulator = 'cone' | 'parabola'

export type Feedback = {
  correct: string
  incorrect: string
  hint: string
}

export type StepMeta = {
  title?: string
  goal?: string
  info?: string
}

export type ParabolaSimulatorConfig = {
  showDistanceDemo?: boolean
  highlightVertex?: boolean
  showParameterP?: boolean
  showEquation?: boolean
  labelToggles?: boolean
  vertexDraggable?: boolean
  focusVerticalOnly?: boolean
}

/** @deprecated Use ParabolaSimulatorConfig */
export type ParabolaExploreConfig = ParabolaSimulatorConfig

export type ExploreSuccessCondition =
  | 'continue'
  | { minDistinctConics: number }
  | { movedFocusAndDirectrix: true }
  | { minDistinctP: number }

export type ExploreStep = StepMeta & {
  type: 'explore'
  prompt: string
  introText?: string
  showLabels?: boolean
  interactive?: boolean
  successCondition: ExploreSuccessCondition
  hints?: string[]
  parabolaConfig?: ParabolaExploreConfig
}

export type ParabolaChallengeTarget =
  | { kind: 'vertex'; x: number; y: number; tolerance?: number }
  | {
      kind: 'focus'
      vertexX: number
      vertexY: number
      focusX: number
      focusY: number
      tolerance?: number
    }
  | {
      kind: 'narrow'
      vertexX: number
      vertexY: number
      maxP?: number
      tolerance?: number
    }

export type ChallengeStep = StepMeta & {
  type: 'challenge'
  prompt: string
  targetConic?: ConicType
  parabolaTarget?: ParabolaChallengeTarget
  feedback: Feedback
  miniReflection?: string
  visualReward?: 'glow'
  visualCue?: 'highlightConeEdge'
  parabolaConfig?: ParabolaSimulatorConfig
}

export type ReflectionStep = StepMeta & {
  type: 'reflection'
  prompt: string
  choices: { id: string; label: string }[]
  correctChoiceId: string
  feedback: string
}

export type ParabolaMasteryTarget = {
  id: string
  label: string
  wide?: boolean
  narrow?: boolean
  vertex?: { x: number; y: number }
  /** Defaults to 'up' without a vertex; 'either' when vertex is set. */
  opens?: 'up' | 'down' | 'either'
}

export type MasteryCheckStep = StepMeta & {
  type: 'mastery'
  sequence?: ConicType[]
  parabolaSequence?: ParabolaMasteryTarget[]
  hideLabels: boolean
  completionMessage: string
}

export type Step = ExploreStep | ChallengeStep | ReflectionStep | MasteryCheckStep

export type Lesson = {
  id: string
  title: string
  order: number
  subject: 'conics'
  simulator?: LessonSimulator
  steps: Step[]
}

export type CourseLesson = {
  id: string
  title: string
  order: number
  unlockAfter?: string | null
  comingSoon?: boolean
}

export type Course = {
  id: string
  title: string
  subject: string
  lessons: CourseLesson[]
}
