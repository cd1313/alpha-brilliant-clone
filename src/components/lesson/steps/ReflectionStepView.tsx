import { useState } from 'react'
import { HyperbolaSimulator } from '../../hyperbola/HyperbolaSimulator'
import { clampHyperbolaState, type HyperbolaState } from '../../../lib/hyperbolaGeometry'
import type { AttemptResult } from '../../../lib/feedback'
import type { ReflectionStep } from '../../../types/lesson'

type ReflectionStepViewProps = {
  step: ReflectionStep
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
  /** When false, the first Submit is final — no retries. */
  allowRetry?: boolean
}

export function ReflectionStepView({ step, onSuccess, onAttempt, allowRetry = true }: ReflectionStepViewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [correct, setCorrect] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [refHyperbola, setRefHyperbola] = useState<HyperbolaState | undefined>(
    step.referenceHyperbola,
  )

  const submit = () => {
    if (!selected) return
    const isCorrect = selected === step.correctChoiceId
    setCorrect(isCorrect)
    setFeedback(
      isCorrect
        ? step.feedback
        : step.incorrectFeedback ?? 'Not quite — take another look at the question and try again.',
    )
    onAttempt?.({
      correct: isCorrect,
      weakComponents: !isCorrect && step.weakComponent ? [step.weakComponent] : undefined,
    })
    if (!allowRetry) setAttempted(true)
  }

  const done = correct || (!allowRetry && attempted)

  return (
    <div className="step-view reflection-step">
      <p className="step-prompt">{step.prompt}</p>

      {refHyperbola && (
        <HyperbolaSimulator
          hyperbola={refHyperbola}
          onHyperbolaChange={(next) => setRefHyperbola(clampHyperbolaState(next))}
          interactive
          showFoci={step.hyperbolaConfig?.showFoci ?? true}
          showAsymptotes={step.hyperbolaConfig?.showAsymptotes}
          showBox={step.hyperbolaConfig?.showBox}
          showAxes={step.hyperbolaConfig?.showAxes}
          showEquation={step.hyperbolaConfig?.showEquation}
          highlightVertices={step.hyperbolaConfig?.highlightVertices}
          centerDraggable={step.hyperbolaConfig?.centerDraggable ?? false}
          allowOrientationToggle={step.hyperbolaConfig?.allowOrientationToggle}
        />
      )}

      <div className="choice-list" role="radiogroup">
        {step.choices.map((choice) => (
          <label key={choice.id} className={`choice-item ${selected === choice.id ? 'selected' : ''}`}>
            <input
              type="radio"
              name="reflection"
              value={choice.id}
              checked={selected === choice.id}
              onChange={() => setSelected(choice.id)}
              disabled={done}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>

      {feedback && (
        <p className={`feedback ${correct ? 'feedback-correct' : 'feedback-incorrect'}`}>
          {feedback}
        </p>
      )}

      <div className="step-actions">
        {!done ? (
          <button type="button" className="btn btn-primary" disabled={!selected} onClick={submit}>
            Submit
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onSuccess}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
