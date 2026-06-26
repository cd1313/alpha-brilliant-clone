import { useEffect, useState } from 'react'
import { TrigGraphSimulator } from '../../trig/TrigGraphSimulator'
import {
  DEFAULT_TRIG_GRAPH,
  matchesTrigGraphMasteryTarget,
  type TrigGraphState,
} from '../../../lib/trigGraphGeometry'
import type { MasteryCheckStep } from '../../../types/lesson'

type TrigGraphMasteryCheckStepViewProps = {
  step: MasteryCheckStep
  graph: TrigGraphState
  onGraphChange: (next: TrigGraphState) => void
  masteryIndex: number
  onMasteryIndexChange: (index: number) => void
  onComplete: () => void
}

function MasteryProgressList({
  sequence,
  masteryIndex,
}: {
  sequence: NonNullable<MasteryCheckStep['trigGraphSequence']>
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

export function TrigGraphMasteryCheckStepView({
  step,
  graph,
  onGraphChange,
  masteryIndex,
  onMasteryIndexChange,
  onComplete,
}: TrigGraphMasteryCheckStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [lastCheckCorrect, setLastCheckCorrect] = useState<boolean | null>(null)
  const [verified, setVerified] = useState(false)

  const sequence = step.trigGraphSequence ?? []
  const finished = masteryIndex >= sequence.length
  const target = finished ? null : sequence[masteryIndex]
  const targetFn = target?.fn ?? 'sin'

  useEffect(() => {
    if (!finished) {
      onGraphChange({ ...DEFAULT_TRIG_GRAPH, fn: targetFn })
    }
    // Reset to a clean graph for each new mastery task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masteryIndex])

  const check = () => {
    if (!target) return
    if (matchesTrigGraphMasteryTarget(graph, target)) {
      setLastCheckCorrect(true)
      setVerified(true)
      setFeedback(`Correct! ${target.label} achieved.`)
    } else {
      setLastCheckCorrect(false)
      setVerified(false)
      setFeedback('Not quite — adjust the handles until the graph matches the task.')
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

      <TrigGraphSimulator
        graph={graph}
        onGraphChange={onGraphChange}
        interactive
        showEquation
        showMidline
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
            Check Graph
          </button>
        )}
      </div>
    </div>
  )
}
