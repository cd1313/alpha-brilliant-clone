import { useEffect, useState } from 'react'
import { useAiEnabled } from '../../../hooks/useAiEnabled'
import { TrigGraphSimulator } from '../../trig/TrigGraphSimulator'
import {
  DEFAULT_TRIG_GRAPH,
  matchesTrigGraphChallengeTarget,
  type TrigGraphState,
} from '../../../lib/trigGraphGeometry'
import {
  adaptiveMismatchMessage,
  scalarDirection,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
  type HintDetail,
} from '../../../lib/feedback'
import type { ChallengeStep, TrigGraphChallengeTarget } from '../../../types/lesson'

type TrigGraphChallengeStepViewProps = {
  step: ChallengeStep
  graph: TrigGraphState
  onGraphChange: (next: TrigGraphState) => void
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
  onRequestHint?: (wrongComponents: string[], details: HintDetail[], hintIndex: number) => Promise<string | null>
  allowRetry?: boolean
}

function ghostFromTarget(target: TrigGraphChallengeTarget | undefined, fallbackFn: TrigGraphState['fn']): TrigGraphState | null {
  if (!target) return null
  return {
    fn: target.fn ?? fallbackFn,
    amplitude: target.amplitude,
    b: target.b,
    phase: target.phase,
    vertical: target.vertical,
  }
}

export function TrigGraphChallengeStepView({
  step,
  graph,
  onGraphChange,
  onSuccess,
  onAttempt,
  onRequestHint,
  allowRetry = true,
}: TrigGraphChallengeStepViewProps) {
  const aiEnabled = useAiEnabled()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const [hintCount, setHintCount] = useState(0)
  const [usingAiHint, setUsingAiHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const target = step.trigGraphTarget
  const config = step.trigGraphConfig ?? {}
  const fn = config.fn ?? target?.fn ?? 'sin'

  useEffect(() => {
    onGraphChange({ ...DEFAULT_TRIG_GRAPH, fn })
    // Start each challenge from a clean graph with the correct function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const computeParts = (t: TrigGraphChallengeTarget): FeedbackPart[] => {
    const tol = t.tolerance ?? 0.25
    return [
      { label: 'amplitude', ok: Math.abs(graph.amplitude - t.amplitude) <= tol },
      { label: 'period', ok: Math.abs(graph.b - t.b) <= Math.max(tol, 0.2) },
      { label: 'phase shift', ok: Math.abs(graph.phase - t.phase) <= Math.max(tol, 0.3) },
      { label: 'vertical shift', ok: Math.abs(graph.vertical - t.vertical) <= tol },
    ]
  }

  const computeHintDetails = (t: TrigGraphChallengeTarget): HintDetail[] => {
    const tol = t.tolerance ?? 0.25
    const details: HintDetail[] = []
    if (Math.abs(graph.amplitude - t.amplitude) > tol) {
      details.push({ component: 'amplitude', direction: scalarDirection(graph.amplitude, t.amplitude) })
    }
    if (Math.abs(graph.b - t.b) > Math.max(tol, 0.2)) {
      // Larger b means a shorter period, so describe it in terms of the period.
      details.push({ component: 'period', direction: graph.b < t.b ? 'too long' : 'too short' })
    }
    if (Math.abs(graph.phase - t.phase) > Math.max(tol, 0.3)) {
      details.push({ component: 'phase shift', direction: graph.phase < t.phase ? 'shift right' : 'shift left' })
    }
    if (Math.abs(graph.vertical - t.vertical) > tol) {
      details.push({ component: 'vertical shift', direction: scalarDirection(graph.vertical, t.vertical) })
    }
    return details
  }

  const checkAnswer = () => {
    if (!target) return
    if (matchesTrigGraphChallengeTarget(graph, target)) {
      setFeedback(step.feedback.correct)
      setSolved(true)
      onAttempt?.({ correct: true })
    } else {
      const parts = computeParts(target)
      setFeedback(adaptiveMismatchMessage(parts, step.feedback.incorrect))
      setSolved(false)
      onAttempt?.({ correct: false, weakComponents: weakComponentsOf(parts) })
    }
    if (!allowRetry) setAttempted(true)
  }

  const done = solved || (!allowRetry && attempted)

  return (
    <div className="step-view challenge-step">
      <p className="step-prompt">{step.prompt}</p>

      <TrigGraphSimulator
        graph={graph}
        onGraphChange={onGraphChange}
        interactive
        allowFunctionToggle={config.allowFunctionToggle}
        showEquation={config.showEquation ?? false}
        showMidline={config.showMidline}
        showPeriod={config.showPeriod}
        showAmplitude={config.showAmplitude}
        horizontalOnly={config.horizontalOnly}
        ghost={showHint ? ghostFromTarget(target, fn) : null}
      />

      {feedback && (
        <p className={`feedback ${solved ? 'feedback-correct' : 'feedback-incorrect'}`}>
          {feedback}
        </p>
      )}

      {showHint && (
        <>
          <p className="hint-text">{activeHint ?? step.feedback.hint}</p>
          {usingAiHint && aiEnabled && (
            <button
              type="button"
              className="hint-fallback-link"
              onClick={() => {
                setActiveHint(step.feedback.hint)
                setUsingAiHint(false)
              }}
            >
              Not helpful? See the simpler hint
            </button>
          )}
        </>
      )}

      {step.miniReflection && solved && <p className="mini-reflection">{step.miniReflection}</p>}

      <div className="step-actions">
        {!done && (
          <>
            {allowRetry && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={hintLoading}
                onClick={async () => {
                  const nextIndex = hintCount + 1
                  setHintCount(nextIndex)
                  if (aiEnabled && onRequestHint && target) {
                    setHintLoading(true)
                    const wrong = weakComponentsOf(computeParts(target))
                    const aiHint = await onRequestHint(wrong, computeHintDetails(target), nextIndex)
                    if (aiHint) {
                      setActiveHint(aiHint)
                      setUsingAiHint(true)
                    } else {
                      setActiveHint(step.feedback.hint)
                      setUsingAiHint(false)
                    }
                    setHintLoading(false)
                  } else {
                    setActiveHint(step.feedback.hint)
                    setUsingAiHint(false)
                  }
                  setShowHint(true)
                }}
              >
                {hintLoading ? 'Loading hint…' : (aiEnabled && hintCount > 0) ? 'Another Hint' : 'Hint'}
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={checkAnswer}>
              Check
            </button>
          </>
        )}
        {done && (
          <button type="button" className="btn btn-primary" onClick={onSuccess}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
