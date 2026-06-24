import { renderRichText } from '../../lib/richText'
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

      {step.type === 'challenge' && !step.hideTarget && step.targetConic && (
        <p className="step-target-badge">
          Target shape: <strong>{CONIC_LABELS[step.targetConic]}</strong>
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.parabolaTarget?.kind === 'vertex' && (
        <p className="step-target-badge">
          Target vertex:{' '}
          <strong>
            ({step.parabolaTarget.x}, {step.parabolaTarget.y})
          </strong>
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.parabolaTarget?.kind === 'focus' && (
        <p className="step-target-badge">
          Target: vertex ({step.parabolaTarget.vertexX}, {step.parabolaTarget.vertexY}), focus (
          {step.parabolaTarget.focusX}, {step.parabolaTarget.focusY})
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.parabolaTarget?.kind === 'narrow' && (
        <p className="step-target-badge">
          Target: narrow parabola, vertex ({step.parabolaTarget.vertexX},{' '}
          {step.parabolaTarget.vertexY})
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.circleTarget?.kind === 'center' && (
        <p className="step-target-badge">
          Target center:{' '}
          <strong>
            ({step.circleTarget.x}, {step.circleTarget.y})
          </strong>
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.circleTarget?.kind === 'radius' && (
        <p className="step-target-badge">
          Target: center ({step.circleTarget.centerX}, {step.circleTarget.centerY}), r ={' '}
          {step.circleTarget.radius}
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.circleTarget?.kind === 'small' && (
        <p className="step-target-badge">
          Target: small circle, center ({step.circleTarget.centerX},{' '}
          {step.circleTarget.centerY})
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.ellipseTarget?.kind === 'axes' && (
        <p className="step-target-badge">
          Target: center ({step.ellipseTarget.centerX}, {step.ellipseTarget.centerY}), a ={' '}
          {step.ellipseTarget.a}, b = {step.ellipseTarget.b}
        </p>
      )}

      {step.type === 'challenge' && !step.hideTarget && step.hyperbolaTarget?.kind === 'axes' && (
        <p className="step-target-badge">
          Target: {step.hyperbolaTarget.orientation} hyperbola, center ({step.hyperbolaTarget.centerX},{' '}
          {step.hyperbolaTarget.centerY}), a = {step.hyperbolaTarget.a}, b = {step.hyperbolaTarget.b}
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
          <p>{renderRichText(step.info)}</p>
        </div>
      )}

    </aside>
  )
}
