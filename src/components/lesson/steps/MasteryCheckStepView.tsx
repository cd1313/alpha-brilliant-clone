import { useState } from 'react'
import { ConeSimulator } from '../../cone/ConeSimulator'
import { classifyConic, conicLabel, type PlaneState } from '../../../lib/conicClassifier'
import type { MasteryCheckStep } from '../../../types/lesson'

type MasteryCheckStepViewProps = {
  step: MasteryCheckStep
  plane: PlaneState
  onPlaneChange: (plane: PlaneState) => void
  masteryIndex: number
  onMasteryIndexChange: (index: number) => void
  onComplete: () => void
}

export function MasteryCheckStepView({
  step,
  plane,
  onPlaneChange,
  masteryIndex,
  onMasteryIndexChange,
  onComplete,
}: MasteryCheckStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [lastCheckCorrect, setLastCheckCorrect] = useState<boolean | null>(null)
  const target = step.sequence[masteryIndex]
  const finished = masteryIndex >= step.sequence.length

  const checkShape = () => {
    const current = classifyConic(plane.angle, plane.offset)
    if (current === target) {
      const next = masteryIndex + 1
      onMasteryIndexChange(next)
      setLastCheckCorrect(true)
      setFeedback(`Correct! That was a ${conicLabel(target)}.`)
      if (next >= step.sequence.length) {
        setTimeout(() => onComplete(), 600)
      }
    } else {
      setLastCheckCorrect(false)
      setFeedback(`Keep adjusting — create a ${conicLabel(target)}.`)
    }
  }

  if (finished) {
    return (
      <div className="step-view mastery-step">
        <p className="completion-message">{step.completionMessage}</p>
        <button type="button" className="btn btn-primary" onClick={onComplete}>
          Finish Lesson
        </button>
      </div>
    )
  }

  return (
    <div className="step-view mastery-step">
      <h2>Mastery Check</h2>
      <p className="step-prompt">
        Create a {conicLabel(target)} ({masteryIndex + 1} of {step.sequence.length})
      </p>

      <ConeSimulator
        plane={plane}
        onPlaneChange={onPlaneChange}
        interactive
        hideShapeLabel={step.hideLabels}
      />

      {feedback && (
        <p
          className={`feedback ${lastCheckCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}
        >
          {feedback}
        </p>
      )}

      <button type="button" className="btn btn-primary" onClick={checkShape}>
        Check Shape
      </button>
    </div>
  )
}
