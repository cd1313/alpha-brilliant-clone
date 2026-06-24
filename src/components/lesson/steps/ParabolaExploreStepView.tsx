import { useEffect, useState } from 'react'
import { ParabolaSimulator } from '../../parabola/ParabolaSimulator'
import {
  clampParabolaState,
  deriveParabola,
  isParabolaVertexAtOrigin,
  PARABOLA_MAX_P,
  PARABOLA_MIN_P,
  roundP,
  snapParabolaVertexAtOrigin,
  type ParabolaState,
} from '../../../lib/parabolaGeometry'
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
  const [pInput, setPInput] = useState('')
  const [pError, setPError] = useState<string | null>(null)
  const config = step.parabolaConfig ?? {}
  const lockVertexAtOrigin = config.vertexAtOrigin === true
  const lockFocusToYAxis = config.focusVerticalOnly === true || lockVertexAtOrigin
  const pInputMode = config.pInputMode === true
  const { p } = deriveParabola(parabola)

  const handleParabolaChange = (next: ParabolaState) => {
    onParabolaChange(
      lockFocusToYAxis
        ? clampParabolaState({ ...next, focusX: 0 })
        : clampParabolaState(next),
    )
  }

  const submitPValue = () => {
    const trimmed = pInput.trim()
    const value = Number(trimmed)

    if (!trimmed || Number.isNaN(value)) {
      setPError('Enter a number for p.')
      return
    }
    if (value < PARABOLA_MIN_P || value > PARABOLA_MAX_P) {
      setPError(`Choose a value of p between ${PARABOLA_MIN_P} and ${PARABOLA_MAX_P}.`)
      return
    }

    setPError(null)
    setPInput('')
    onParabolaChange(
      clampParabolaState({ focusX: 0, focusY: value, directrixY: -value }),
    )
  }

  const triedValues = [...distinctPValues].sort((a, b) => a - b)

  useEffect(() => {
    if (lockVertexAtOrigin && !isParabolaVertexAtOrigin(parabola)) {
      onParabolaChange(snapParabolaVertexAtOrigin(parabola))
      return
    }

    if (lockFocusToYAxis && Math.abs(parabola.focusX) > 0.001) {
      onParabolaChange(clampParabolaState({ ...parabola, focusX: 0 }))
    }
  }, [lockVertexAtOrigin, lockFocusToYAxis, onParabolaChange, parabola])

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
        onParabolaChange={handleParabolaChange}
        interactive={pInputMode ? false : step.interactive ?? true}
        showDistanceDemo={config.showDistanceDemo}
        highlightVertex={config.highlightVertex}
        showParameterP={config.showParameterP}
        showEquation={config.showEquation}
        labelToggles={config.labelToggles}
        vertexDraggable={config.vertexDraggable}
        focusVerticalOnly={config.focusVerticalOnly === true}
        vertexAtOrigin={config.vertexAtOrigin === true}
      />

      {pInputMode && (
        <div className="p-input-panel">
          <form
            className="p-input-row"
            onSubmit={(event) => {
              event.preventDefault()
              submitPValue()
            }}
          >
            <label className="p-input-label" htmlFor="p-value-input">
              Enter a value for p
            </label>
            <input
              id="p-value-input"
              className="p-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={PARABOLA_MIN_P}
              max={PARABOLA_MAX_P}
              value={pInput}
              onChange={(event) => setPInput(event.target.value)}
              placeholder={`${PARABOLA_MIN_P}–${PARABOLA_MAX_P}`}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Try
            </button>
          </form>

          {pError && <p className="p-input-error">{pError}</p>}

          {triedValues.length > 0 && (
            <div className="p-chips" aria-label="Values of p tried">
              {triedValues.map((value) => (
                <span key={value} className="p-chip">
                  p = {value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
