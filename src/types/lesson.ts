export type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola' | 'none'

export type LessonSimulator = 'cone' | 'parabola' | 'circle' | 'ellipse' | 'hyperbola'

export type HyperbolaOrientation = 'horizontal' | 'vertical'

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
  vertexAtOrigin?: boolean
  pInputMode?: boolean
  /** A fixed point the curve should pass through, drawn as a marker. */
  targetPoint?: { x: number; y: number }
}

/** @deprecated Use ParabolaSimulatorConfig */
export type ParabolaExploreConfig = ParabolaSimulatorConfig

export type CircleSimulatorConfig = {
  showRadiusDemo?: boolean
  highlightCenter?: boolean
  showRadius?: boolean
  showEquation?: boolean
  centerDraggable?: boolean
  hkrInputMode?: boolean
  /** A fixed point the circle should pass through, drawn as a marker. */
  targetPoint?: { x: number; y: number }
}

export type EllipseSimulatorConfig = {
  /** Make the two foci draggable (the "string and pins" model) and show the constant sum. */
  fociDraggable?: boolean
  highlightCenter?: boolean
  showAxes?: boolean
  showEquation?: boolean
  /** Draw line indicators from the center to the a and b handles. */
  showSemiAxes?: boolean
  /** Mark the foci and the distance c from the center, with the c = √(a² − b²) readout. */
  showFociDistance?: boolean
  centerDraggable?: boolean
  /** A fixed point the ellipse should pass through, drawn as a marker. */
  targetPoint?: { x: number; y: number }
}

export type HyperbolaSimulatorConfig = {
  showDifferenceDemo?: boolean
  highlightVertices?: boolean
  showAsymptotes?: boolean
  showBox?: boolean
  showAxes?: boolean
  showEquation?: boolean
  centerDraggable?: boolean
  allowOrientationToggle?: boolean
  /** Hide the focus markers (e.g. when the foci are what the student must figure out). */
  showFoci?: boolean
  /** Draw line indicators from the center to the a (vertex) and b handles. */
  showSemiAxes?: boolean
}

export type ExploreSuccessCondition =
  | 'continue'
  | { minDistinctConics: number }
  | { movedFocusAndDirectrix: true }
  | { minDistinctP: number }
  | { movedCenterAndRadius: true }
  | { minDistinctR: number }
  | { minDistinctCircles: number }
  | { movedAxes: true }
  | { minDistinctEllipses: number }
  | { minDistinctHyperbolas: number }

export type ExploreStep = StepMeta & {
  type: 'explore'
  prompt: string
  introText?: string
  showLabels?: boolean
  interactive?: boolean
  /** Show a labeled gallery of the four conic sections above the simulator. */
  showConicGallery?: boolean
  successCondition: ExploreSuccessCondition
  hints?: string[]
  parabolaConfig?: ParabolaExploreConfig
  circleConfig?: CircleSimulatorConfig
  ellipseConfig?: EllipseSimulatorConfig
  hyperbolaConfig?: HyperbolaSimulatorConfig
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

export type CircleChallengeTarget =
  | { kind: 'center'; x: number; y: number; tolerance?: number }
  | {
      kind: 'radius'
      centerX: number
      centerY: number
      radius: number
      tolerance?: number
    }
  | {
      kind: 'small'
      centerX: number
      centerY: number
      maxR?: number
      tolerance?: number
    }

export type EllipseChallengeTarget = {
  kind: 'axes'
  centerX: number
  centerY: number
  a: number
  b: number
  tolerance?: number
}

export type HyperbolaChallengeTarget = {
  kind: 'axes'
  centerX: number
  centerY: number
  a: number
  b: number
  orientation: HyperbolaOrientation
  tolerance?: number
}

export type ChallengeStep = StepMeta & {
  type: 'challenge'
  prompt: string
  targetConic?: ConicType
  parabolaTarget?: ParabolaChallengeTarget
  circleTarget?: CircleChallengeTarget
  ellipseTarget?: EllipseChallengeTarget
  hyperbolaTarget?: HyperbolaChallengeTarget
  /** Hide the coordinate "Target:" badge so it doesn't reveal the answer. */
  hideTarget?: boolean
  feedback: Feedback
  miniReflection?: string
  visualReward?: 'glow'
  visualCue?: 'highlightConeEdge'
  /** A target plane orientation to show as a dashed guide when the hint is open. */
  planeGuide?: { angle: number; offset: number }
  parabolaConfig?: ParabolaSimulatorConfig
  circleConfig?: CircleSimulatorConfig
  ellipseConfig?: EllipseSimulatorConfig
  hyperbolaConfig?: HyperbolaSimulatorConfig
}

export type ReflectionStep = StepMeta & {
  type: 'reflection'
  prompt: string
  choices: { id: string; label: string }[]
  correctChoiceId: string
  feedback: string
  /** Shown when the answer is wrong; falls back to a generic message. */
  incorrectFeedback?: string
  /** Optional non-interactive hyperbola shown as a reference grid to reason on. */
  referenceHyperbola?: {
    centerX: number
    centerY: number
    a: number
    b: number
    orientation: HyperbolaOrientation
  }
  hyperbolaConfig?: HyperbolaSimulatorConfig
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

export type CircleMasteryTarget = {
  id: string
  label: string
  large?: boolean
  small?: boolean
  center?: { x: number; y: number }
}

export type EllipseMasteryTarget = {
  id: string
  label: string
  center?: { x: number; y: number }
  a?: number
  b?: number
}

export type HyperbolaMasteryTarget = {
  id: string
  label: string
  center?: { x: number; y: number }
  a?: number
  b?: number
  orientation?: HyperbolaOrientation
}

export type MasteryCheckStep = StepMeta & {
  type: 'mastery'
  sequence?: ConicType[]
  parabolaSequence?: ParabolaMasteryTarget[]
  circleSequence?: CircleMasteryTarget[]
  ellipseSequence?: EllipseMasteryTarget[]
  hyperbolaSequence?: HyperbolaMasteryTarget[]
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

export type CourseSection = {
  id: string
  title: string
  comingSoon?: boolean
  lessons: CourseLesson[]
}

export type Course = {
  id: string
  title: string
  subject: string
  sections: CourseSection[]
}
