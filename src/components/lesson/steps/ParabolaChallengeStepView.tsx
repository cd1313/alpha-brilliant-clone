import { useState } from 'react'
import { ParabolaSimulator } from '../../parabola/ParabolaSimulator'
import {
  matchesParabolaChallengeTarget,
  type ParabolaState,
} from '../../../lib/parabolaGeometry'
import type { ChallengeStep } from '../../../types/lesson'

type ParabolaChallengeStepViewProps = {
  step: ChallengeStep
  parabola: ParabolaState
  onParabolaChange: (parabola: ParabolaState) => void
  onSuccess: () => void
}

export function ParabolaChallengeStepView({
  step,
  parabola,
  onParabolaChange,
  onSuccess,
}: ParabolaChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const target = step.parabolaTarget
  const config = step.parabolaConfig ?? {}
  const vertexDraggable = config.vertexDraggable ?? target?.kind === 'vertex'

  const checkAnswer = () => {
    if (!target) return

    if (matchesParabolaChallengeTarget(parabola, target)) {
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

      <ParabolaSimulator
        parabola={parabola}
        onParabolaChange={onParabolaChange}
        interactive
        vertexDraggable={vertexDraggable}
        showEquation={config.showEquation ?? true}
        showParameterP={config.showParameterP ?? true}
        highlightVertex={config.highlightVertex}
        focusVerticalOnly={config.focusVerticalOnly}
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
