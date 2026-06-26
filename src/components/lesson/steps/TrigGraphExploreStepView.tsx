import { useEffect, useRef, useState } from 'react'
import { TrigGraphSimulator } from '../../trig/TrigGraphSimulator'
import {
  DEFAULT_TRIG_GRAPH,
  roundMeasured,
  type TrigGraphState,
} from '../../../lib/trigGraphGeometry'
import type { ExploreStep } from '../../../types/lesson'
import { renderRichText } from '../../../lib/richText'

type TrigGraphExploreStepViewProps = {
  step: ExploreStep
  graph: TrigGraphState
  onGraphChange: (next: TrigGraphState) => void
  onContinue: () => void
}

const graphKey = (g: TrigGraphState) =>
  `${g.fn}:${roundMeasured(g.amplitude)}:${roundMeasured(g.b)}:${roundMeasured(g.phase)}:${roundMeasured(g.vertical)}`

export function TrigGraphExploreStepView({
  step,
  graph,
  onGraphChange,
  onContinue,
}: TrigGraphExploreStepViewProps) {
  const [hintIndex, setHintIndex] = useState(0)
  const [movedGraph, setMovedGraph] = useState(false)
  const [distinctGraphs, setDistinctGraphs] = useState<Set<string>>(new Set())
  const initialRef = useRef(graph)
  const config = step.trigGraphConfig ?? {}
  const condition = step.successCondition

  const tracksMoved = typeof condition === 'object' && 'movedGraph' in condition
  const requiredDistinct =
    typeof condition === 'object' && 'minDistinctGraphs' in condition
      ? condition.minDistinctGraphs
      : 0
  const tracksDistinct = requiredDistinct > 0

  useEffect(() => {
    const start: TrigGraphState = { ...DEFAULT_TRIG_GRAPH, fn: config.fn ?? 'sin' }
    onGraphChange(start)
    initialRef.current = start
    // Establish a clean starting graph (with the configured function) on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (next: TrigGraphState) => {
    onGraphChange(next)
    if (tracksMoved) {
      const init = initialRef.current
      if (
        next.fn !== init.fn ||
        Math.abs(next.amplitude - init.amplitude) > 0.05 ||
        Math.abs(next.b - init.b) > 0.05 ||
        Math.abs(next.phase - init.phase) > 0.05 ||
        Math.abs(next.vertical - init.vertical) > 0.05
      ) {
        setMovedGraph(true)
      }
    }
    if (tracksDistinct) {
      const key = graphKey(next)
      setDistinctGraphs((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    }
  }

  const canContinue = (() => {
    if (condition === 'continue') return true
    if (tracksMoved) return movedGraph
    if (tracksDistinct) return distinctGraphs.size >= requiredDistinct
    return true
  })()

  return (
    <div className="step-view explore-step">
      {step.introText && <p className="intro-text">{renderRichText(step.introText)}</p>}
      <p className="step-prompt">{step.prompt}</p>

      <TrigGraphSimulator
        graph={graph}
        onGraphChange={handleChange}
        interactive={step.interactive ?? true}
        allowFunctionToggle={config.allowFunctionToggle}
        showEquation={config.showEquation}
        showMidline={config.showMidline}
        showPeriod={config.showPeriod}
        showAmplitude={config.showAmplitude}
        horizontalOnly={config.horizontalOnly}
      />

      {tracksDistinct && (
        <p className="success-hint">
          Distinct graphs tried: {distinctGraphs.size} / {requiredDistinct}
        </p>
      )}

      {tracksMoved && <p className="success-hint">Graph adjusted: {movedGraph ? '✓' : '—'}</p>}

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
