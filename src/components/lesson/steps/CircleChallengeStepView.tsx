import { useState } from 'react'
import { useAiEnabled } from '../../../hooks/useAiEnabled'
import { CircleSimulator } from '../../circle/CircleSimulator'
import { matchesCircleChallengeTarget, type CircleState } from '../../../lib/circleGeometry'
import {
  adaptiveMismatchMessage,
  axisDirection,
  scalarDirection,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
  type HintDetail,
} from '../../../lib/feedback'
import type { ChallengeStep, CircleChallengeTarget } from '../../../types/lesson'

type CircleChallengeStepViewProps = {
  step: ChallengeStep
  circle: CircleState
  onCircleChange: (circle: CircleState) => void
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
  onRequestHint?: (wrongComponents: string[], details: HintDetail[], hintIndex: number) => Promise<string | null>
  /** When false, the first Check attempt is final — no retries, no hints. */
  allowRetry?: boolean
}

function deriveGhost(target: CircleChallengeTarget | undefined): CircleState | null {
  if (!target) return null
  switch (target.kind) {
    case 'radius':
      return { centerX: target.centerX, centerY: target.centerY, radius: target.radius }
    case 'center':
      return { centerX: target.x, centerY: target.y, radius: 3 }
    case 'small':
      return { centerX: target.centerX, centerY: target.centerY, radius: target.maxR ?? 1.5 }
  }
}

export function CircleChallengeStepView({
  step,
  circle,
  onCircleChange,
  onSuccess,
  onAttempt,
  onRequestHint,
  allowRetry = true,
}: CircleChallengeStepViewProps) {
  const aiEnabled = useAiEnabled()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const [hintCount, setHintCount] = useState(0)
  const [usingAiHint, setUsingAiHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const target = step.circleTarget
  const config = step.circleConfig ?? {}

  const computeParts = (t: CircleChallengeTarget): FeedbackPart[] => {
    const tol = t.tolerance ?? 0.35
    if (t.kind === 'center') {
      const centerOk =
        Math.abs(circle.centerX - t.x) <= tol && Math.abs(circle.centerY - t.y) <= tol
      return [{ label: 'center', ok: centerOk }]
    }

    const centerOk =
      Math.abs(circle.centerX - t.centerX) <= tol && Math.abs(circle.centerY - t.centerY) <= tol
    const radiusOk =
      t.kind === 'small'
        ? circle.radius <= (t.maxR ?? 2) + tol
        : Math.abs(circle.radius - t.radius) <= tol

    return [
      { label: 'center', ok: centerOk },
      { label: 'radius', ok: radiusOk },
    ]
  }

  const computeHintDetails = (t: CircleChallengeTarget): HintDetail[] => {
    const tol = t.tolerance ?? 0.35
    const details: HintDetail[] = []

    if (t.kind === 'center') {
      if (Math.abs(circle.centerX - t.x) > tol) {
        details.push({ component: 'center', direction: axisDirection(circle.centerX, t.x, 'x') })
      }
      if (Math.abs(circle.centerY - t.y) > tol) {
        details.push({ component: 'center', direction: axisDirection(circle.centerY, t.y, 'y') })
      }
      return details
    }

    if (Math.abs(circle.centerX - t.centerX) > tol) {
      details.push({ component: 'center', direction: axisDirection(circle.centerX, t.centerX, 'x') })
    }
    if (Math.abs(circle.centerY - t.centerY) > tol) {
      details.push({ component: 'center', direction: axisDirection(circle.centerY, t.centerY, 'y') })
    }

    if (t.kind === 'small') {
      const maxR = t.maxR ?? 2
      if (circle.radius > maxR + tol) {
        details.push({ component: 'radius', direction: scalarDirection(circle.radius, maxR) })
      }
    } else if (Math.abs(circle.radius - t.radius) > tol) {
      details.push({ component: 'radius', direction: scalarDirection(circle.radius, t.radius) })
    }

    return details
  }

  const checkAnswer = () => {
    if (!target) return

    if (matchesCircleChallengeTarget(circle, target)) {
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

      <CircleSimulator
        circle={circle}
        onCircleChange={onCircleChange}
        interactive
        highlightCenter={config.highlightCenter}
        showRadius={config.showRadius ?? true}
        showEquation={config.showEquation ?? true}
        centerDraggable={config.centerDraggable ?? target?.kind !== 'radius'}
        targetPoint={config.targetPoint}
        ghost={showHint ? deriveGhost(target) : null}
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
