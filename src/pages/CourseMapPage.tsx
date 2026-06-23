import { Link } from 'react-router-dom'
import courseData from '../content/course.json'
import { getLesson } from '../lib/lessons'
import { getNextLessonId, isLessonUnlocked } from '../lib/course'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import type { Course } from '../types/lesson'

const course = courseData as Course

function unlockHint(lessonId: string): string | null {
  const entry = course.lessons.find((l) => l.id === lessonId)
  if (!entry?.unlockAfter) return null
  const prerequisite = course.lessons.find((l) => l.id === entry.unlockAfter)
  return prerequisite ? `Complete "${prerequisite.title}" to unlock` : null
}

export function CourseMapPage() {
  const { user, logOut } = useAuth()
  const { userProgress, loading, error } = useProgress(user?.uid)
  const nextLessonId = getNextLessonId(course, userProgress.completedLessons)

  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading your progress...</p>
      </div>
    )
  }

  return (
    <div className="page course-map-page">
      <header className="page-header">
        <div>
          <h1>{course.title}</h1>
          <p className="subtitle">Precalculus unit</p>
        </div>
        <div className="header-actions">
          <span className="streak-badge" title="Daily streak">
            🔥 {userProgress.streak} day streak
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => void logOut()}>
            Sign Out
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {nextLessonId && (
        <p className="course-map-cta">
          {userProgress.completedLessons.length === 0
            ? 'Start with Introduction to explore conic sections.'
            : `Up next: ${getLesson(nextLessonId)?.title ?? nextLessonId}`}
        </p>
      )}

      <div className="lesson-path">
        {course.lessons.map((lesson, index) => {
          const completed = userProgress.completedLessons.includes(lesson.id)
          const unlocked = isLessonUnlocked(lesson, userProgress.completedLessons)
          const inProgress =
            userProgress.currentLesson?.lessonId === lesson.id && !completed
          const isLast = index === course.lessons.length - 1
          const locked = !unlocked
          const hint = locked ? unlockHint(lesson.id) : null

          return (
            <div key={lesson.id} className="lesson-path-item">
              <div
                className={`lesson-node ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${inProgress ? 'in-progress' : ''} ${lesson.id === nextLessonId && !completed ? 'recommended' : ''}`}
              >
                <span className="lesson-order">{lesson.order}</span>
                <div className="lesson-node-body">
                  <h2>{lesson.title}</h2>
                  {lesson.comingSoon && <p className="lesson-status">Coming soon</p>}
                  {!lesson.comingSoon && locked && hint && (
                    <p className="lesson-status">{hint}</p>
                  )}
                  {!lesson.comingSoon && locked && !hint && (
                    <p className="lesson-status">Locked</p>
                  )}
                  {completed && <p className="lesson-status">Completed ✓</p>}
                  {inProgress && <p className="lesson-status">In progress — resume</p>}
                  {!locked && (
                    <Link to={`/lesson/${lesson.id}`} className="btn btn-primary btn-sm">
                      {completed ? 'Review' : inProgress ? 'Resume' : 'Start'}
                    </Link>
                  )}
                </div>
              </div>
              {!isLast && <div className="lesson-connector" aria-hidden="true" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
