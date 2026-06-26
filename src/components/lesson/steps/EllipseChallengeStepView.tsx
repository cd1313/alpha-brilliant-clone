import { useState } from 'react'
import { EllipseSimulator } from '../../ellipse/EllipseSimulator'
import { matchesEllipseChallengeTarget, type EllipseState } from '../../../lib/ellipseGeometry'
import {
  adaptiveMismatchMessage,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
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
}

export function EllipseChallengeStepView({
  step,
  ellipse,
  onEllipseChange,
  onSuccess,
  onAttempt,
}: EllipseChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(false)
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
  }

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

      {showHint && <p className="hint-text">{step.feedback.hint}</p>}

      {step.miniReflection && solved && (
        <p className="mini-reflection">{step.miniReflection}</p>
      )}

      <div className="step-actions">
        {!solved && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setShowHint((show) => !show)}>
              {showHint ? 'Hide Hint' : 'Hint'}
            </button>
            <button type="button" className="btn btn-primary" onClick={checkAnswer}>
              Check
            </button>
          </>
        )}
        {solved && (
          <button type="button" className="btn btn-primary" onClick={onSuccess}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
