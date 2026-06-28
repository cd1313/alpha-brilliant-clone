import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { classifyConic, type PlaneState } from '../../lib/conicClassifier'
import {
  lessonUsesCircleSimulator,
  lessonUsesConeSimulator,
  lessonUsesEllipseSimulator,
  lessonUsesHyperbolaSimulator,
  lessonUsesParabolaSimulator,
  lessonUsesTrigGraphSimulator,
  lessonUsesUnitCircleSimulator,
} from '../../lib/course'
import {
  clampCircleState,
  CIRCLE_MIN_R,
  DEFAULT_CIRCLE,
  roundR,
  type CircleState,
} from '../../lib/circleGeometry'
import {
  clampEllipseState,
  DEFAULT_ELLIPSE,
  type EllipseState,
} from '../../lib/ellipseGeometry'
import {
  clampHyperbolaState,
  DEFAULT_HYPERBOLA,
  type HyperbolaState,
} from '../../lib/hyperbolaGeometry'
import {
  clampParabolaState,
  DEFAULT_PARABOLA,
  deriveParabola,
  PARABOLA_MIN_P,
  roundP,
  type ParabolaState,
} from '../../lib/parabolaGeometry'
import {
  clampAngle,
  DEFAULT_UNIT_CIRCLE,
  type UnitCircleState,
} from '../../lib/unitCircleGeometry'
import {
  clampTrigGraphState,
  DEFAULT_TRIG_GRAPH,
  type TrigGraphState,
} from '../../lib/trigGraphGeometry'
import type { ConicType, Lesson, Step } from '../../types/lesson'
import type { LessonProgress } from '../../types/progress'
import type { AttemptResult, HintDetail } from '../../lib/feedback'
import { skillForStep } from '../../lib/reviewSkills'
import type { SessionAttempt } from '../../lib/ai/tutorClient'
import { ProgressBar } from './ProgressBar'
import { ConfidencePrompt } from './ConfidencePrompt'
import { StepInfoPanel } from './StepInfoPanel'
import { ChallengeStepView } from './steps/ChallengeStepView'
import { CircleChallengeStepView } from './steps/CircleChallengeStepView'
import { CircleExploreStepView } from './steps/CircleExploreStepView'
import { CircleMasteryCheckStepView } from './steps/CircleMasteryCheckStepView'
import { EllipseChallengeStepView } from './steps/EllipseChallengeStepView'
import { EllipseExploreStepView } from './steps/EllipseExploreStepView'
import { EllipseMasteryCheckStepView } from './steps/EllipseMasteryCheckStepView'
import { HyperbolaChallengeStepView } from './steps/HyperbolaChallengeStepView'
import { HyperbolaExploreStepView } from './steps/HyperbolaExploreStepView'
import { HyperbolaMasteryCheckStepView } from './steps/HyperbolaMasteryCheckStepView'
import { ExploreStepView } from './steps/ExploreStepView'
import { MasteryCheckStepView } from './steps/MasteryCheckStepView'
import { ParabolaChallengeStepView } from './steps/ParabolaChallengeStepView'
import { ParabolaExploreStepView } from './steps/ParabolaExploreStepView'
import { ParabolaMasteryCheckStepView } from './steps/ParabolaMasteryCheckStepView'
import { UnitCircleChallengeStepView } from './steps/UnitCircleChallengeStepView'
import { UnitCircleExploreStepView } from './steps/UnitCircleExploreStepView'
import { UnitCircleMasteryCheckStepView } from './steps/UnitCircleMasteryCheckStepView'
import { TrigGraphChallengeStepView } from './steps/TrigGraphChallengeStepView'
import { TrigGraphExploreStepView } from './steps/TrigGraphExploreStepView'
import { TrigGraphMasteryCheckStepView } from './steps/TrigGraphMasteryCheckStepView'
import { ReflectionStepView } from './steps/ReflectionStepView'
import { requestHint } from '../../lib/ai/hintClient'

