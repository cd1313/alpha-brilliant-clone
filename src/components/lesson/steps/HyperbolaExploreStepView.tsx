import { useEffect, useRef, useState } from 'react'
import { HyperbolaSimulator } from '../../hyperbola/HyperbolaSimulator'
import { DEFAULT_HYPERBOLA, type HyperbolaState } from '../../../lib/hyperbolaGeometry'
import type { ExploreStep } from '../../../types/lesson'

type HyperbolaExploreStepViewProps = {
  step: ExploreStep
  hyperbola: HyperbolaState
  onHyperbolaChange: (hyperbola: HyperbolaState) => void
  onContinue: () => void
}

export function HyperbolaExploreStepView({
  step,
  hyperbola,
  onHyperbolaChange,
  onContinue,
}: HyperbolaExploreStepViewProps) {
  const [hintIndex, setHintIndex] = useState(0)
  const [movedAxes, setMovedAxes] = useState(false)
  const [distinctShapes, setDistinctShapes] = useState<Set<string>>(new Set())
  const initialRef = useRef(hyperbola)
  const config = step.hyperbolaConfig ?? {}
  const condition = step.successCondition

  const tracksMovedAxes = typeof condition === 'object' && 'movedAxes' in condition
  const requiredDistinct =
    typeof condition === 'object' && 'minDistinctHyperbolas' in condition
      ? condition.minDistinctHyperbolas
      : 0
  const tracksDistinct = requiredDistinct > 0

  useEffect(() => {
    if (tracksDistinct) {
      onHyperbolaChange(DEFAULT_HYPERBOLA)
      initialRef.current = DEFAULT_HYPERBOLA
    }
    // Reset to a clean shape once when entering a distinct-shape step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Only user-driven drags flow through here (the reset above calls onHyperbolaChange directly).
  const handleChange = (next: HyperbolaState) => {
    onHyperbolaChange(next)

    if (tracksMovedAxes) {
      const init = initialRef.current
      if (Math.abs(next.a - init.a) > 0.05 || Math.abs(next.b - init.b) > 0.05) {
        setMovedAxes(true)
      }
    }
    if (tracksDistinct) {
      const key = `${Math.round(next.a)},${Math.round(next.b)}`
      setDistinctShapes((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    }
  }

  const canContinue = (() => {
    if (condition === 'continue') return true
    if (tracksMovedAxes) return movedAxes
    if (tracksDistinct) return distinctShapes.size >= requiredDistinct
    return true
  })()

  return (
    <div className="step-view explore-step">
      {step.introText && <p className="intro-text">{step.introText}</p>}
      <p className="step-prompt">{step.prompt}</p>

      <HyperbolaSimulator
        hyperbola={hyperbola}
        onHyperbolaChange={handleChange}
        interactive={step.interactive ?? true}
        showDifferenceDemo={config.showDifferenceDemo}
        highlightVertices={config.highlightVertices}
        showAsymptotes={config.showAsymptotes}
        showBox={config.showBox}
        showAxes={config.showAxes}
        showEquation={config.showEquation}
        centerDraggable={config.centerDraggable ?? true}
        allowOrientationToggle={config.allowOrientationToggle}
      />

      {tracksDistinct && (
        <p className="success-hint">
          Distinct shapes tried: {distinctShapes.size} / {requiredDistinct}
        </p>
      )}

      {tracksMovedAxes && (
        <p className="success-hint">Axes adjusted: {movedAxes ? '✓' : '—'}</p>
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
