import { useState } from 'react'
import { useAiEnabled } from '../../../hooks/useAiEnabled'
import { ParabolaSimulator } from '../../parabola/ParabolaSimulator'
import {
  deriveParabola,
  matchesParabolaChallengeTarget,
  type ParabolaState,
} from '../../../lib/parabolaGeometry'
import {
  adaptiveMismatchMessage,
  axisDirection,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
  type HintDetail,
} from '../../../lib/feedback'
import type { ChallengeStep, ParabolaChallengeTarget } from '../../../types/lesson'

type ParabolaChallengeStepViewProps = {
  step: ChallengeStep
  parabola: ParabolaState
  onParabolaChange: (parabola: ParabolaState) => void
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
  onRequestHint?: (wrongComponents: string[], details: HintDetail[], hintIndex: number) => Promise<string | null>
  /** When false, the first Check attempt is final — no retries, no hints. */
  allowRetry?: boolean
}

function ghostFromTarget(
  target: ParabolaChallengeTarget | undefined,
): ParabolaState | null {
  if (!target) return null
  switch (target.kind) {
    case 'focus':
      return {
        focusX: target.focusX,
        focusY: target.focusY,
        directrixY: 2 * target.vertexY - target.focusY,
      }
    case 'vertex':
      return {
        focusX: target.x,
        focusY: target.y + 2,
        directrixY: target.y - 2,
      }
    case 'narrow':
      return {
        focusX: target.vertexX,
        focusY: target.vertexY + 1,
        directrixY: target.vertexY - 1,
      }
  }
}

export function ParabolaChallengeStepView({
  step,
  parabola,
  onParabolaChange,
  onSuccess,
  onAttempt,
  onRequestHint,
  allowRetry = true,
}: ParabolaChallengeStepViewProps) {
  const aiEnabled = useAiEnabled()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const [hintCount, setHintCount] = useState(0)
  const [usingAiHint, setUsingAiHint] = useState(false)
  const [solved, setSolved] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const target = step.parabolaTarget
  const config = step.parabolaConfig ?? {}

  const computeParts = (t: ParabolaChallengeTarget): FeedbackPart[] => {
    const d = deriveParabola(parabola)
    const tol = t.tolerance ?? 0.35

    if (t.kind === 'vertex') {
      const vertexOk = Math.abs(d.vertexX - t.x) <= tol && Math.abs(d.vertexY - t.y) <= tol
      return [{ label: 'vertex', ok: vertexOk }]
    }

    if (t.kind === 'narrow') {
      const vertexOk =
        Math.abs(d.vertexX - t.vertexX) <= tol && Math.abs(d.vertexY - t.vertexY) <= tol
      return [
        { label: 'opening direction', ok: d.opens === 'up' },
        { label: 'vertex', ok: vertexOk },
        { label: 'width', ok: d.p <= (t.maxP ?? 1.25) },
      ]
    }

    const vertexOk =
      Math.abs(d.vertexX - t.vertexX) <= tol && Math.abs(d.vertexY - t.vertexY) <= tol
    const focusOk =
      Math.abs(parabola.focusX - t.focusX) <= tol && Math.abs(parabola.focusY - t.focusY) <= tol
    return [
      { label: 'vertex', ok: vertexOk },
      { label: 'focus', ok: focusOk },
    ]
  }

  const computeHintDetails = (t: ParabolaChallengeTarget): HintDetail[] => {
    const d = deriveParabola(parabola)
    const tol = t.tolerance ?? 0.35
    const details: HintDetail[] = []

    if (t.kind === 'vertex') {
      if (Math.abs(d.vertexX - t.x) > tol) {
        details.push({ component: 'vertex', direction: axisDirection(d.vertexX, t.x, 'x') })
      }
      if (Math.abs(d.vertexY - t.y) > tol) {
        details.push({ component: 'vertex', direction: axisDirection(d.vertexY, t.y, 'y') })
      }
      return details
    }

    if (t.kind === 'narrow') {
      if (d.opens !== 'up') {
        details.push({ component: 'opening direction', direction: 'should open upward' })
      }
      if (Math.abs(d.vertexX - t.vertexX) > tol) {
        details.push({ component: 'vertex', direction: axisDirection(d.vertexX, t.vertexX, 'x') })
      }
      if (Math.abs(d.vertexY - t.vertexY) > tol) {
        details.push({ component: 'vertex', direction: axisDirection(d.vertexY, t.vertexY, 'y') })
      }
      if (d.p > (t.maxP ?? 1.25)) {
        details.push({ component: 'width', direction: 'too wide' })
      }
      return details
    }

    if (Math.abs(d.vertexX - t.vertexX) > tol) {
      details.push({ component: 'vertex', direction: axisDirection(d.vertexX, t.vertexX, 'x') })
    }
    if (Math.abs(d.vertexY - t.vertexY) > tol) {
      details.push({ component: 'vertex', direction: axisDirection(d.vertexY, t.vertexY, 'y') })
    }
    if (Math.abs(parabola.focusX - t.focusX) > tol) {
      details.push({ component: 'focus', direction: axisDirection(parabola.focusX, t.focusX, 'x') })
    }
    if (Math.abs(parabola.focusY - t.focusY) > tol) {
      details.push({ component: 'focus', direction: axisDirection(parabola.focusY, t.focusY, 'y') })
    }

    return details
  }

  const checkAnswer = () => {
    if (!target) return

    if (matchesParabolaChallengeTarget(parabola, target)) {
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

      <ParabolaSimulator
        parabola={parabola}
        onParabolaChange={onParabolaChange}
        interactive
        vertexDraggable={false}
        showEquation={config.showEquation ?? true}
        showParameterP={config.showParameterP ?? true}
        highlightVertex={config.highlightVertex}
        focusVerticalOnly={config.focusVerticalOnly === true}
        vertexAtOrigin={config.vertexAtOrigin === true}
        targetPoint={config.targetPoint}
        ghost={showHint ? ghostFromTarget(target) : null}
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

      {step.miniReflection && solved && (
        <p className="mini-reflection">{step.miniReflection}</p>
      )}

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
