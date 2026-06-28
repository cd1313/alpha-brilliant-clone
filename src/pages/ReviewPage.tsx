import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import { availableReviewSkills, pickReviewSkills } from '../lib/reviewSkills'
import { REVIEW_PASS_RATE, meetsReviewThreshold } from '../lib/reviewGate'
import { generateReviewItem, reflectionStepFromAi, type GeneratedItem } from '../lib/reviewGenerator'
import { callAiAssist } from '../lib/ai/aiAssist'
import { requestHint } from '../lib/ai/hintClient'
import { ReviewSession } from '../components/review/ReviewSession'
import { saveSession, loadSession, clearSession, REVIEW_KEY } from '../lib/sessionPersistence'

const SESSION_LENGTH = 6

export function ReviewPage() {
  const { user } = useAuth()
  const { userProgress, loading, loadSkillStats, recordSkillAttempt, markReviewDone } = useProgress(
    user?.uid,
  )
  const [items, setItems] = useState<GeneratedItem[] | null>(null)
  const [building, setBuilding] = useState(true)
  const [initialIndex, setInitialIndex] = useState(0)
  const [initialCorrectCount, setInitialCorrectCount] = useState(0)
  const startedRef = useRef(false)

  const hasReviewable = availableReviewSkills(userProgress.completedLessons).length > 0

  const startSession = useCallback(async () => {
    setBuilding(true)
    setItems(null)

    const saved = loadSession(REVIEW_KEY)
    if (saved) {
      setItems(saved.items)
      setInitialIndex(saved.index)
      setInitialCorrectCount(saved.correctCount)
      setBuilding(false)
      return
    }

    const stats = await loadSkillStats()
    const available = availableReviewSkills(userProgress.completedLessons)
    const skills = pickReviewSkills(available, stats, SESSION_LENGTH, 1)
    const items = await Promise.all(
      skills.map(async (skill) => {
        if (skill.kind === 'reflection') {
          try {
            const result = await callAiAssist<{
              stem: string
              correct: string
              distractors: string[]
              explanation: string
            }>({
              kind: 'reflect',
              conic: skill.conic,
              weakComponent: stats[skill.id]?.weakComponents?.[0],
            })
            if (result && result.stem) {
              return { ...generateReviewItem(skill, stats[skill.id]), step: reflectionStepFromAi(skill, result) }
            }
          } catch {
            // fall through to deterministic fallback
          }
        }
        return generateReviewItem(skill, stats[skill.id])
      }),
    )
    saveSession(REVIEW_KEY, { items, index: 0, correctCount: 0 })
    setInitialIndex(0)
    setInitialCorrectCount(0)
    setItems(items)
    setBuilding(false)
  }, [loadSkillStats, userProgress.completedLessons])

  // Build only once completedLessons has actually loaded (hasReviewable true), so a
  // slow Firestore read can't make the session build off an empty list. Builds once.
  useEffect(() => {
    if (loading || !user || !hasReviewable || startedRef.current) return
    startedRef.current = true
    void startSession()
  }, [loading, user, hasReviewable, startSession])

  const restartSession = useCallback(() => {
    clearSession(REVIEW_KEY)
    startedRef.current = true
    void startSession()
  }, [startSession])

  const getAiHint = useCallback(
    (conic: string, prompt: string, wrongComponents: string[], hintIndex: number) =>
      requestHint({ conic, prompt, wrongComponents, hintIndex }),
    [],
  )

  const content = () => {
    if (loading) {
      return (
        <div className="page-loading">
          <p>Loading your progress...</p>
        </div>
      )
    }

    if (!hasReviewable) {
      return (
        <div className="page-card">
          <p>
            Smart Review unlocks after you complete a conic lesson — Parabolas, Circles, Ellipses,
            or Hyperbolas. (The Introduction on its own doesn't add review questions.)
          </p>
          <Link to="/" className="btn btn-primary">
            Back to Course Map
          </Link>
        </div>
      )
    }

    if (building || !items || items.length === 0) {
      return (
        <div className="page-loading">
          <p>Building your review...</p>
        </div>
      )
    }

    return (
      <ReviewSession
        items={items}
        onRecordAttempt={recordSkillAttempt}
        onRestart={restartSession}
        initialIndex={initialIndex}
        initialCorrectCount={initialCorrectCount}
        onSaveProgress={(idx, correct) => {
          if (items) saveSession(REVIEW_KEY, { items, index: idx, correctCount: correct })
        }}
        onComplete={(correct, total) => {
          clearSession(REVIEW_KEY)
          // Only a passing session (>= 80%) clears today's daily review gate.
          if (meetsReviewThreshold(correct, total)) markReviewDone()
        }}
        reviewPassThreshold={REVIEW_PASS_RATE}
        getAiHint={getAiHint}
      />
    )
  }

  return (
    <div className="page lesson-page">
      <header className="lesson-page-header">
        <Link to="/" className="back-link">
          ← Course Map
        </Link>
        <h1>Smart Review</h1>
        <p className="lesson-page-subtitle">
          Fresh practice on what you've finished, focused on where you struggled
        </p>
      </header>

      {content()}
    </div>
  )
}
