import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LessonEngine } from '../components/lesson/LessonEngine'
import { useAuth } from '../hooks/useAuth'
import { getLesson } from '../lib/lessons'
import { useProgress } from '../hooks/useProgress'
import type { LessonProgress } from '../types/progress'

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user } = useAuth()
  const { loadLessonProgress, saveLessonProgress, completeLesson, loading, error } =
    useProgress(user?.uid)
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

  return (
    <div className="page lesson-page">
      <header className="lesson-page-header">
        <Link to="/" className="back-link">
          ← Course Map
        </Link>
        <h1>{lesson.title}</h1>
        <p className="lesson-page-subtitle">
          Conic Sections · {lesson.steps.length} steps · Learn by interacting with the cone
        </p>
      </header>

      {error && <p className="error-banner">{error}</p>}

      <LessonEngine
        lesson={lesson}
        initialProgress={lessonProgress}
        onSaveProgress={(progress) => saveLessonProgress(lessonId, progress)}
        onCompleteLesson={() => void completeLesson(lessonId)}
      />
    </div>
  )
}
