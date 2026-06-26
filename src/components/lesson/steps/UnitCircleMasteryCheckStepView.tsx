import { useState } from 'react'
import { UnitCircleSimulator } from '../../trig/UnitCircleSimulator'
import {
  matchesUnitCircleMasteryTarget,
  type UnitCircleState,
} from '../../../lib/unitCircleGeometry'
import type { MasteryCheckStep } from '../../../types/lesson'

type UnitCircleMasteryCheckStepViewProps = {
  step: MasteryCheckStep
  unitCircle: UnitCircleState
  onUnitCircleChange: (next: UnitCircleState) => void
  masteryIndex: number
  onMasteryIndexChange: (index: number) => void
  onComplete: () => void
}

function MasteryProgressList({
  sequence,
  masteryIndex,
}: {
  sequence: NonNullable<MasteryCheckStep['unitCircleSequence']>
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

export function UnitCircleMasteryCheckStepView({
  step,
  unitCircle,
  onUnitCircleChange,
  masteryIndex,
  onMasteryIndexChange,
  onComplete,
}: UnitCircleMasteryCheckStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [lastCheckCorrect, setLastCheckCorrect] = useState<boolean | null>(null)
  const [verified, setVerified] = useState(false)

  const sequence = step.unitCircleSequence ?? []
  const finished = masteryIndex >= sequence.length
  const target = finished ? null : sequence[masteryIndex]

  const check = () => {
    if (!target) return
    if (matchesUnitCircleMasteryTarget(unitCircle, target)) {
      setLastCheckCorrect(true)
      setVerified(true)
      setFeedback(`Correct! ${target.label} achieved.`)
    } else {
      setLastCheckCorrect(false)
      setVerified(false)
      setFeedback('Not quite — drag the terminal point until you match the task.')
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

      <UnitCircleSimulator
        unitCircle={unitCircle}
        onUnitCircleChange={onUnitCircleChange}
        interactive
        showCoordinates
        showAngle
        snapSpecial
        hideLabels={step.hideLabels}
      />

      {feedback && (
        <p className={`feedback ${lastCheckCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
          {feedback}
        </p>
      )}

      <div className="step-actions">
        {verified ? (
          <button type="button" className="btn btn-primary" onClick={advance}>
            Continue
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={check}>
            Check Angle
          </button>
        )}
      </div>
    </div>
  )
}
