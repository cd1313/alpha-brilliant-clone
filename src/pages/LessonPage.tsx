import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LessonEngine } from '../components/lesson/LessonEngine'
import { useAuth } from '../hooks/useAuth'
import { getLesson } from '../lib/lessons'
import { useProgress } from '../hooks/useProgress'
import { dailyReviewRequired } from '../lib/reviewGate'
import type { LessonProgress } from '../types/progress'

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user } = useAuth()
  const {
    userProgress,
    loadLessonProgress,
    saveLessonProgress,
    completeLesson,
    recordSkillAttempt,
    loading,
    error,
  } = useProgress(user?.uid)
  const [lessonProgress, setLessonProgress] = useState<LessonProgress | null>(null)
  const [ready, setReady] = useState(false)

  const lesson = lessonId ? getLesson(lessonId) : undefined

  useEffect(() => {
    if (!lessonId || !user) return

    void loadLessonProgress(lessonId).then((progress) => {
      setLessonProgress(progress)
      setReady(true)
    })
  }, [lessonId, user, loadLessonProgress])

  if (!lessonId || !lesson) {
    return (
      <div className="page">
        <p>Lesson not found.</p>
        <Link to="/">Back to course map</Link>
      </div>
    )
  }

  if (loading || !ready) {
    return (
      <div className="page-loading">
        <p>Loading lesson...</p>
      </div>
    )
  }

  // Daily review gate: block starting a brand-new lesson until today's review/practice is done.
  // Resuming an already-started lesson and revisiting completed ones stay allowed.
  const completed = userProgress.completedLessons.includes(lessonId)
  const started =
    (lessonProgress?.currentStepIndex ?? 0) > 0 || userProgress.currentLesson?.lessonId === lessonId
  if (dailyReviewRequired(userProgress) && !completed && !started) {
    return (
      <div className="page lesson-page">
        <header className="lesson-page-header">
          <Link to="/" className="back-link">
            ← Course Map
          </Link>
          <h1>{lesson.title}</h1>
        </header>
        <div className="page-card">
          <p>
            Daily review first! Finish one Smart Review or Practice session today to unlock a new
            lesson. You can still resume lessons you've started and revisit completed ones.
          </p>
          <div className="step-actions">
            <Link to="/review" className="btn btn-primary">
              Smart Review
            </Link>
            <Link to="/" className="btn btn-secondary">
              Back to Course Map
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page lesson-page">
      <header className="lesson-page-header">
        <Link to="/" className="back-link">
          ← Course Map
        </Link>
        <h1>{lesson.title}</h1>
        <p className="lesson-page-subtitle">
          Conic Sections · {lesson.steps.length} steps · Learn by interacting with the geometry
        </p>
      </header>

      {error && <p className="error-banner">{error}</p>}

      <LessonEngine
        lesson={lesson}
        initialProgress={lessonProgress}
        onSaveProgress={(progress) => saveLessonProgress(lessonId, progress)}
        onCompleteLesson={() => void completeLesson(lessonId)}
        onRecordAttempt={recordSkillAttempt}
      />
    </div>
  )
}
