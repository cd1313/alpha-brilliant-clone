import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import { getLesson } from '../lib/lessons'
import { availableReviewSkills, getPracticeSkill, REVIEW_SKILLS } from '../lib/reviewSkills'
import { effectiveStreak } from '../lib/dates'
import {
  performanceFromAttempts,
  performanceFromStats,
  type SessionAttempt,
  type TutorPerformance,
} from '../lib/ai/tutorClient'
import { PostSessionTutor } from '../components/review/PostSessionTutor'

export function LessonCompletePage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const { userProgress, loading, loadSkillStats } = useProgress(user?.uid)

  const lesson = lessonId ? getLesson(lessonId) : undefined
  const topic = lesson?.title ?? 'this lesson'
  const canReview = availableReviewSkills(userProgress.completedLessons).length > 0
  const canPractice = !!lessonId && !!getPracticeSkill(lessonId)

  // Prefer this run's results (passed via router state); computed during render, not in an effect.
  const sessionPerformance = useMemo<TutorPerformance | null>(() => {
    const attempts =
      (location.state as { sessionAttempts?: SessionAttempt[] } | null)?.sessionAttempts ?? []
    return attempts.length > 0 ? performanceFromAttempts(topic, 'lesson', attempts) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback (e.g. after a refresh, with no router state): cumulative stats for this lesson.
  const [fallbackPerformance, setFallbackPerformance] = useState<TutorPerformance | null>(null)
  useEffect(() => {
    if (sessionPerformance) return
    let cancelled = false
    void loadSkillStats().then((stats) => {
      if (cancelled) return
      const ids = REVIEW_SKILLS.filter((s) => s.lessonId === lessonId).map((s) => s.id)
      setFallbackPerformance(performanceFromStats(topic, 'lesson', ids, stats))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Always provide a performance object so PostSessionTutor renders immediately.
  // session > cumulative stats > empty placeholder (shows deterministic "nice work" message)
  const performance =
    sessionPerformance ??
    fallbackPerformance ?? { topic, source: 'lesson' as const, skills: [] }

  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="page lesson-complete-page">
      <div className="page-card celebration-card">
        <h1>Lesson Complete!</h1>
        <p className="completion-message">Great work completing this lesson!</p>
        <p className="streak-message">
          🔥 {effectiveStreak(userProgress.streak, userProgress.lastActiveDate)} day streak — keep it going tomorrow!
        </p>
        <div className="completion-actions">
          {canPractice && (
            <Link to={`/lesson/${lessonId}/practice`} className="btn btn-primary">
              Practice
            </Link>
          )}
          {canReview && (
            <Link to="/review" className={`btn ${canPractice ? 'btn-secondary' : 'btn-primary'}`}>
              Smart Review
            </Link>
          )}
          <Link to="/" className={`btn ${canPractice || canReview ? 'btn-secondary' : 'btn-primary'}`}>
            Back to Course Map
          </Link>
        </div>
      </div>

      <div className="page-card tutor-card">
        <PostSessionTutor performance={performance} concepts={[topic]} />
      </div>
    </div>
  )
}
