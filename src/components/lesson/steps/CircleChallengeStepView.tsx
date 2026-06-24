import { useState } from 'react'
import { CircleSimulator } from '../../circle/CircleSimulator'
import { matchesCircleChallengeTarget, type CircleState } from '../../../lib/circleGeometry'
import type { ChallengeStep, CircleChallengeTarget } from '../../../types/lesson'

type CircleChallengeStepViewProps = {
  step: ChallengeStep
  circle: CircleState
  onCircleChange: (circle: CircleState) => void
  onSuccess: () => void
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
}: CircleChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const target = step.circleTarget
  const config = step.circleConfig ?? {}

  const checkAnswer = () => {
    if (!target) return

    if (matchesCircleChallengeTarget(circle, target)) {
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
