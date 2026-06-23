import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { classifyConic, type PlaneState } from '../../lib/conicClassifier'
import type { ConicType, Lesson } from '../../types/lesson'
import type { LessonProgress } from '../../types/progress'
import { ProgressBar } from './ProgressBar'
import { ChallengeStepView } from './steps/ChallengeStepView'
import { ExploreStepView } from './steps/ExploreStepView'
import { MasteryCheckStepView } from './steps/MasteryCheckStepView'
import { ReflectionStepView } from './steps/ReflectionStepView'

type LessonEngineProps = {
  lesson: Lesson
  initialProgress: LessonProgress | null
  onSaveProgress: (progress: LessonProgress) => void
  onCompleteLesson: () => void
}

const DEFAULT_PLANE: PlaneState = { angle: 0, offset: -55 }

export function LessonEngine({
  lesson,
  initialProgress,
  onSaveProgress,
  onCompleteLesson,
}: LessonEngineProps) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(initialProgress?.currentStepIndex ?? 0)
  const [plane, setPlane] = useState<PlaneState>(DEFAULT_PLANE)
  const [distinctConicsSeen, setDistinctConicsSeen] = useState<Set<ConicType>>(
    () => new Set((initialProgress?.distinctConicsSeen ?? []) as ConicType[]),
  )
  const [masteryIndex, setMasteryIndex] = useState(initialProgress?.masteryIndex ?? 0)

  const step = lesson.steps[stepIndex]

  const handlePlaneChange = useCallback((nextPlane: PlaneState) => {
    setPlane(nextPlane)
    const conic = classifyConic(nextPlane.angle, nextPlane.offset)
    if (conic !== 'none') {
      setDistinctConicsSeen((prev) => new Set([...prev, conic]))
    }
  }, [])

  const persist = useCallback(
    (nextStepIndex: number, extra?: Partial<LessonProgress>) => {
      onSaveProgress({
        currentStepIndex: nextStepIndex,
        completed: false,
        distinctConicsSeen: [...distinctConicsSeen],
        masteryIndex,
        ...extra,
      })
    },
    [distinctConicsSeen, masteryIndex, onSaveProgress],
  )

  const goToNextStep = () => {
    const next = stepIndex + 1
    if (next >= lesson.steps.length) {
      onCompleteLesson()
      navigate(`/lesson/${lesson.id}/complete`)
      return
    }
    setStepIndex(next)
    persist(next)
  }

  const handleMasteryIndexChange = (index: number) => {
    setMasteryIndex(index)
    onSaveProgress({
      currentStepIndex: stepIndex,
      completed: false,
      distinctConicsSeen: [...distinctConicsSeen],
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

      {step.type === 'explore' && (
        <ExploreStepView
          key={stepIndex}
          step={step}
          plane={plane}
          onPlaneChange={handlePlaneChange}
          distinctConicsSeen={distinctConicsSeen}
          onContinue={goToNextStep}
        />
      )}

      {step.type === 'challenge' && (
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

      {step.type === 'mastery' && (
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
