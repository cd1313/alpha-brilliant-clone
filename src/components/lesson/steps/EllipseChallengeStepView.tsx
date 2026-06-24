import { useState } from 'react'
import { EllipseSimulator } from '../../ellipse/EllipseSimulator'
import { matchesEllipseChallengeTarget, type EllipseState } from '../../../lib/ellipseGeometry'
import type { ChallengeStep } from '../../../types/lesson'

type EllipseChallengeStepViewProps = {
  step: ChallengeStep
  ellipse: EllipseState
  onEllipseChange: (ellipse: EllipseState) => void
  onSuccess: () => void
}

export function EllipseChallengeStepView({
  step,
  ellipse,
  onEllipseChange,
  onSuccess,
}: EllipseChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const target = step.ellipseTarget
  const config = step.ellipseConfig ?? {}

  const checkAnswer = () => {
    if (!target) return

    if (matchesEllipseChallengeTarget(ellipse, target)) {
      setFeedback(step.feedback.correct)
      setSolved(true)
    } else {
      setFeedback(step.feedback.incorrect)
      setSolved(false)
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
            <button type="button" className="btn btn-secondary" onClick={() => setShowHint(true)}>
              Hint
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
