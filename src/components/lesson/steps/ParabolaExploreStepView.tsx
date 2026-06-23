import { useState } from 'react'
import { ParabolaSimulator } from '../../parabola/ParabolaSimulator'
import { deriveParabola, roundP, type ParabolaState } from '../../../lib/parabolaGeometry'
import type { ExploreStep } from '../../../types/lesson'

type ParabolaExploreStepViewProps = {
  step: ExploreStep
  parabola: ParabolaState
  onParabolaChange: (parabola: ParabolaState) => void
  distinctPValues: Set<number>
  movedFocus: boolean
  movedDirectrix: boolean
  onContinue: () => void
}

export function ParabolaExploreStepView({
  step,
  parabola,
  onParabolaChange,
  distinctPValues,
  movedFocus,
  movedDirectrix,
  onContinue,
}: ParabolaExploreStepViewProps) {
  const [hintIndex, setHintIndex] = useState(0)
  const config = step.parabolaConfig ?? {}
  const { p } = deriveParabola(parabola)

  const canContinue = (() => {
    const condition = step.successCondition
    if (condition === 'continue') return true
    if ('movedFocusAndDirectrix' in condition) {
      return movedFocus && movedDirectrix
    }
    if ('minDistinctP' in condition) {
      return distinctPValues.size >= condition.minDistinctP
    }
    return true
  })()

  return (
    <div className="step-view explore-step">
      {step.introText && <p className="intro-text">{step.introText}</p>}
      <p className="step-prompt">{step.prompt}</p>

      <ParabolaSimulator
        parabola={parabola}
        onParabolaChange={onParabolaChange}
        interactive={step.interactive ?? true}
        showDistanceDemo={config.showDistanceDemo}
        highlightVertex={config.highlightVertex}
        showParameterP={config.showParameterP}
        showEquation={config.showEquation}
        labelToggles={config.labelToggles}
        vertexDraggable={config.vertexDraggable}
        focusVerticalOnly={config.focusVerticalOnly}
      />

      {config.showParameterP && (
        <p className="success-hint">
          Current p: <strong>{roundP(p)}</strong>
          {typeof step.successCondition === 'object' && 'minDistinctP' in step.successCondition && (
            <>
              {' '}
              · Distinct values: {distinctPValues.size} / {step.successCondition.minDistinctP}
            </>
          )}
        </p>
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

      {typeof step.successCondition === 'object' && 'movedFocusAndDirectrix' in step.successCondition && (
        <p className="success-hint">
          Focus moved: {movedFocus ? '✓' : '—'} · Directrix moved: {movedDirectrix ? '✓' : '—'}
        </p>
      )}

      <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={onContinue}>
        Continue
      </button>
    </div>
  )
}
