import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'

export function LessonCompletePage() {
  const { user } = useAuth()
  const { userProgress, loading } = useProgress(user?.uid)

  const message = 'Great work completing this lesson!'

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
