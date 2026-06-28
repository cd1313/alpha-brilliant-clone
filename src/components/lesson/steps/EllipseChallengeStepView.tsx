import { useState } from 'react'
import { useAiEnabled } from '../../../hooks/useAiEnabled'
import { EllipseSimulator } from '../../ellipse/EllipseSimulator'
import { matchesEllipseChallengeTarget, type EllipseState } from '../../../lib/ellipseGeometry'
import {
  adaptiveMismatchMessage,
  axisDirection,
  scalarDirection,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
  type HintDetail,
} from '../../../lib/feedback'
import type { ChallengeStep, EllipseChallengeTarget } from '../../../types/lesson'

function ghostFromTarget(target: EllipseChallengeTarget | undefined): EllipseState | null {
  if (!target) return null
  return { centerX: target.centerX, centerY: target.centerY, a: target.a, b: target.b }
}

type EllipseChallengeStepViewProps = {
  step: ChallengeStep
  ellipse: EllipseState
  onEllipseChange: (ellipse: EllipseState) => void
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
  onRequestHint?: (wrongComponents: string[], details: HintDetail[], hintIndex: number) => Promise<string | null>
  /** When false, the first Check attempt is final — no retries, no hints. */
  allowRetry?: boolean
}

export function EllipseChallengeStepView({
  step,
  ellipse,
  onEllipseChange,
  onSuccess,
  onAttempt,
  onRequestHint,
  allowRetry = true,
}: EllipseChallengeStepViewProps) {
  const aiEnabled = useAiEnabled()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const [hintCount, setHintCount] = useState(0)
  const [usingAiHint, setUsingAiHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const target = step.ellipseTarget
  const config = step.ellipseConfig ?? {}

  const computeParts = (t: EllipseChallengeTarget): FeedbackPart[] => {
    const tol = t.tolerance ?? 0.35
    const centerOk =
      Math.abs(ellipse.centerX - t.centerX) <= tol && Math.abs(ellipse.centerY - t.centerY) <= tol
    return [
      { label: 'center', ok: centerOk },
      { label: 'a', ok: Math.abs(ellipse.a - t.a) <= tol },
      { label: 'b', ok: Math.abs(ellipse.b - t.b) <= tol },
    ]
  }

  const computeHintDetails = (t: EllipseChallengeTarget): HintDetail[] => {
    const tol = t.tolerance ?? 0.35
    const details: HintDetail[] = []

    if (Math.abs(ellipse.centerX - t.centerX) > tol) {
      details.push({ component: 'center', direction: axisDirection(ellipse.centerX, t.centerX, 'x') })
    }
    if (Math.abs(ellipse.centerY - t.centerY) > tol) {
      details.push({ component: 'center', direction: axisDirection(ellipse.centerY, t.centerY, 'y') })
    }
    if (Math.abs(ellipse.a - t.a) > tol) {
      details.push({ component: 'a', direction: scalarDirection(ellipse.a, t.a) })
    }
    if (Math.abs(ellipse.b - t.b) > tol) {
      details.push({ component: 'b', direction: scalarDirection(ellipse.b, t.b) })
    }

    return details
  }

  const checkAnswer = () => {
    if (!target) return

    if (matchesEllipseChallengeTarget(ellipse, target)) {
      setFeedback(step.feedback.correct)
      setSolved(true)
      onAttempt?.({ correct: true })
    } else {
      const parts = computeParts(target)
      setFeedback(adaptiveMismatchMessage(parts, step.feedback.incorrect))
      setSolved(false)
      onAttempt?.({ correct: false, weakComponents: weakComponentsOf(parts) })
    }
    if (!allowRetry) setAttempted(true)
  }

  const done = solved || (!allowRetry && attempted)

  return (
    <div className="step-view challenge-step">
      <p className="step-prompt">{step.prompt}</p>

      <EllipseSimulator
        ellipse={ellipse}
        onEllipseChange={onEllipseChange}
        interactive
        highlightCenter={config.highlightCenter}
        showAxes={config.showAxes ?? true}
        showEquation={config.showEquation ?? true}
        centerDraggable={config.centerDraggable ?? true}
        targetPoint={config.targetPoint}
        ghost={showHint ? ghostFromTarget(target) : null}
      />

      {feedback && (
        <p className={`feedback ${solved ? 'feedback-correct' : 'feedback-incorrect'}`}>
          {feedback}
        </p>
      )}

      {showHint && (
        <>
          <p className="hint-text">{activeHint ?? step.feedback.hint}</p>
          {usingAiHint && aiEnabled && (
            <button
              type="button"
              className="hint-fallback-link"
              onClick={() => {
                setActiveHint(step.feedback.hint)
                setUsingAiHint(false)
              }}
            >
              Not helpful? See the simpler hint
            </button>
          )}
        </>
      )}

      {step.miniReflection && solved && (
        <p className="mini-reflection">{step.miniReflection}</p>
      )}

      <div className="step-actions">
        {!done && (
          <>
            {allowRetry && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={hintLoading}
                onClick={async () => {
                  const nextIndex = hintCount + 1
                  setHintCount(nextIndex)
                  if (aiEnabled && onRequestHint && target) {
                    setHintLoading(true)
                    const wrong = weakComponentsOf(computeParts(target))
                    const aiHint = await onRequestHint(wrong, computeHintDetails(target), nextIndex)
                    if (aiHint) {
                      setActiveHint(aiHint)
                      setUsingAiHint(true)
                    } else {
                      setActiveHint(step.feedback.hint)
                      setUsingAiHint(false)
                    }
                    setHintLoading(false)
                  } else {
                    setActiveHint(step.feedback.hint)
                    setUsingAiHint(false)
                  }
                  setShowHint(true)
                }}
              >
                {hintLoading ? 'Loading hint…' : (aiEnabled && hintCount > 0) ? 'Another Hint' : 'Hint'}
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={checkAnswer}>
              Check
            </button>
          </>
        )}
        {done && (
          <button type="button" className="btn btn-primary" onClick={onSuccess}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
