import { useState } from 'react'
import { ParabolaSimulator } from '../../parabola/ParabolaSimulator'
import {
  deriveParabola,
  matchesParabolaChallengeTarget,
  type ParabolaState,
} from '../../../lib/parabolaGeometry'
import {
  adaptiveMismatchMessage,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
} from '../../../lib/feedback'
import type { ChallengeStep, ParabolaChallengeTarget } from '../../../types/lesson'

type ParabolaChallengeStepViewProps = {
  step: ChallengeStep
  parabola: ParabolaState
  onParabolaChange: (parabola: ParabolaState) => void
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
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
}: ParabolaChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(false)
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
  }

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

      {showHint && <p className="hint-text">{step.feedback.hint}</p>}

      {step.miniReflection && solved && (
        <p className="mini-reflection">{step.miniReflection}</p>
      )}

      <div className="step-actions">
        {!solved && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setShowHint((show) => !show)}>
              {showHint ? 'Hide Hint' : 'Hint'}
            </button>
            <button type="button" className="btn btn-primary" onClick={checkAnswer}>
              Check
            </button>
          </>
        )}
        {solved && (
          <button type="button" className="btn btn-primary" onClick={onSuccess}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
