import { useState } from 'react'
import { ParabolaSimulator } from '../../parabola/ParabolaSimulator'
import {
  matchesParabolaMasteryTarget,
  type ParabolaState,
} from '../../../lib/parabolaGeometry'
import type { MasteryCheckStep } from '../../../types/lesson'

type ParabolaMasteryCheckStepViewProps = {
  step: MasteryCheckStep
  parabola: ParabolaState
  onParabolaChange: (parabola: ParabolaState) => void
  masteryIndex: number
  onMasteryIndexChange: (index: number) => void
  onComplete: () => void
}

function MasteryProgressList({
  sequence,
  masteryIndex,
}: {
  sequence: NonNullable<MasteryCheckStep['parabolaSequence']>
  masteryIndex: number
}) {
  return (
    <ol className="mastery-progress-list">
      {sequence.map((target, index) => {
        const done = index < masteryIndex
        const current = index === masteryIndex
        return (
          <li
            key={target.id}
            className={`mastery-progress-item ${done ? 'done' : ''} ${current ? 'current' : ''}`}
          >
            <span className="mastery-progress-marker">{done ? '✓' : index + 1}</span>
            <span>{target.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function ParabolaMasteryCheckStepView({
  step,
  parabola,
  onParabolaChange,
  masteryIndex,
  onMasteryIndexChange,
  onComplete,
}: ParabolaMasteryCheckStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [lastCheckCorrect, setLastCheckCorrect] = useState<boolean | null>(null)
  const [verified, setVerified] = useState(false)

  const sequence = step.parabolaSequence ?? []
  const finished = masteryIndex >= sequence.length
  const target = finished ? null : sequence[masteryIndex]

  const checkShape = () => {
    if (!target) return

    if (matchesParabolaMasteryTarget(parabola, target)) {
      setLastCheckCorrect(true)
      setVerified(true)
      setFeedback(`Correct! ${target.label} achieved.`)
    } else {
      setLastCheckCorrect(false)
      setVerified(false)
      setFeedback(`Not quite — adjust the focus, directrix, or vertex until you match the task.`)
    }
  }

  const advance = () => {
    setVerified(false)
    setFeedback(null)
    setLastCheckCorrect(null)
    onMasteryIndexChange(masteryIndex + 1)
  }

  if (finished) {
    return (
      <div className="step-view mastery-step">
        <MasteryProgressList sequence={sequence} masteryIndex={masteryIndex} />
        <p className="completion-message">{step.completionMessage}</p>
        <button type="button" className="btn btn-primary" onClick={onComplete}>
          Finish Lesson
        </button>
      </div>
    )
  }

  return (
    <div className="step-view mastery-step">
      <MasteryProgressList sequence={sequence} masteryIndex={masteryIndex} />

      <p className="step-prompt">
        Create: <strong>{target!.label}</strong> — no hints shown.
      </p>

      <ParabolaSimulator
        parabola={parabola}
        onParabolaChange={onParabolaChange}
        interactive
        vertexDraggable
        hideLabels={step.hideLabels}
        showEquation
      />

      {feedback && (
        <p
          className={`feedback ${lastCheckCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}
        >
          {feedback}
        </p>
      )}

      <div className="step-actions">
        {verified ? (
          <button type="button" className="btn btn-primary" onClick={advance}>
            Continue
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={checkShape}>
            Check Parabola
          </button>
        )}
      </div>
    </div>
  )
}
