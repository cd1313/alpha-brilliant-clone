import { useState } from 'react'
import { ConeSimulator } from '../../cone/ConeSimulator'
import { classifyConic, type PlaneState } from '../../../lib/conicClassifier'
import type { ConicType, ExploreStep } from '../../../types/lesson'

type ExploreStepViewProps = {
  step: ExploreStep
  plane: PlaneState
  onPlaneChange: (plane: PlaneState) => void
  distinctConicsSeen: Set<ConicType>
  onContinue: () => void
}

export function ExploreStepView({
  step,
  plane,
  onPlaneChange,
  distinctConicsSeen,
  onContinue,
}: ExploreStepViewProps) {
  const [hintIndex, setHintIndex] = useState(0)

  const currentConic = classifyConic(plane.angle, plane.offset)
  const validConics = [...distinctConicsSeen, currentConic].filter(
    (c) => c !== 'none',
  )
  const distinctValid = new Set(validConics).size

  const canContinue =
    step.successCondition === 'continue' ||
    ('minDistinctConics' in step.successCondition &&
      distinctValid >= step.successCondition.minDistinctConics)

  return (
    <div className="step-view explore-step">
      {step.introText && <p className="intro-text">{step.introText}</p>}
      <p className="step-prompt">{step.prompt}</p>

      <ConeSimulator
        plane={plane}
        onPlaneChange={onPlaneChange}
        interactive={step.interactive ?? true}
        showLabels={step.showLabels}
      />

      {step.hints && step.hints.length > 0 && (
        <div className="hint-box">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setHintIndex((i) => Math.min(i + 1, step.hints!.length - 1))}
          >
            Need a hint?
          </button>
          {hintIndex > 0 && <p>{step.hints[hintIndex - 1]}</p>}
        </div>
      )}

      {typeof step.successCondition === 'object' && 'minDistinctConics' in step.successCondition && (
        <p className="success-hint">
          Distinct shapes found: {distinctValid} / {step.successCondition.minDistinctConics}
        </p>
      )}

      <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={onContinue}>
        Continue
      </button>
    </div>
  )
}