type LessonEngineProps = {
  lesson: Lesson
  initialProgress: LessonProgress | null
  onSaveProgress: (progress: LessonProgress) => void
  onCompleteLesson: () => void
  /** Optional struggle-tracking sink; no-op when omitted so the engine works standalone. */
  onRecordAttempt?: (skillId: string, result: AttemptResult) => void
}

const DEFAULT_PLANE: PlaneState = { angle: 0, offset: -55 }

function masterySequenceLength(step: Step | undefined): number {
  if (!step || step.type !== 'mastery') return 0
  if (step.parabolaSequence?.length) return step.parabolaSequence.length
  if (step.circleSequence?.length) return step.circleSequence.length
  if (step.ellipseSequence?.length) return step.ellipseSequence.length
  if (step.hyperbolaSequence?.length) return step.hyperbolaSequence.length
  if (step.unitCircleSequence?.length) return step.unitCircleSequence.length
  if (step.trigGraphSequence?.length) return step.trigGraphSequence.length
  return step.sequence?.length ?? 0
}

/** Pin a saved step index into the lesson's current bounds (steps may have been removed). */
function clampStepIndex(lesson: Lesson, savedIndex: number | undefined): number {
  const lastIndex = Math.max(0, lesson.steps.length - 1)
  return Math.min(Math.max(savedIndex ?? 0, 0), lastIndex)
}

function initialMasteryIndex(lesson: Lesson, progress: LessonProgress | null): number {
  if (progress?.completed) return 0

  const stepIndex = clampStepIndex(lesson, progress?.currentStepIndex)
  const saved = progress?.masteryIndex ?? 0
  const step = lesson.steps[stepIndex]
  const max = masterySequenceLength(step)

  if (step?.type === 'mastery' && saved > max) {
    return 0
  }

  return saved
}

function exploreTracksDistinctP(step: Step | undefined): boolean {
  return (
    step?.type === 'explore' &&
    typeof step.successCondition === 'object' &&
    'minDistinctP' in step.successCondition
  )
}

function exploreTracksMovedFocusDirectrix(step: Step | undefined): boolean {
  return (
    step?.type === 'explore' &&
    typeof step.successCondition === 'object' &&
    'movedFocusAndDirectrix' in step.successCondition
  )
}

function exploreTracksDistinctR(step: Step | undefined): boolean {
  return (
    step?.type === 'explore' &&
    typeof step.successCondition === 'object' &&
    'minDistinctR' in step.successCondition
  )
}

function exploreTracksMovedCenterRadius(step: Step | undefined): boolean {
  return (
    step?.type === 'explore' &&
    typeof step.successCondition === 'object' &&
    'movedCenterAndRadius' in step.successCondition
  )
}

