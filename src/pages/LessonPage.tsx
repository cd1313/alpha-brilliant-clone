import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import courseData from '../content/course.json'
import { LessonEngine } from '../components/lesson/LessonEngine'
import { useAuth } from '../hooks/useAuth'
import { getLesson } from '../lib/lessons'
import { getSectionForLesson } from '../lib/course'
import { useProgress } from '../hooks/useProgress'
import { dailyReviewRequired } from '../lib/reviewGate'
import { preCheckRequired } from '../lib/preAssessment'
import type { LessonProgress } from '../types/progress'
import type { Course } from '../types/lesson'

const course = courseData as Course

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user } = useAuth()
  const {
    userProgress,
    loadLessonProgress,
    saveLessonProgress,
    completeLesson,
    markReviewDone,
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

  const completed = userProgress.completedLessons.includes(lessonId)
  const started =
    (lessonProgress?.currentStepIndex ?? 0) > 0 || userProgress.currentLesson?.lessonId === lessonId

  // The unit's pre-check is mandatory before its lessons can be started. Guard direct
  // navigation (e.g. typing the URL) so the gate can't be bypassed from the course map.
  const section = getSectionForLesson(course, lessonId)
  if (section && !completed && !started && preCheckRequired(section, userProgress, user?.uid)) {
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
            Take the {section.title} pre-check before starting this unit. It's quick and nothing is
            graded — it just previews what's ahead and personalizes your review.
          </p>
          <div className="step-actions">
            <Link to={`/pre-assessment/${section.id}`} className="btn btn-primary">
              Start pre-check
            </Link>
            <Link to="/" className="btn btn-secondary">
              Back to Course Map
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
            Daily review first! Score at least 80% on a Smart Review or Practice session — or replay
            a completed lesson — today to unlock a new lesson.
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
        onCompleteLesson={() => {
          void completeLesson(lessonId)
          // Replaying a finished lesson satisfies the daily review requirement.
          if (completed) markReviewDone()
        }}
        onRecordAttempt={recordSkillAttempt}
      />
    </div>
  )
}
