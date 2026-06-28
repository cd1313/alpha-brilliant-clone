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
import { UnitCircleChallengeStepView } from '../lesson/steps/UnitCircleChallengeStepView'
import { TrigGraphChallengeStepView } from '../lesson/steps/TrigGraphChallengeStepView'
import { ReflectionStepView } from '../lesson/steps/ReflectionStepView'
import { ConfidencePrompt } from '../lesson/ConfidencePrompt'
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
import { clampAngle, DEFAULT_UNIT_CIRCLE, type UnitCircleState } from '../../lib/unitCircleGeometry'
import { clampTrigGraphState, DEFAULT_TRIG_GRAPH, type TrigGraphState } from '../../lib/trigGraphGeometry'

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
  /**
   * On-demand AI hint provider. When supplied, challenge views call this when
   * the student presses Hint, passing what they currently have wrong so the AI
   * can tailor the hint to their live answer. Absent in lessons and Smart Review.
   */
  getAiHint?: (conic: string, prompt: string, wrongComponents: string[]) => Promise<string | null>
  /** Fired once when the session is fully completed, with the final score. */
  onComplete?: (correctCount: number, total: number) => void
  /** Like onComplete but also takes over the completion UI — used by unit tests. */
  onFinish?: (correctCount: number, total: number) => void
  /** When false, each challenge is single-attempt with no hints (used by unit tests). */
  allowRetry?: boolean
  /**
   * When set (0-1), the summary screen explains that scoring at/above this fraction is
   * what counts toward unlocking the next lesson. Used by Smart Review and Practice.
   */
  reviewPassThreshold?: number
}

/**
 * One review item with its own working state. Keyed by item id in the parent, so each
 * item remounts with fresh state — no reset effect needed.
 */
