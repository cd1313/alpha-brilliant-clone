import { useState } from 'react'
import { UnitCircleSimulator } from '../../trig/UnitCircleSimulator'
import {
  matchesUnitCircleChallengeTarget,
  normalizeAngle,
  type UnitCircleState,
} from '../../../lib/unitCircleGeometry'
import {
  adaptiveMismatchMessage,
  weakComponentsOf,
  type AttemptResult,
  type FeedbackPart,
  type HintDetail,
} from '../../../lib/feedback'
import type { ChallengeStep, UnitCircleChallengeTarget } from '../../../types/lesson'

type UnitCircleChallengeStepViewProps = {
  step: ChallengeStep
  unitCircle: UnitCircleState
  onUnitCircleChange: (next: UnitCircleState) => void
  onSuccess: () => void
  onAttempt?: (result: AttemptResult) => void
  onRequestHint?: (wrongComponents: string[], details: HintDetail[]) => Promise<string | null>
  allowRetry?: boolean
}

/** Direction to rotate toward a target angle, without revealing the target value. */
function rotationDirection(current: number, targetAngle: number): string {
  const delta = normalizeAngle(targetAngle - current)
  return delta <= Math.PI ? 'rotate counterclockwise' : 'rotate clockwise'
}

function ghostFromTarget(target: UnitCircleChallengeTarget | undefined): UnitCircleState | null {
  if (!target) return null
  if (target.kind === 'angle') return { angle: target.angle }
  if (target.kind === 'coordinate') return { angle: Math.atan2(target.sin, target.cos) }
  return null
}

export function UnitCircleChallengeStepView({
  step,
  unitCircle,
  onUnitCircleChange,
  onSuccess,
  onAttempt,
  onRequestHint,
  allowRetry = true,
}: UnitCircleChallengeStepViewProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const target = step.unitCircleTarget
  const config = step.unitCircleConfig ?? {}

  const computeParts = (t: UnitCircleChallengeTarget): FeedbackPart[] => {
    const ok = matchesUnitCircleChallengeTarget(unitCircle, t)
    const label = t.kind === 'angle' ? 'angle' : t.kind === 'coordinate' ? 'coordinates' : 'quadrant'
    return [{ label, ok }]
  }

  const computeHintDetails = (t: UnitCircleChallengeTarget): HintDetail[] => {
    if (matchesUnitCircleChallengeTarget(unitCircle, t)) return []
    if (t.kind === 'angle') {
      return [{ component: 'angle', direction: rotationDirection(unitCircle.angle, t.angle) }]
    }
    if (t.kind === 'coordinate') {
      const targetAngle = Math.atan2(t.sin, t.cos)
      return [{ component: 'coordinates', direction: rotationDirection(unitCircle.angle, targetAngle) }]
    }
    return [{ component: 'quadrant', direction: 'move to a different quadrant' }]
  }

  const checkAnswer = () => {
    if (!target) return
    if (matchesUnitCircleChallengeTarget(unitCircle, target)) {
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

      <UnitCircleSimulator
        unitCircle={unitCircle}
        onUnitCircleChange={onUnitCircleChange}
        interactive
        showCoordinates={config.showCoordinates ?? true}
        showAngle={config.showAngle ?? true}
        showReferenceAngle={config.showReferenceAngle}
        showLegs={config.showLegs}
        snapSpecial={config.snapSpecial}
        targetAngle={config.targetAngle}
        ghost={showHint ? ghostFromTarget(target) : null}
      />

      {feedback && (
        <p className={`feedback ${solved ? 'feedback-correct' : 'feedback-incorrect'}`}>
          {feedback}
        </p>
      )}

      {showHint && <p className="hint-text">{activeHint ?? step.feedback.hint}</p>}

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
                  if (showHint) {
                    setShowHint(false)
                    return
                  }
                  if (onRequestHint && target) {
                    setHintLoading(true)
                    const wrong = weakComponentsOf(computeParts(target))
                    const aiHint = await onRequestHint(wrong, computeHintDetails(target))
                    setActiveHint(aiHint ?? step.feedback.hint)
                    setHintLoading(false)
                  } else {
                    setActiveHint(step.feedback.hint)
                  }
                  setShowHint(true)
                }}
              >
                {hintLoading ? 'Loading hint…' : showHint ? 'Hide Hint' : 'Hint'}
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
