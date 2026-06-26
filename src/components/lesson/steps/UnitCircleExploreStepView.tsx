import { useEffect, useRef, useState } from 'react'
import { UnitCircleSimulator } from '../../trig/UnitCircleSimulator'
import {
  DEFAULT_UNIT_CIRCLE,
  formatRadians,
  normalizeAngle,
  type UnitCircleState,
} from '../../../lib/unitCircleGeometry'
import type { ExploreStep } from '../../../types/lesson'
import { renderRichText } from '../../../lib/richText'

type UnitCircleExploreStepViewProps = {
  step: ExploreStep
  unitCircle: UnitCircleState
  onUnitCircleChange: (next: UnitCircleState) => void
  onContinue: () => void
}

export function UnitCircleExploreStepView({
  step,
  unitCircle,
  onUnitCircleChange,
  onContinue,
}: UnitCircleExploreStepViewProps) {
  const [hintIndex, setHintIndex] = useState(0)
  const [movedAngle, setMovedAngle] = useState(false)
  const [distinctAngles, setDistinctAngles] = useState<Set<string>>(new Set())
  const initialRef = useRef(unitCircle)
  const config = step.unitCircleConfig ?? {}
  const condition = step.successCondition

  const tracksMoved = typeof condition === 'object' && 'movedAngle' in condition
  const requiredDistinct =
    typeof condition === 'object' && 'minDistinctAngles' in condition
      ? condition.minDistinctAngles
      : 0
  const tracksDistinct = requiredDistinct > 0

  useEffect(() => {
    if (tracksDistinct || tracksMoved) {
      onUnitCircleChange(DEFAULT_UNIT_CIRCLE)
      initialRef.current = DEFAULT_UNIT_CIRCLE
    }
    // Reset to a known angle once when entering a tracked explore step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (next: UnitCircleState) => {
    onUnitCircleChange(next)
    if (tracksMoved) {
      if (Math.abs(normalizeAngle(next.angle) - normalizeAngle(initialRef.current.angle)) > 0.05) {
        setMovedAngle(true)
      }
    }
    if (tracksDistinct) {
      const key = formatRadians(next.angle)
      setDistinctAngles((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    }
  }

  const canContinue = (() => {
    if (condition === 'continue') return true
    if (tracksMoved) return movedAngle
    if (tracksDistinct) return distinctAngles.size >= requiredDistinct
    return true
  })()

  return (
    <div className="step-view explore-step">
      {step.introText && <p className="intro-text">{renderRichText(step.introText)}</p>}
      <p className="step-prompt">{step.prompt}</p>

      <UnitCircleSimulator
        unitCircle={unitCircle}
        onUnitCircleChange={handleChange}
        interactive={step.interactive ?? true}
        showCoordinates={config.showCoordinates}
        showAngle={config.showAngle}
        showReferenceAngle={config.showReferenceAngle}
        showLegs={config.showLegs}
        snapSpecial={config.snapSpecial}
        targetAngle={config.targetAngle}
      />

      {tracksDistinct && (
        <p className="success-hint">
          Distinct angles visited: {distinctAngles.size} / {requiredDistinct}
        </p>
      )}

      {tracksMoved && (
        <p className="success-hint">Terminal point moved: {movedAngle ? '✓' : '—'}</p>
      )}

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

      <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={onContinue}>
        Continue
      </button>
    </div>
  )
}
