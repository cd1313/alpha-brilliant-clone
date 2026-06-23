import { Link, useParams } from 'react-router-dom'
import { getLesson } from '../lib/lessons'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'

export function LessonCompletePage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user } = useAuth()
  const { userProgress, loading } = useProgress(user?.uid)

  const lesson = lessonId ? getLesson(lessonId) : undefined
  const masteryStep = lesson?.steps.find((s) => s.type === 'mastery')
  const message =
    masteryStep?.type === 'mastery'
      ? masteryStep.completionMessage
      : 'Great work completing this lesson!'

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
        <p className="completion-message">{message}</p>
        <p className="streak-message">
          🔥 {userProgress.streak} day streak — keep it going tomorrow!
        </p>
        <Link to="/" className="btn btn-primary">
          Back to Course Map
        </Link>
      </div>
    </div>
  )
}
