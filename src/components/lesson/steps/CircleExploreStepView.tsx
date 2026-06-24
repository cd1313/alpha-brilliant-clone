import { useEffect, useState } from 'react'
import { CircleSimulator } from '../../circle/CircleSimulator'
import {
  CIRCLE_CENTER_X_BOUND,
  CIRCLE_CENTER_Y_BOUND,
  CIRCLE_MAX_R,
  CIRCLE_MIN_R,
  clampCircleState,
  DEFAULT_CIRCLE,
  roundMeasured,
  roundR,
  type CircleState,
} from '../../../lib/circleGeometry'
import type { ExploreStep } from '../../../types/lesson'
import { renderRichText } from '../../../lib/richText'

type Combo = { h: number; k: number; r: number }

const comboKey = (c: Combo) => `${roundMeasured(c.h)},${roundMeasured(c.k)},${roundR(c.r)}`

type CircleExploreStepViewProps = {
  step: ExploreStep
  circle: CircleState
  onCircleChange: (circle: CircleState) => void
  distinctRValues: Set<number>
  movedCenter: boolean
  movedRadius: boolean
  onContinue: () => void
}

export function CircleExploreStepView({
  step,
  circle,
  onCircleChange,
  distinctRValues,
  movedCenter,
  movedRadius,
  onContinue,
}: CircleExploreStepViewProps) {
  const [hintIndex, setHintIndex] = useState(0)
  const [hInput, setHInput] = useState('')
  const [kInput, setKInput] = useState('')
  const [rInput, setRInput] = useState('')
  const [comboError, setComboError] = useState<string | null>(null)
  const [combos, setCombos] = useState<Combo[]>([])
  const config = step.circleConfig ?? {}
  const hkrInputMode = config.hkrInputMode === true

  useEffect(() => {
    if (hkrInputMode) {
      onCircleChange(DEFAULT_CIRCLE)
    }
    // Reset the displayed circle once when entering the typed-entry step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitCombo = () => {
    const h = Number(hInput)
    const k = Number(kInput)
    const r = Number(rInput)

    if (
      hInput.trim() === '' ||
      kInput.trim() === '' ||
      rInput.trim() === '' ||
      [h, k, r].some(Number.isNaN)
    ) {
      setComboError('Enter numbers for h, k, and r.')
      return
    }
    if (h < -CIRCLE_CENTER_X_BOUND || h > CIRCLE_CENTER_X_BOUND) {
      setComboError(`h must be between −${CIRCLE_CENTER_X_BOUND} and ${CIRCLE_CENTER_X_BOUND}.`)
      return
    }
    if (k < -CIRCLE_CENTER_Y_BOUND || k > CIRCLE_CENTER_Y_BOUND) {
      setComboError(`k must be between −${CIRCLE_CENTER_Y_BOUND} and ${CIRCLE_CENTER_Y_BOUND}.`)
      return
    }
    if (r < CIRCLE_MIN_R || r > CIRCLE_MAX_R) {
      setComboError(`r must be between ${CIRCLE_MIN_R} and ${CIRCLE_MAX_R}.`)
      return
    }

    setComboError(null)
    const clamped = clampCircleState({ centerX: h, centerY: k, radius: r })
    onCircleChange(clamped)

    const combo: Combo = {
      h: roundMeasured(clamped.centerX),
      k: roundMeasured(clamped.centerY),
      r: roundR(clamped.radius),
    }
    setCombos((prev) =>
      prev.some((c) => comboKey(c) === comboKey(combo)) ? prev : [...prev, combo],
    )
    setHInput('')
    setKInput('')
    setRInput('')
  }

  const canContinue = (() => {
    const condition = step.successCondition
    if (condition === 'continue') return true
    if (typeof condition === 'object' && 'movedCenterAndRadius' in condition) {
      return movedCenter && movedRadius
    }
    if (typeof condition === 'object' && 'minDistinctR' in condition) {
      return distinctRValues.size >= condition.minDistinctR
    }
    if (typeof condition === 'object' && 'minDistinctCircles' in condition) {
      return combos.length >= condition.minDistinctCircles
    }
    return true
  })()

  const requiredCombos =
    typeof step.successCondition === 'object' && 'minDistinctCircles' in step.successCondition
      ? step.successCondition.minDistinctCircles
      : 0

  return (
    <div className="step-view explore-step">
      {step.introText && <p className="intro-text">{renderRichText(step.introText)}</p>}
      <p className="step-prompt">{step.prompt}</p>

      <CircleSimulator
        circle={circle}
        onCircleChange={onCircleChange}
        interactive={hkrInputMode ? false : step.interactive ?? true}
        showRadiusDemo={config.showRadiusDemo}
        highlightCenter={config.highlightCenter}
        showRadius={config.showRadius}
        showEquation={config.showEquation}
        centerDraggable={config.centerDraggable ?? true}
      />

      {hkrInputMode && (
        <div className="p-input-panel">
          <form
            className="p-input-row"
            onSubmit={(event) => {
              event.preventDefault()
              submitCombo()
            }}
          >
            <span className="p-input-label">h</span>
            <input
              className="p-input"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={hInput}
              onChange={(event) => setHInput(event.target.value)}
              placeholder="0"
              aria-label="Center x (h)"
            />
            <span className="p-input-label">k</span>
            <input
              className="p-input"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={kInput}
              onChange={(event) => setKInput(event.target.value)}
              placeholder="0"
              aria-label="Center y (k)"
            />
            <span className="p-input-label">r</span>
            <input
              className="p-input"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={rInput}
              onChange={(event) => setRInput(event.target.value)}
              placeholder="3"
              aria-label="Radius (r)"
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Try
            </button>
          </form>

          {comboError && <p className="p-input-error">{comboError}</p>}

          <p className="success-hint">
            Combinations tried: {combos.length} / {requiredCombos}
          </p>

          {combos.length > 0 && (
            <div className="p-chips" aria-label="Combinations tried">
              {combos.map((c) => (
                <span key={comboKey(c)} className="p-chip">
                  ({c.h}, {c.k}), r = {c.r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!hkrInputMode && config.showRadius && (
        <p className="success-hint">
          Current r: <strong>{roundR(circle.radius)}</strong>
          {typeof step.successCondition === 'object' && 'minDistinctR' in step.successCondition && (
            <>
              {' '}
              · Distinct values: {distinctRValues.size} / {step.successCondition.minDistinctR}
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

      {typeof step.successCondition === 'object' && 'movedCenterAndRadius' in step.successCondition && (
        <p className="success-hint">
          Center moved: {movedCenter ? '✓' : '—'} · Radius adjusted: {movedRadius ? '✓' : '—'}
        </p>
      )}

      <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={onContinue}>
        Continue
      </button>
    </div>
  )
}
