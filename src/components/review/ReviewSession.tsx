import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GeneratedItem } from '../../lib/reviewGenerator'
import type { ChallengeStep, ReflectionStep } from '../../types/lesson'
import type { AttemptResult } from '../../lib/feedback'
import { performanceFromAttempts, type SessionAttempt } from '../../lib/ai/tutorClient'
import { PostSessionTutor } from './PostSessionTutor'
import { ParabolaChallengeStepView } from '../lesson/steps/ParabolaChallengeStepView'
import { CircleChallengeStepView } from '../lesson/steps/CircleChallengeStepView'
import { EllipseChallengeStepView } from '../lesson/steps/EllipseChallengeStepView'
import { HyperbolaChallengeStepView } from '../lesson/steps/HyperbolaChallengeStepView'
import { ReflectionStepView } from '../lesson/steps/ReflectionStepView'
import { StepInfoPanel } from '../lesson/StepInfoPanel'
import { ProgressBar } from '../lesson/ProgressBar'
import { clampParabolaState, DEFAULT_PARABOLA, type ParabolaState } from '../../lib/parabolaGeometry'
import { clampCircleState, DEFAULT_CIRCLE, type CircleState } from '../../lib/circleGeometry'
import { clampEllipseState, DEFAULT_ELLIPSE, type EllipseState } from '../../lib/ellipseGeometry'
import {
  clampHyperbolaState,
  DEFAULT_HYPERBOLA,
  type HyperbolaState,
} from '../../lib/hyperbolaGeometry'

type ReviewSessionProps = {
  items: GeneratedItem[]
  onRecordAttempt: (skillId: string, result: AttemptResult) => void
  onRestart: () => void
  /** Heading on the completion screen. Defaults to the Smart Review wording. */
  title?: string
  /** Label for the "start a new session" button. */
  restartLabel?: string
  /** Whether to show the AI tutor summary on completion. */
  showTutor?: boolean
  /**
   * Topic label for the AI tutor summary (e.g. "Circles"). Defaults to
   * "conic sections" for Smart Review which covers all conics.
   */
  tutorTopic?: string
  /** Source context for the AI tutor. Defaults to 'review'. */
  tutorSource?: 'review' | 'practice'
  /** Fired once when the session is fully completed (all items finished). */
  onComplete?: () => void
}

/**
 * One review item with its own working state. Keyed by item id in the parent, so each
 * item remounts with fresh state — no reset effect needed.
 */
function ReviewItem({
  item,
  onSuccess,
  onAttempt,
}: {
  item: GeneratedItem
  onSuccess: () => void
  onAttempt: (result: AttemptResult) => void
}) {
  const [parabola, setParabola] = useState<ParabolaState>(DEFAULT_PARABOLA)
  const [circle, setCircle] = useState<CircleState>(DEFAULT_CIRCLE)
  const [ellipse, setEllipse] = useState<EllipseState>(DEFAULT_ELLIPSE)
  const [hyperbola, setHyperbola] = useState<HyperbolaState>(DEFAULT_HYPERBOLA)

  if (item.kind === 'reflection') {
    return <ReflectionStepView step={item.step as ReflectionStep} onSuccess={onSuccess} onAttempt={onAttempt} />
  }

  const challengeStep = item.step as ChallengeStep
  switch (item.conic) {
    case 'parabola':
      return (
        <ParabolaChallengeStepView
          step={challengeStep}
          parabola={parabola}
          onParabolaChange={(s) => setParabola(clampParabolaState(s))}
          onSuccess={onSuccess}
          onAttempt={onAttempt}
        />
      )
    case 'circle':
      return (
        <CircleChallengeStepView
          step={challengeStep}
          circle={circle}
          onCircleChange={(s) => setCircle(clampCircleState(s))}
          onSuccess={onSuccess}
          onAttempt={onAttempt}
        />
      )
    case 'ellipse':
      return (
        <EllipseChallengeStepView
          step={challengeStep}
          ellipse={ellipse}
          onEllipseChange={(s) => setEllipse(clampEllipseState(s))}
          onSuccess={onSuccess}
          onAttempt={onAttempt}
        />
      )
    case 'hyperbola':
      return (
        <HyperbolaChallengeStepView
          step={challengeStep}
          hyperbola={hyperbola}
          onHyperbolaChange={(s) => setHyperbola(clampHyperbolaState(s))}
          onSuccess={onSuccess}
          onAttempt={onAttempt}
        />
      )
  }
}

export function ReviewSession({
  items,
  onRecordAttempt,
  onRestart,
  title = 'Review complete',
  restartLabel = 'New review',
  showTutor = true,
  tutorTopic,
  tutorSource = 'review',
  onComplete,
}: ReviewSessionProps) {
  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [attempts, setAttempts] = useState<SessionAttempt[]>([])

  const finished = index >= items.length
  const item = finished ? null : items[index]

  // Notify the parent exactly once when the session is completed (e.g. to clear the daily gate).
  const completedRef = useRef(false)
  useEffect(() => {
    if (finished && !completedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }, [finished, onComplete])

  const goNext = () => setIndex((i) => i + 1)

  const handleAttempt = (it: GeneratedItem, result: AttemptResult) => {
    setAttempts((prev) => [
      ...prev,
      { skillId: it.skillId, correct: result.correct, weakComponents: result.weakComponents },
    ])
    onRecordAttempt(it.skillId, result)
    if (result.correct) {
      setCorrectCount((c) => c + 1)
    }
  }

  if (finished) {
    const topic = tutorTopic ?? 'conic sections'
    const concepts =
      tutorSource === 'practice' && tutorTopic
        ? [tutorTopic]
        : ['circles', 'parabolas', 'ellipses', 'hyperbolas']

    return (
      <>
        <div className="page-card review-summary">
          <h2>{title}</h2>
          <p className="completion-message">
            You got {correctCount} of {items.length} correct. Keep the streak going!
          </p>
          <div className="step-actions">
            <button type="button" className="btn btn-primary" onClick={onRestart}>
              {restartLabel}
            </button>
            <Link to="/" className="btn btn-secondary">
              Back to Course Map
            </Link>
          </div>
        </div>

        {showTutor && (
          <div className="page-card tutor-card">
            <PostSessionTutor
              performance={performanceFromAttempts(topic, tutorSource, attempts)}
              concepts={concepts}
            />
          </div>
        )}
      </>
    )
  }

  return (
    <div className="lesson-engine">
      <ProgressBar current={index + 1} total={items.length} />
      <StepInfoPanel step={item!.step} stepNumber={index + 1} totalSteps={items.length} />
      <ReviewItem
        key={item!.id}
        item={item!}
        onSuccess={goNext}
        onAttempt={(result) => handleAttempt(item!, result)}
      />
    </div>
  )
}
