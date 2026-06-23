import type { ConicType, Step } from '../../types/lesson'

const STEP_TYPE_LABELS: Record<Step['type'], string> = {
  explore: 'Explore',
  challenge: 'Challenge',
  reflection: 'Reflection',
  mastery: 'Mastery Check',
}

const CONIC_LABELS: Record<ConicType, string> = {
  circle: 'Circle',
  ellipse: 'Ellipse',
  parabola: 'Parabola',
  hyperbola: 'Hyperbola',
  none: 'None',
}

type StepInfoPanelProps = {
  step: Step
  stepNumber: number
  totalSteps: number
}

export function StepInfoPanel({ step, stepNumber, totalSteps }: StepInfoPanelProps) {
  return (
    <aside className="step-info-panel" aria-label="Step information">
      <div className="step-info-header">
        <span className={`step-type-badge step-type-${step.type}`}>
          {STEP_TYPE_LABELS[step.type]}
        </span>
        <span className="step-counter">
          Step {stepNumber} of {totalSteps}
        </span>
      </div>

      {step.title && <h2 className="step-info-title">{step.title}</h2>}

      {step.type === 'challenge' && step.targetConic && (
        <p className="step-target-badge">
          Target shape: <strong>{CONIC_LABELS[step.targetConic]}</strong>
        </p>
      )}

      {step.type === 'challenge' && step.parabolaTarget?.kind === 'vertex' && (
        <p className="step-target-badge">
          Target vertex:{' '}
          <strong>
            ({step.parabolaTarget.x}, {step.parabolaTarget.y})
          </strong>
        </p>
      )}

      {step.type === 'challenge' && step.parabolaTarget?.kind === 'focus' && (
        <p className="step-target-badge">
          Target: vertex ({step.parabolaTarget.vertexX}, {step.parabolaTarget.vertexY}), focus (
          {step.parabolaTarget.focusX}, {step.parabolaTarget.focusY})
        </p>
      )}

      {step.type === 'challenge' && step.parabolaTarget?.kind === 'narrow' && (
        <p className="step-target-badge">
          Target: narrow parabola, vertex ({step.parabolaTarget.vertexX},{' '}
          {step.parabolaTarget.vertexY})
        </p>
      )}

      {step.goal && (
        <div className="step-info-block">
          <h3 className="step-info-label">Your goal</h3>
          <p>{step.goal}</p>
        </div>
      )}

      {step.info && (
        <div className="step-info-callout">
          <h3 className="step-info-label">Did you know?</h3>
          <p>{step.info}</p>
        </div>
      )}

      {step.type === 'mastery' && step.sequence && (
        <div className="step-info-block step-info-tip">
          <h3 className="step-info-label">How it works</h3>
          <p>
            Shape labels are hidden. Create each conic in order, then press{' '}
            <strong>Check Shape</strong> to verify.
          </p>
        </div>
      )}

      {step.type === 'mastery' && step.parabolaSequence && (
        <div className="step-info-block step-info-tip">
          <h3 className="step-info-label">How it works</h3>
          <p>
            Labels are hidden. Build each parabola in order, then press{' '}
            <strong>Check Parabola</strong> to verify.
          </p>
        </div>
      )}
    </aside>
  )
}
