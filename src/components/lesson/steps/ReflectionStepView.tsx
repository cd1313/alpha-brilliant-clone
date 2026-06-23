import { useState } from 'react'
import type { ReflectionStep } from '../../../types/lesson'

type ReflectionStepViewProps = {
  step: ReflectionStep
  onSuccess: () => void
}

export function ReflectionStepView({ step, onSuccess }: ReflectionStepViewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [correct, setCorrect] = useState(false)

  const submit = () => {
    if (!selected) return
    const isCorrect = selected === step.correctChoiceId
    setCorrect(isCorrect)
    setFeedback(isCorrect ? step.feedback : 'Not quite. Think about what you changed during exploration.')
  }

  return (
    <div className="step-view reflection-step">
      <p className="step-prompt">{step.prompt}</p>

      <div className="choice-list" role="radiogroup">
        {step.choices.map((choice) => (
          <label key={choice.id} className={`choice-item ${selected === choice.id ? 'selected' : ''}`}>
            <input
              type="radio"
              name="reflection"
              value={choice.id}
              checked={selected === choice.id}
              onChange={() => setSelected(choice.id)}
              disabled={correct}
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
        {!correct ? (
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