function ReviewItem({
  item,
  onSuccess,
  onAttempt,
  getAiHint,
  allowRetry,
}: {
  item: GeneratedItem
  onSuccess: () => void
  onAttempt: (result: AttemptResult) => void
  getAiHint?: (conic: string, prompt: string, wrongComponents: string[]) => Promise<string | null>
  allowRetry?: boolean
}) {
  const [parabola, setParabola] = useState<ParabolaState>(DEFAULT_PARABOLA)
  const [circle, setCircle] = useState<CircleState>(DEFAULT_CIRCLE)
  const [ellipse, setEllipse] = useState<EllipseState>(DEFAULT_ELLIPSE)
  const [hyperbola, setHyperbola] = useState<HyperbolaState>(DEFAULT_HYPERBOLA)
  const [unitCircle, setUnitCircle] = useState<UnitCircleState>(DEFAULT_UNIT_CIRCLE)
  const [trigGraph, setTrigGraph] = useState<TrigGraphState>(DEFAULT_TRIG_GRAPH)

  if (item.kind === 'reflection') {
    return <ReflectionStepView step={item.step as ReflectionStep} onSuccess={onSuccess} onAttempt={onAttempt} allowRetry={allowRetry} />
  }

  const challengeStep = item.step as ChallengeStep
  const onRequestHint = getAiHint
    ? (wrongComponents: string[]) => getAiHint(item.conic, challengeStep.prompt, wrongComponents)
    : undefined

  switch (item.conic) {
    case 'parabola':
      return (
        <ParabolaChallengeStepView
          step={challengeStep}
          parabola={parabola}
          onParabolaChange={(s) => setParabola(clampParabolaState(s))}
          onSuccess={onSuccess}
          onAttempt={onAttempt}
          onRequestHint={onRequestHint}
          allowRetry={allowRetry}
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
          onRequestHint={onRequestHint}
          allowRetry={allowRetry}
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
          onRequestHint={onRequestHint}
          allowRetry={allowRetry}
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
          onRequestHint={onRequestHint}
          allowRetry={allowRetry}
        />
      )
    case 'unit-circle':
      return (
        <UnitCircleChallengeStepView
          step={challengeStep}
          unitCircle={unitCircle}
          onUnitCircleChange={(s) => setUnitCircle({ angle: clampAngle(s.angle) })}
          onSuccess={onSuccess}
          onAttempt={onAttempt}
          onRequestHint={onRequestHint}
          allowRetry={allowRetry}
        />
      )
    case 'trig-graph':
      return (
        <TrigGraphChallengeStepView
          step={challengeStep}
          graph={trigGraph}
          onGraphChange={(s) => setTrigGraph(clampTrigGraphState(s))}
          onSuccess={onSuccess}
          onAttempt={onAttempt}
          onRequestHint={onRequestHint}
          allowRetry={allowRetry}
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
  getAiHint,
  onComplete,
  onFinish,
  allowRetry = true,
  reviewPassThreshold,
}: ReviewSessionProps) {
  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [attempts, setAttempts] = useState<SessionAttempt[]>([])
  const [pendingAttempt, setPendingAttempt] = useState<{ item: GeneratedItem; result: AttemptResult } | null>(null)
  const attemptedRef = useRef<Set<string>>(new Set())

  const finished = index >= items.length
  const item = finished ? null : items[index]

  // Notify the parent exactly once when the session is completed (e.g. to clear the daily gate).
  const completedRef = useRef(false)
  useEffect(() => {
    if (finished && !completedRef.current) {
      completedRef.current = true
      onComplete?.(correctCount, items.length)
      onFinish?.(correctCount, items.length)
    }
  }, [finished, onComplete, onFinish, correctCount, items.length])

  // Record the pending attempt exactly once (with the chosen confidence, if any) into the
  // session log + struggle stats. Scoring is handled separately at attempt time so it never
  // depends on the learner picking a confidence level.
  const recordPending = (confidence: AttemptResult['confidence']) => {
    if (!pendingAttempt) return
    const { item: it, result } = pendingAttempt
    const recorded: AttemptResult = { ...result, confidence }
    setAttempts((prev) => [
      ...prev,
      { skillId: it.skillId, correct: recorded.correct, weakComponents: recorded.weakComponents },
    ])
    onRecordAttempt(it.skillId, recorded)
    setPendingAttempt(null)
  }

  const goNext = () => {
    // Advancing without choosing a confidence level still records the attempt, so the
    // score and stats are never silently dropped (e.g. clicking Continue straight away).
    recordPending(undefined)
    setIndex((i) => i + 1)
  }

  const handleAttempt = (it: GeneratedItem, result: AttemptResult) => {
    // Score the first attempt per item immediately, independent of the confidence prompt.
    if (!attemptedRef.current.has(it.id)) {
      attemptedRef.current.add(it.id)
      if (result.correct) {
        setCorrectCount((c) => c + 1)
      }
    }
    setPendingAttempt({ item: it, result })
  }

  const handleConfidenceSelect = (confidence: AttemptResult['confidence']) => {
    recordPending(confidence)
  }

  if (finished) {
    // When the parent supplies onFinish it owns the completion UI entirely —
    // return null here so the parent's result screen renders without delay or
    // a conflicting "Retake" button appearing in between.
    if (onFinish) return null

    const topic = tutorTopic ?? 'conic sections'
    const concepts =
      tutorSource === 'practice' && tutorTopic
        ? [tutorTopic]
        : ['circles', 'parabolas', 'ellipses', 'hyperbolas', 'the unit circle', 'trig graphs']

    const passPct = reviewPassThreshold != null ? Math.round(reviewPassThreshold * 100) : null
    const metThreshold =
      reviewPassThreshold == null ||
      (items.length > 0 && correctCount / items.length >= reviewPassThreshold)

    return (
      <>
        <div className="page-card review-summary">
          <h2>{title}</h2>
          <p className="completion-message">
            You got {correctCount} of {items.length} correct. Keep the streak going!
          </p>
          {passPct != null && (
            <p className={`review-gate-note ${metThreshold ? 'review-gate-pass' : 'review-gate-fail'}`}>
              {metThreshold
                ? `Nice — scoring ${passPct}% or higher counts toward unlocking your next lesson.`
                : `You scored below ${passPct}%, so this session won't unlock a new lesson yet. Try again to reach ${passPct}%.`}
            </p>
          )}
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
        getAiHint={getAiHint}
        allowRetry={allowRetry}
      />
      {pendingAttempt && <ConfidencePrompt onSelect={handleConfidenceSelect} />}
    </div>
  )
}
