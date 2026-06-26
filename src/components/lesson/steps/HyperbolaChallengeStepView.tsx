import { useState } from 'react'
import { HyperbolaSimulator } from '../../hyperbola/HyperbolaSimulator'
import { matchesHyperbolaChallengeTarget, type HyperbolaState } from '../../../lib/hyperbolaGeometry'
import {
  adaptiveMismatchMessage,
  axisDirection,
  scalarDirection,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
  type HintDetail,
} from '../../../lib/feedback'
import type { ChallengeStep, HyperbolaChallengeTarget } from '../../../types/lesson'

type HyperbolaChallengeStepViewProps = {
  step: ChallengeStep
  hyperbola: HyperbolaState
  onHyperbolaChange: (hyperbola: HyperbolaState) => void
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
  onRequestHint?: (wrongComponents: string[], details: HintDetail[]) => Promise<string | null>
  /** When false, the first Check attempt is final — no retries, no hints. */
  allowRetry?: boolean
}

function deriveGhostHyperbola(target: HyperbolaChallengeTarget | undefined): HyperbolaState | null {
  if (!target) return null
  if (target.kind === 'axes') {
    return {
      centerX: target.centerX,
      centerY: target.centerY,
      a: target.a,
      b: target.b,
      orientation: target.orientation,
    }
  }
  return null
}

export function HyperbolaChallengeStepView({
  step,
  hyperbola,
  onHyperbolaChange,
  onSuccess,
  onAttempt,
  onRequestHint,
  allowRetry = true,
}: HyperbolaChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const target = step.hyperbolaTarget
  const config = step.hyperbolaConfig ?? {}

  const computeParts = (t: HyperbolaChallengeTarget): FeedbackPart[] => {
    const tol = t.tolerance ?? 0.35
    const centerOk =
      Math.abs(hyperbola.centerX - t.centerX) <= tol &&
      Math.abs(hyperbola.centerY - t.centerY) <= tol
    return [
      { label: 'opening direction', ok: hyperbola.orientation === t.orientation },
      { label: 'center', ok: centerOk },
      { label: 'a', ok: Math.abs(hyperbola.a - t.a) <= tol },
      { label: 'b', ok: Math.abs(hyperbola.b - t.b) <= tol },
    ]
  }

  const computeHintDetails = (t: HyperbolaChallengeTarget): HintDetail[] => {
    const tol = t.tolerance ?? 0.35
    const details: HintDetail[] = []

    if (hyperbola.orientation !== t.orientation) {
      details.push({ component: 'opening direction', direction: 'opens the wrong way' })
    }
    if (Math.abs(hyperbola.centerX - t.centerX) > tol) {
      details.push({
        component: 'center',
        direction: axisDirection(hyperbola.centerX, t.centerX, 'x'),
      })
    }
    if (Math.abs(hyperbola.centerY - t.centerY) > tol) {
      details.push({
        component: 'center',
        direction: axisDirection(hyperbola.centerY, t.centerY, 'y'),
      })
    }
    if (Math.abs(hyperbola.a - t.a) > tol) {
      details.push({ component: 'a', direction: scalarDirection(hyperbola.a, t.a) })
    }
    if (Math.abs(hyperbola.b - t.b) > tol) {
      details.push({ component: 'b', direction: scalarDirection(hyperbola.b, t.b) })
    }

    return details
  }

  const checkAnswer = () => {
    if (!target) return

    if (matchesHyperbolaChallengeTarget(hyperbola, target)) {
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

      <HyperbolaSimulator
        hyperbola={hyperbola}
        onHyperbolaChange={onHyperbolaChange}
        ghost={showHint ? deriveGhostHyperbola(target) : null}
        interactive
        highlightVertices={config.highlightVertices}
        showAsymptotes={config.showAsymptotes ?? true}
        showBox={config.showBox}
        showAxes={config.showAxes ?? true}
        showEquation={config.showEquation ?? true}
        centerDraggable={config.centerDraggable ?? true}
        allowOrientationToggle={config.allowOrientationToggle}
      />

      {feedback && (
        <p className={`feedback ${solved ? 'feedback-correct' : 'feedback-incorrect'}`}>
          {feedback}
        </p>
      )}

      {showHint && <p className="hint-text">{activeHint ?? step.feedback.hint}</p>}

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
                  if (showHint) { setShowHint(false); return }
                  if (onRequestHint && target) {
                    setHintLoading(true)
                    const wrong = weakComponentsOf(computeParts(target))
                    const aiHint = await onRequestHint(wrong, computeHintDetails(target))
                    setActiveHint(aiHint ?? step.feedback.hint)
                    setHintLoading(false)
                  } else {
                    setActiveHint(step.feedback.hint)
                  }
                  setShowHint(true)
                }}
              >
                {hintLoading ? 'Loading hint…' : showHint ? 'Hide Hint' : 'Hint'}
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
