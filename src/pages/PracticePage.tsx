import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import { getLesson } from '../lib/lessons'
import { getPracticeSkill } from '../lib/reviewSkills'
import { generateReviewItem, type GeneratedItem } from '../lib/reviewGenerator'
import { ReviewSession } from '../components/review/ReviewSession'
import type { ChallengeStep } from '../types/lesson'
import type { SkillStat } from '../types/progress'
import {
  buildLearnerProfile,
  pickTargetedComponent,
  profileLine,
  retrieveConceptContext,
} from '../lib/learnerProfile'
import { isPracticeAiEnabled, tailorProblem } from '../lib/ai/practiceClient'

const PRACTICE_LENGTH = 5

/**
 * Wrap each engine-generated problem with an AI scenario + weakness-targeted hint. The
 * numeric target/answer is never touched, so problems stay solvable and in-bounds. Any
 * per-item failure (or AI disabled/quota) keeps that item's deterministic prompt + hint.
 */
async function enrichWithAi(
  items: GeneratedItem[],
  stats: Record<string, SkillStat>,
): Promise<GeneratedItem[]> {
  const profile = buildLearnerProfile(stats)
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const step = item.step as ChallengeStep
      const conicProfile = profile[item.conic]
      const targetedComponent = pickTargetedComponent(conicProfile)
      const tailored = await tailorProblem({
        conic: item.conic,
        equation: step.prompt,
        targetedComponent,
        conceptNotes: retrieveConceptContext(item.conic, conicProfile.weakComponents),
        profileLine: profileLine(conicProfile),
      })
      if (!tailored) return item
      const enrichedStep: ChallengeStep = {
        ...step,
        feedback: { ...step.feedback, hint: tailored.hint || step.feedback.hint },
      }
      return { ...item, step: enrichedStep }
    }),
  )
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : items[i]))
}

export function PracticePage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user } = useAuth()
  const { userProgress, loading, loadSkillStats, recordSkillAttempt, markReviewDone } = useProgress(
    user?.uid,
  )
  const [items, setItems] = useState<GeneratedItem[] | null>(null)
  const [building, setBuilding] = useState(true)
  const startedRef = useRef(false)

  const lesson = lessonId ? getLesson(lessonId) : undefined
  const topic = lesson?.title ?? 'this lesson'
  const skill = lessonId ? getPracticeSkill(lessonId) : undefined
  const completed = !!lessonId && userProgress.completedLessons.includes(lessonId)
  const canPractice = !!skill && completed

  const startSession = useCallback(async () => {
    if (!skill) return
    setBuilding(true)
    setItems(null)
    const stats = await loadSkillStats()
    let generated = Array.from({ length: PRACTICE_LENGTH }, () =>
      generateReviewItem(skill, stats[skill.id], { allowFractions: true }),
    )
    if (isPracticeAiEnabled()) {
      generated = await enrichWithAi(generated, stats)
    }
    setItems(generated)
    setBuilding(false)
  }, [skill, loadSkillStats])

  // Build once progress has loaded and practice is actually available, mirroring ReviewPage's
  // race-guard so a slow Firestore read can't build off a stale completion list.
  useEffect(() => {
    if (loading || !user || !canPractice || startedRef.current) return
    startedRef.current = true
    void startSession()
  }, [loading, user, canPractice, startSession])

  const restartSession = useCallback(() => {
    startedRef.current = true
    void startSession()
  }, [startSession])

  const content = () => {
    if (loading) {
      return (
        <div className="page-loading">
          <p>Loading your progress...</p>
        </div>
      )
    }

    if (!canPractice) {
      return (
        <div className="page-card">
          <p>
            Practice unlocks once you complete this lesson. Finish the lesson first, then come back
            for five fresh problems.
          </p>
          <div className="step-actions">
            {lessonId && (
              <Link to={`/lesson/${lessonId}`} className="btn btn-primary">
                Go to lesson
              </Link>
            )}
            <Link to="/" className="btn btn-secondary">
              Back to Course Map
            </Link>
          </div>
        </div>
      )
    }

    if (building || !items || items.length === 0) {
      return (
        <div className="page-loading">
          <p>Building your practice set...</p>
        </div>
      )
    }

    return (
      <ReviewSession
        items={items}
        onRecordAttempt={recordSkillAttempt}
        onRestart={restartSession}
        title="Practice complete"
        restartLabel="Practice again"
        showTutor
        tutorTopic={topic}
        tutorSource="practice"
        onComplete={markReviewDone}
      />
    )
  }

  return (
    <div className="page lesson-page">
      <header className="lesson-page-header">
        <Link to="/" className="back-link">
          ← Course Map
        </Link>
        <h1>Practice: {topic}</h1>
        <p className="lesson-page-subtitle">
          Five fresh problems with hints and feedback — no pressure, just reps
        </p>
      </header>

      {content()}
    </div>
  )
}
