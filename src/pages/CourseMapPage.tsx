import { Link } from 'react-router-dom'
import courseData from '../content/course.json'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import type { Course } from '../types/lesson'

const course = courseData as Course

export function CourseMapPage() {
  const { user, logOut } = useAuth()
  const { userProgress, loading, error } = useProgress(user?.uid)

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

      <div className="lesson-path">
        {course.lessons.map((lesson, index) => {
          const completed = userProgress.completedLessons.includes(lesson.id)
          const inProgress =
            userProgress.currentLesson?.lessonId === lesson.id && !completed
          const isLast = index === course.lessons.length - 1

          return (
            <div key={lesson.id} className="lesson-path-item">
              <div
                className={`lesson-node ${lesson.locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${inProgress ? 'in-progress' : ''}`}
              >
                <span className="lesson-order">{lesson.order}</span>
                <div className="lesson-node-body">
                  <h2>{lesson.title}</h2>
                  {lesson.locked && <p className="lesson-status">Coming soon</p>}
                  {completed && <p className="lesson-status">Completed ✓</p>}
                  {inProgress && <p className="lesson-status">In progress — resume</p>}
                  {!lesson.locked && (
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
