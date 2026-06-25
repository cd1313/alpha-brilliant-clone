import { useState } from 'react'
import { HyperbolaSimulator } from '../../hyperbola/HyperbolaSimulator'
import { matchesHyperbolaChallengeTarget, type HyperbolaState } from '../../../lib/hyperbolaGeometry'
import { adaptiveMismatchMessage } from '../../../lib/feedback'
import type { ChallengeStep, HyperbolaChallengeTarget } from '../../../types/lesson'

type HyperbolaChallengeStepViewProps = {
  step: ChallengeStep
  hyperbola: HyperbolaState
  onHyperbolaChange: (hyperbola: HyperbolaState) => void
  onSuccess: () => void
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
}: HyperbolaChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const target = step.hyperbolaTarget
  const config = step.hyperbolaConfig ?? {}

  const buildIncorrectFeedback = (t: HyperbolaChallengeTarget): string => {
    const tol = t.tolerance ?? 0.35
    const centerOk =
      Math.abs(hyperbola.centerX - t.centerX) <= tol &&
      Math.abs(hyperbola.centerY - t.centerY) <= tol
    return adaptiveMismatchMessage(
      [
        { label: 'opening direction', ok: hyperbola.orientation === t.orientation },
        { label: 'center', ok: centerOk },
        { label: 'a', ok: Math.abs(hyperbola.a - t.a) <= tol },
        { label: 'b', ok: Math.abs(hyperbola.b - t.b) <= tol },
      ],
      step.feedback.incorrect,
    )
  }

  const checkAnswer = () => {
    if (!target) return

    if (matchesHyperbolaChallengeTarget(hyperbola, target)) {
      setFeedback(step.feedback.correct)
      setSolved(true)
    } else {
      setFeedback(buildIncorrectFeedback(target))
      setSolved(false)
    }
  }

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
