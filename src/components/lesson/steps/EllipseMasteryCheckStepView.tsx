import { useState } from 'react'
import { EllipseSimulator } from '../../ellipse/EllipseSimulator'
import { matchesEllipseMasteryTarget, type EllipseState } from '../../../lib/ellipseGeometry'
import type { MasteryCheckStep } from '../../../types/lesson'

type EllipseMasteryCheckStepViewProps = {
  step: MasteryCheckStep
  ellipse: EllipseState
  onEllipseChange: (ellipse: EllipseState) => void
  masteryIndex: number
  onMasteryIndexChange: (index: number) => void
  onComplete: () => void
}

function MasteryProgressList({
  sequence,
  masteryIndex,
}: {
  sequence: NonNullable<MasteryCheckStep['ellipseSequence']>
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

export function EllipseMasteryCheckStepView({
  step,
  ellipse,
  onEllipseChange,
  masteryIndex,
  onMasteryIndexChange,
  onComplete,
}: EllipseMasteryCheckStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [lastCheckCorrect, setLastCheckCorrect] = useState<boolean | null>(null)
  const [verified, setVerified] = useState(false)

  const sequence = step.ellipseSequence ?? []
  const finished = masteryIndex >= sequence.length
  const target = finished ? null : sequence[masteryIndex]

  const checkShape = () => {
    if (!target) return

    if (matchesEllipseMasteryTarget(ellipse, target)) {
      setLastCheckCorrect(true)
      setVerified(true)
      setFeedback(`Correct! ${target.label} achieved.`)
    } else {
      setLastCheckCorrect(false)
      setVerified(false)
      setFeedback('Not quite — adjust the center or the a/b handles until you match the task.')
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

      <EllipseSimulator
        ellipse={ellipse}
        onEllipseChange={onEllipseChange}
        interactive
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
            Check Ellipse
          </button>
        )}
      </div>
    </div>
  )
}
