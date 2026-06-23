import { useState } from 'react'
import { ConeSimulator } from '../../cone/ConeSimulator'
import { matchesTarget, type PlaneState } from '../../../lib/conicClassifier'
import type { ChallengeStep } from '../../../types/lesson'

type ChallengeStepViewProps = {
  step: ChallengeStep
  plane: PlaneState
  onPlaneChange: (plane: PlaneState) => void
  onSuccess: () => void
}

export function ChallengeStepView({
  step,
  plane,
  onPlaneChange,
  onSuccess,
}: ChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(false)

  const checkAnswer = () => {
    if (matchesTarget(plane.angle, plane.offset, step.targetConic)) {
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

      <ConeSimulator
        plane={plane}
        onPlaneChange={onPlaneChange}
        interactive
        highlightConeEdge={step.visualCue === 'highlightConeEdge'}
        glowConic={solved && step.visualReward === 'glow' ? step.targetConic : null}
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
