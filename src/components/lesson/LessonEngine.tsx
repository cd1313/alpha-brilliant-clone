import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { classifyConic, type PlaneState } from '../../lib/conicClassifier'
import { lessonUsesParabolaSimulator } from '../../lib/course'
import {
  clampParabolaState,
  DEFAULT_PARABOLA,
  deriveParabola,
  PARABOLA_MIN_P,
  roundP,
  type ParabolaState,
} from '../../lib/parabolaGeometry'
import type { ConicType, Lesson, Step } from '../../types/lesson'
import type { LessonProgress } from '../../types/progress'
import { ProgressBar } from './ProgressBar'
import { StepInfoPanel } from './StepInfoPanel'
import { ChallengeStepView } from './steps/ChallengeStepView'
import { ExploreStepView } from './steps/ExploreStepView'
import { MasteryCheckStepView } from './steps/MasteryCheckStepView'
import { ParabolaChallengeStepView } from './steps/ParabolaChallengeStepView'
import { ParabolaExploreStepView } from './steps/ParabolaExploreStepView'
import { ParabolaMasteryCheckStepView } from './steps/ParabolaMasteryCheckStepView'
import { ReflectionStepView } from './steps/ReflectionStepView'

type LessonEngineProps = {
  lesson: Lesson
  initialProgress: LessonProgress | null
  onSaveProgress: (progress: LessonProgress) => void
  onCompleteLesson: () => void
}

const DEFAULT_PLANE: PlaneState = { angle: 0, offset: -55 }

function masterySequenceLength(step: Step | undefined): number {
  if (!step || step.type !== 'mastery') return 0
  if (step.parabolaSequence?.length) return step.parabolaSequence.length
  return step.sequence?.length ?? 0
}

function initialMasteryIndex(lesson: Lesson, progress: LessonProgress | null): number {
  if (progress?.completed) return 0

  const stepIndex = progress?.currentStepIndex ?? 0
  const saved = progress?.masteryIndex ?? 0
  const step = lesson.steps[stepIndex]
  const max = masterySequenceLength(step)

  if (step?.type === 'mastery' && saved > max) {
    return 0
  }

  return saved
}

export function LessonEngine({
  lesson,
  initialProgress,
  onSaveProgress,
  onCompleteLesson,
}: LessonEngineProps) {
  const navigate = useNavigate()
  const usesParabola = lessonUsesParabolaSimulator(lesson)
  const [stepIndex, setStepIndex] = useState(initialProgress?.currentStepIndex ?? 0)
  const [plane, setPlane] = useState<PlaneState>(DEFAULT_PLANE)
  const [parabola, setParabola] = useState<ParabolaState>(DEFAULT_PARABOLA)
  const initialParabolaRef = useRef(DEFAULT_PARABOLA)
  const [distinctConicsSeen, setDistinctConicsSeen] = useState<Set<ConicType>>(
    () => new Set((initialProgress?.distinctConicsSeen ?? []) as ConicType[]),
  )
  const [distinctPValues, setDistinctPValues] = useState<Set<number>>(
    () => new Set(initialProgress?.distinctPValues ?? []),
  )
  const [movedFocus, setMovedFocus] = useState(initialProgress?.movedFocus ?? false)
  const [movedDirectrix, setMovedDirectrix] = useState(initialProgress?.movedDirectrix ?? false)
  const [masteryIndex, setMasteryIndex] = useState(() =>
    initialMasteryIndex(lesson, initialProgress),
  )

  const step = lesson.steps[stepIndex]

  const persistProgress = useCallback(
    (nextStepIndex: number, extra?: Partial<LessonProgress>) => {
      onSaveProgress({
        currentStepIndex: nextStepIndex,
        completed: false,
        distinctConicsSeen: [...distinctConicsSeen],
        distinctPValues: [...distinctPValues],
        movedFocus,
        movedDirectrix,
        masteryIndex,
        ...extra,
      })
    },
    [distinctConicsSeen, distinctPValues, masteryIndex, movedDirectrix, movedFocus, onSaveProgress],
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

    const { p } = deriveParabola(clamped)
    if (p >= PARABOLA_MIN_P) {
      setDistinctPValues((prev) => new Set([...prev, roundP(p)]))
    }
  }, [])

  const goToNextStep = () => {
    const next = stepIndex + 1
    if (next >= lesson.steps.length) {
      onCompleteLesson()
      navigate(`/lesson/${lesson.id}/complete`)
      return
    }
    setStepIndex(next)
    persistProgress(next)
  }

  const handleMasteryIndexChange = (index: number) => {
    setMasteryIndex(index)
    onSaveProgress({
      currentStepIndex: stepIndex,
      completed: false,
      distinctConicsSeen: [...distinctConicsSeen],
      distinctPValues: [...distinctPValues],
      movedFocus,
      movedDirectrix,
      masteryIndex: index,
    })
  }

  const handleComplete = () => {
    onCompleteLesson()
    navigate(`/lesson/${lesson.id}/complete`)
  }

  if (!step) {
    return <p>Lesson step not found.</p>
  }

  return (
    <div className="lesson-engine">
      <ProgressBar current={stepIndex + 1} total={lesson.steps.length} />

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

      {!usesParabola && step.type === 'explore' && (
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
        />
      )}

      {!usesParabola && step.type === 'challenge' && (
        <ChallengeStepView
          key={stepIndex}
          step={step}
          plane={plane}
          onPlaneChange={handlePlaneChange}
          onSuccess={goToNextStep}
        />
      )}

      {step.type === 'reflection' && (
        <ReflectionStepView key={stepIndex} step={step} onSuccess={goToNextStep} />
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

      {!usesParabola && step.type === 'mastery' && (
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
    </div>
  )
}
