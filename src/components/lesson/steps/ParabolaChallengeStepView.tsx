import { useState } from 'react'
import { ParabolaSimulator } from '../../parabola/ParabolaSimulator'
import {
  matchesParabolaChallengeTarget,
  type ParabolaState,
} from '../../../lib/parabolaGeometry'
import type { ChallengeStep, ParabolaChallengeTarget } from '../../../types/lesson'

type ParabolaChallengeStepViewProps = {
  step: ChallengeStep
  parabola: ParabolaState
  onParabolaChange: (parabola: ParabolaState) => void
  onSuccess: () => void
}

function ghostFromTarget(
  target: ParabolaChallengeTarget | undefined,
): ParabolaState | null {
  if (!target) return null
  switch (target.kind) {
    case 'focus':
      return {
        focusX: target.focusX,
        focusY: target.focusY,
        directrixY: 2 * target.vertexY - target.focusY,
      }
    case 'vertex':
      return {
        focusX: target.x,
        focusY: target.y + 2,
        directrixY: target.y - 2,
      }
    case 'narrow':
      return {
        focusX: target.vertexX,
        focusY: target.vertexY + 1,
        directrixY: target.vertexY - 1,
      }
  }
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
        vertexDraggable={false}
        showEquation={config.showEquation ?? true}
        showParameterP={config.showParameterP ?? true}
        highlightVertex={config.highlightVertex}
        focusVerticalOnly={config.focusVerticalOnly === true}
        vertexAtOrigin={config.vertexAtOrigin === true}
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