export function LessonEngine({
  lesson,
  initialProgress,
  onSaveProgress,
  onCompleteLesson,
  onRecordAttempt,
}: LessonEngineProps) {
  const navigate = useNavigate()
  const usesParabola = lessonUsesParabolaSimulator(lesson)
  const usesCircle = lessonUsesCircleSimulator(lesson)
  const usesEllipse = lessonUsesEllipseSimulator(lesson)
  const usesHyperbola = lessonUsesHyperbolaSimulator(lesson)
  const usesUnitCircle = lessonUsesUnitCircleSimulator(lesson)
  const usesTrigGraph = lessonUsesTrigGraphSimulator(lesson)
  const usesCone = lessonUsesConeSimulator(lesson)
  const initialStepIndex = clampStepIndex(lesson, initialProgress?.currentStepIndex)
  const [stepIndex, setStepIndex] = useState(initialStepIndex)
  const [plane, setPlane] = useState<PlaneState>(DEFAULT_PLANE)
  const [parabola, setParabola] = useState<ParabolaState>(DEFAULT_PARABOLA)
  const [circle, setCircle] = useState<CircleState>(DEFAULT_CIRCLE)
  const [ellipse, setEllipse] = useState<EllipseState>(DEFAULT_ELLIPSE)
  const [hyperbola, setHyperbola] = useState<HyperbolaState>(DEFAULT_HYPERBOLA)
  const [unitCircle, setUnitCircle] = useState<UnitCircleState>(DEFAULT_UNIT_CIRCLE)
  const [trigGraph, setTrigGraph] = useState<TrigGraphState>(DEFAULT_TRIG_GRAPH)
  const initialParabolaRef = useRef(DEFAULT_PARABOLA)
  const initialCircleRef = useRef(DEFAULT_CIRCLE)
  const [distinctConicsSeen, setDistinctConicsSeen] = useState<Set<ConicType>>(
    () => new Set((initialProgress?.distinctConicsSeen ?? []) as ConicType[]),
  )
  const [distinctPValues, setDistinctPValues] = useState<Set<number>>(
    () => new Set(initialProgress?.distinctPValues ?? []),
  )
  const [distinctRValues, setDistinctRValues] = useState<Set<number>>(
    () => new Set(initialProgress?.distinctRValues ?? []),
  )
  const [movedFocus, setMovedFocus] = useState(initialProgress?.movedFocus ?? false)
  const [movedDirectrix, setMovedDirectrix] = useState(initialProgress?.movedDirectrix ?? false)
  const [movedCenter, setMovedCenter] = useState(initialProgress?.movedCenter ?? false)
  const [movedRadius, setMovedRadius] = useState(initialProgress?.movedRadius ?? false)
  const [masteryIndex, setMasteryIndex] = useState(() =>
    initialMasteryIndex(lesson, initialProgress),
  )
  const [furthestStepIndex, setFurthestStepIndex] = useState(initialStepIndex)
  const [pendingAttempt, setPendingAttempt] = useState<{ skillId: string; result: AttemptResult } | null>(null)

  const step = lesson.steps[stepIndex]
  const isReviewing = stepIndex < furthestStepIndex

  const lessonConic = usesParabola ? 'parabola'
    : usesCircle ? 'circle'
    : usesEllipse ? 'ellipse'
    : usesHyperbola ? 'hyperbola'
    : usesUnitCircle ? 'unit-circle'
    : usesTrigGraph ? 'trig-graph'
    : null

  const onRequestHint = useCallback(
    (wrongComponents: string[], details: HintDetail[], hintIndex: number) =>
      lessonConic && step
        ? requestHint({ conic: lessonConic, prompt: 'prompt' in step ? step.prompt : '', wrongComponents, details, hintIndex })
        : Promise.resolve(null),
    [lessonConic, step],
  )
  const prevStepIndexRef = useRef(stepIndex)
  const stepIndexRef = useRef(stepIndex)
  const sessionAttemptsRef = useRef<SessionAttempt[]>([])

  // Mirror the current step index into a ref for use inside change handlers,
  // without writing to the ref during render.
  useEffect(() => {
    stepIndexRef.current = stepIndex
  }, [stepIndex])

  // Reset per-step working state when the step changes. This intentionally sets state
  // inside an effect (resetting shared simulator state that lives here, not in the child),
  // so the React-compiler set-state-in-effect rule is disabled for just this block.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prevStepIndexRef.current === stepIndex) return
    prevStepIndexRef.current = stepIndex
    setPendingAttempt(null)

    const currentStep = lesson.steps[stepIndex]
    if (!currentStep) return

    if (usesParabola && currentStep.type === 'challenge') {
      setParabola(DEFAULT_PARABOLA)
      initialParabolaRef.current = DEFAULT_PARABOLA
    }

    if (usesCircle && currentStep.type === 'challenge') {
      setCircle(DEFAULT_CIRCLE)
      initialCircleRef.current = DEFAULT_CIRCLE
    }

    if (usesEllipse && currentStep.type === 'challenge') {
      setEllipse(DEFAULT_ELLIPSE)
    }

    if (usesHyperbola && currentStep.type === 'challenge') {
      setHyperbola(DEFAULT_HYPERBOLA)
    }

    if (usesUnitCircle && currentStep.type === 'challenge') {
      setUnitCircle(DEFAULT_UNIT_CIRCLE)
    }

    if (usesTrigGraph && currentStep.type === 'challenge') {
      setTrigGraph(DEFAULT_TRIG_GRAPH)
    }

    if (currentStep.type === 'explore') {
      if (exploreTracksDistinctP(currentStep)) {
        setDistinctPValues(new Set())
        if (usesParabola && currentStep.parabolaConfig?.focusVerticalOnly === true) {
          setParabola(DEFAULT_PARABOLA)
          initialParabolaRef.current = DEFAULT_PARABOLA
        }
      }
      if (exploreTracksMovedFocusDirectrix(currentStep)) {
        setMovedFocus(false)
        setMovedDirectrix(false)
        if (usesParabola) {
          setParabola(DEFAULT_PARABOLA)
          initialParabolaRef.current = DEFAULT_PARABOLA
        }
      }
      if (exploreTracksDistinctR(currentStep)) {
        setDistinctRValues(new Set())
      }
      if (exploreTracksMovedCenterRadius(currentStep)) {
        setMovedCenter(false)
        setMovedRadius(false)
        if (usesCircle) {
          setCircle(DEFAULT_CIRCLE)
          initialCircleRef.current = DEFAULT_CIRCLE
        }
      }
    }
  }, [stepIndex, lesson.steps, usesParabola, usesCircle, usesEllipse, usesHyperbola, usesUnitCircle, usesTrigGraph])
  /* eslint-enable react-hooks/set-state-in-effect */

  const persistProgress = useCallback(
    (nextStepIndex: number, extra?: Partial<LessonProgress>) => {
      onSaveProgress({
        currentStepIndex: nextStepIndex,
        completed: false,
        distinctConicsSeen: [...distinctConicsSeen],
        distinctPValues: [...distinctPValues],
        distinctRValues: [...distinctRValues],
        movedFocus,
        movedDirectrix,
        movedCenter,
        movedRadius,
        masteryIndex,
        ...extra,
      })
    },
    [
      distinctConicsSeen,
      distinctPValues,
      distinctRValues,
      masteryIndex,
      movedCenter,
      movedDirectrix,
      movedFocus,
      movedRadius,
      onSaveProgress,
    ],
  )

  const handlePlaneChange = useCallback((nextPlane: PlaneState) => {
    setPlane(nextPlane)
    const conic = classifyConic(nextPlane.angle, nextPlane.offset)
    if (conic !== 'none') {
      setDistinctConicsSeen((prev) => new Set([...prev, conic]))
    }
  }, [])

  const handleParabolaChange = useCallback((nextParabola: ParabolaState) => {
    const clamped = clampParabolaState(nextParabola)
    setParabola(clamped)

    const currentStep = lesson.steps[stepIndexRef.current]

    if (exploreTracksMovedFocusDirectrix(currentStep)) {
      const initial = initialParabolaRef.current
      if (Math.abs(clamped.focusX - initial.focusX) > 0.05) {
        setMovedFocus(true)
      }
      if (Math.abs(clamped.focusY - initial.focusY) > 0.05) {
        setMovedFocus(true)
      }
      if (Math.abs(clamped.directrixY - initial.directrixY) > 0.05) {
        setMovedDirectrix(true)
      }
    }

    if (exploreTracksDistinctP(currentStep)) {
      const { p } = deriveParabola(clamped)
      if (p >= PARABOLA_MIN_P) {
        setDistinctPValues((prev) => new Set([...prev, roundP(p)]))
      }
    }
  }, [lesson.steps])

  const handleCircleChange = useCallback((nextCircle: CircleState) => {
    const clamped = clampCircleState(nextCircle)
    setCircle(clamped)

    const currentStep = lesson.steps[stepIndexRef.current]

    if (exploreTracksMovedCenterRadius(currentStep)) {
      const initial = initialCircleRef.current
      if (
        Math.abs(clamped.centerX - initial.centerX) > 0.05 ||
        Math.abs(clamped.centerY - initial.centerY) > 0.05
      ) {
        setMovedCenter(true)
      }
      if (Math.abs(clamped.radius - initial.radius) > 0.05) {
        setMovedRadius(true)
      }
    }

    if (exploreTracksDistinctR(currentStep)) {
      if (clamped.radius >= CIRCLE_MIN_R) {
        setDistinctRValues((prev) => new Set([...prev, roundR(clamped.radius)]))
      }
    }
  }, [lesson.steps])

  const handleEllipseChange = useCallback((nextEllipse: EllipseState) => {
    setEllipse(clampEllipseState(nextEllipse))
  }, [])

  const handleHyperbolaChange = useCallback((nextHyperbola: HyperbolaState) => {
    setHyperbola(clampHyperbolaState(nextHyperbola))
  }, [])

  const handleUnitCircleChange = useCallback((next: UnitCircleState) => {
    setUnitCircle({ angle: clampAngle(next.angle) })
  }, [])

  const handleTrigGraphChange = useCallback((next: TrigGraphState) => {
    setTrigGraph(clampTrigGraphState(next))
  }, [])

  const finishLesson = () => {
    onCompleteLesson()
    navigate(`/lesson/${lesson.id}/complete`, {
      state: { sessionAttempts: sessionAttemptsRef.current },
    })
  }

  const goToNextStep = () => {
    // Flush any attempt the learner didn't tag with a confidence level before moving on,
    // so it still lands in this run's stats and the session attempts handed to the tutor.
    recordPending(undefined)
    const next = stepIndex + 1
    if (next >= lesson.steps.length) {
      finishLesson()
      return
    }
    const newFurthest = Math.max(furthestStepIndex, next)
    setFurthestStepIndex(newFurthest)
    setStepIndex(next)
    persistProgress(newFurthest)
  }

  const goToPreviousStep = () => {
    if (stepIndex === 0) return
    setStepIndex(stepIndex - 1)
  }

  const handleMasteryIndexChange = (index: number) => {
    setMasteryIndex(index)
    onSaveProgress({
      currentStepIndex: stepIndex,
      completed: false,
      distinctConicsSeen: [...distinctConicsSeen],
      distinctPValues: [...distinctPValues],
      distinctRValues: [...distinctRValues],
      movedFocus,
      movedDirectrix,
      movedCenter,
      movedRadius,
      masteryIndex: index,
    })
  }

  const handleComplete = () => {
    finishLesson()
  }

  const handleAttempt = (result: AttemptResult) => {
    if (!step) return
    const skillId = skillForStep(lesson, step)
    if (!skillId) return
    setPendingAttempt({ skillId, result })
  }

  // Record the pending attempt exactly once (with the chosen confidence, if any). Called
  // both when the learner picks a confidence level and as a flush when they advance without
  // choosing one, so a lesson attempt is never silently dropped from stats/tutor data.
  const recordPending = (confidence: AttemptResult['confidence']) => {
    if (!pendingAttempt) return
    const { skillId, result } = pendingAttempt
    const recorded: AttemptResult = { ...result, confidence }
    sessionAttemptsRef.current.push({
      skillId,
      correct: recorded.correct,
      weakComponents: recorded.weakComponents,
    })
    onRecordAttempt?.(skillId, recorded)
    setPendingAttempt(null)
  }

  const handleConfidenceSelect = (confidence: AttemptResult['confidence']) => {
    recordPending(confidence)
  }

  if (!step) {
    return <p>Lesson step not found.</p>
  }

  return (
    <div className="lesson-engine">
      <ProgressBar current={stepIndex + 1} total={lesson.steps.length} />

      <div className="lesson-nav">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={goToPreviousStep}
          disabled={stepIndex === 0}
        >
          ← Back
        </button>

        {isReviewing && (
          <div className="lesson-nav-review">
            <span className="lesson-nav-review-label">
              Reviewing — your progress is saved at step {furthestStepIndex + 1}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={goToNextStep}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <StepInfoPanel
        step={step}
        stepNumber={stepIndex + 1}
        totalSteps={lesson.steps.length}
      />

      {usesParabola && step.type === 'explore' && (
        <ParabolaExploreStepView
          key={stepIndex}
          step={step}
          parabola={parabola}
          onParabolaChange={handleParabolaChange}
          distinctPValues={distinctPValues}
          movedFocus={movedFocus}
          movedDirectrix={movedDirectrix}
          onContinue={goToNextStep}
        />
      )}

      {usesCircle && step.type === 'explore' && (
        <CircleExploreStepView
          key={stepIndex}
          step={step}
          circle={circle}
          onCircleChange={handleCircleChange}
          distinctRValues={distinctRValues}
          movedCenter={movedCenter}
          movedRadius={movedRadius}
          onContinue={goToNextStep}
        />
      )}

      {usesEllipse && step.type === 'explore' && (
        <EllipseExploreStepView
          key={stepIndex}
          step={step}
          ellipse={ellipse}
          onEllipseChange={handleEllipseChange}
          onContinue={goToNextStep}
        />
      )}

      {usesHyperbola && step.type === 'explore' && (
        <HyperbolaExploreStepView
          key={stepIndex}
          step={step}
          hyperbola={hyperbola}
          onHyperbolaChange={handleHyperbolaChange}
          onContinue={goToNextStep}
        />
      )}

      {usesUnitCircle && step.type === 'explore' && (
        <UnitCircleExploreStepView
          key={stepIndex}
          step={step}
          unitCircle={unitCircle}
          onUnitCircleChange={handleUnitCircleChange}
          onContinue={goToNextStep}
        />
      )}

      {usesTrigGraph && step.type === 'explore' && (
        <TrigGraphExploreStepView
          key={stepIndex}
          step={step}
          graph={trigGraph}
          onGraphChange={handleTrigGraphChange}
          onContinue={goToNextStep}
        />
      )}

      {usesCone && step.type === 'explore' && (
        <ExploreStepView
          key={stepIndex}
          step={step}
          plane={plane}
          onPlaneChange={handlePlaneChange}
          distinctConicsSeen={distinctConicsSeen}
          onContinue={goToNextStep}
        />
      )}

      {usesParabola && step.type === 'challenge' && (
        <ParabolaChallengeStepView
          key={stepIndex}
          step={step}
          parabola={parabola}
          onParabolaChange={handleParabolaChange}
          onSuccess={goToNextStep}
          onAttempt={handleAttempt}
          onRequestHint={onRequestHint}
        />
      )}

      {usesCircle && step.type === 'challenge' && (
        <CircleChallengeStepView
          key={stepIndex}
          step={step}
          circle={circle}
          onCircleChange={handleCircleChange}
          onSuccess={goToNextStep}
          onAttempt={handleAttempt}
          onRequestHint={onRequestHint}
        />
      )}

      {usesEllipse && step.type === 'challenge' && (
        <EllipseChallengeStepView
          key={stepIndex}
          step={step}
          ellipse={ellipse}
          onEllipseChange={handleEllipseChange}
          onSuccess={goToNextStep}
          onAttempt={handleAttempt}
          onRequestHint={onRequestHint}
        />
      )}

      {usesHyperbola && step.type === 'challenge' && (
        <HyperbolaChallengeStepView
          key={stepIndex}
          step={step}
          hyperbola={hyperbola}
          onHyperbolaChange={handleHyperbolaChange}
          onSuccess={goToNextStep}
          onAttempt={handleAttempt}
          onRequestHint={onRequestHint}
        />
      )}

      {usesUnitCircle && step.type === 'challenge' && (
        <UnitCircleChallengeStepView
          key={stepIndex}
          step={step}
          unitCircle={unitCircle}
          onUnitCircleChange={handleUnitCircleChange}
          onSuccess={goToNextStep}
          onAttempt={handleAttempt}
          onRequestHint={onRequestHint}
        />
      )}

      {usesTrigGraph && step.type === 'challenge' && (
        <TrigGraphChallengeStepView
          key={stepIndex}
          step={step}
          graph={trigGraph}
          onGraphChange={handleTrigGraphChange}
          onSuccess={goToNextStep}
          onAttempt={handleAttempt}
          onRequestHint={onRequestHint}
        />
      )}

      {usesCone && step.type === 'challenge' && (
        <ChallengeStepView
          key={stepIndex}
          step={step}
          plane={plane}
          onPlaneChange={handlePlaneChange}
          onSuccess={goToNextStep}
        />
      )}

      {step.type === 'reflection' && (
        <ReflectionStepView
          key={stepIndex}
          step={step}
          onSuccess={goToNextStep}
          onAttempt={handleAttempt}
        />
      )}

      {usesParabola && step.type === 'mastery' && (
        <ParabolaMasteryCheckStepView
          key={stepIndex}
          step={step}
          parabola={parabola}
          onParabolaChange={handleParabolaChange}
          masteryIndex={masteryIndex}
          onMasteryIndexChange={handleMasteryIndexChange}
          onComplete={handleComplete}
        />
      )}

      {usesCircle && step.type === 'mastery' && (
        <CircleMasteryCheckStepView
          key={stepIndex}
          step={step}
          circle={circle}
          onCircleChange={handleCircleChange}
          masteryIndex={masteryIndex}
          onMasteryIndexChange={handleMasteryIndexChange}
          onComplete={handleComplete}
        />
      )}

      {usesEllipse && step.type === 'mastery' && (
        <EllipseMasteryCheckStepView
          key={stepIndex}
          step={step}
          ellipse={ellipse}
          onEllipseChange={handleEllipseChange}
          masteryIndex={masteryIndex}
          onMasteryIndexChange={handleMasteryIndexChange}
          onComplete={handleComplete}
        />
      )}

      {usesHyperbola && step.type === 'mastery' && (
        <HyperbolaMasteryCheckStepView
          key={stepIndex}
          step={step}
          hyperbola={hyperbola}
          onHyperbolaChange={handleHyperbolaChange}
          masteryIndex={masteryIndex}
          onMasteryIndexChange={handleMasteryIndexChange}
          onComplete={handleComplete}
        />
      )}

      {usesUnitCircle && step.type === 'mastery' && (
        <UnitCircleMasteryCheckStepView
          key={stepIndex}
          step={step}
          unitCircle={unitCircle}
          onUnitCircleChange={handleUnitCircleChange}
          masteryIndex={masteryIndex}
          onMasteryIndexChange={handleMasteryIndexChange}
          onComplete={handleComplete}
        />
      )}

      {usesTrigGraph && step.type === 'mastery' && (
        <TrigGraphMasteryCheckStepView
          key={stepIndex}
          step={step}
          graph={trigGraph}
          onGraphChange={handleTrigGraphChange}
          masteryIndex={masteryIndex}
          onMasteryIndexChange={handleMasteryIndexChange}
          onComplete={handleComplete}
        />
      )}

      {usesCone && step.type === 'mastery' && (
        <MasteryCheckStepView
          key={stepIndex}
          step={step}
          plane={plane}
          onPlaneChange={handlePlaneChange}
          masteryIndex={masteryIndex}
          onMasteryIndexChange={handleMasteryIndexChange}
          onComplete={handleComplete}
        />
      )}

      {pendingAttempt && <ConfidencePrompt onSelect={handleConfidenceSelect} />}
    </div>
  )
}
