import { useCallback, useEffect, useRef, useState } from 'react'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  defaultUserProgress,
  type LessonProgress,
  type UserProgress,
} from '../types/progress'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function userDocRef(uid: string) {
  if (!db) throw new Error('Firestore not configured')
  return doc(db, 'users', uid)
}

function lessonProgressDocRef(uid: string, lessonId: string) {
  if (!db) throw new Error('Firestore not configured')
  return doc(db, 'users', uid, 'lessonProgress', lessonId)
}

export function useProgress(uid: string | undefined) {
  const [userProgress, setUserProgress] = useState<UserProgress>(defaultUserProgress())
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(() => Boolean(uid && db))
  const [error, setError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!uid || !db) {
      return
    }

    let cancelled = false

    async function load() {
      try {
        const snap = await getDoc(userDocRef(uid!))
        if (cancelled) return

        if (snap.exists()) {
          const data = snap.data()
          setUserProgress({
            streak: data.streak ?? 0,
            lastActiveDate: data.lastActiveDate ?? null,
            completedLessons: data.completedLessons ?? [],
            currentLesson: data.currentLesson ?? null,
          })
        } else {
          await setDoc(userDocRef(uid!), defaultUserProgress())
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load progress')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [uid])

  const loadLessonProgress = useCallback(
    async (lessonId: string): Promise<LessonProgress | null> => {
      if (!uid || !db) return null

      try {
        const snap = await getDoc(lessonProgressDocRef(uid, lessonId))
        if (snap.exists()) {
          const data = snap.data() as LessonProgress
          setLessonProgressMap((prev) => ({ ...prev, [lessonId]: data }))
          return data
        }
        return null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lesson progress')
        return null
      }
    },
    [uid],
  )

  const saveLessonProgress = useCallback(
    (lessonId: string, progress: LessonProgress) => {
      if (!uid || !db) return

      setLessonProgressMap((prev) => ({ ...prev, [lessonId]: progress }))

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await setDoc(lessonProgressDocRef(uid, lessonId), progress, { merge: true })
          await updateDoc(userDocRef(uid), {
            currentLesson: { lessonId, stepIndex: progress.currentStepIndex },
          })
          setUserProgress((prev) => ({
            ...prev,
            currentLesson: { lessonId, stepIndex: progress.currentStepIndex },
          }))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save progress')
        }
      }, 400)
    },
    [uid],
  )

  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (!uid || !db) return

      const today = todayString()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().slice(0, 10)

      let newStreak: number
      if (userProgress.lastActiveDate === today) {
        newStreak = userProgress.streak
      } else if (userProgress.lastActiveDate === yesterdayStr) {
        newStreak = userProgress.streak + 1
      } else {
        newStreak = 1
      }

      const completedLessons = userProgress.completedLessons.includes(lessonId)
        ? userProgress.completedLessons
        : [...userProgress.completedLessons, lessonId]

      const lessonProgress: LessonProgress = {
        currentStepIndex: 0,
        completed: true,
      }

      try {
        await setDoc(lessonProgressDocRef(uid, lessonId), lessonProgress, { merge: true })
        await updateDoc(userDocRef(uid), {
          streak: newStreak,
          lastActiveDate: today,
          completedLessons,
          currentLesson: null,
        })
        setUserProgress({
          streak: newStreak,
          lastActiveDate: today,
          completedLessons,
          currentLesson: null,
        })
        setLessonProgressMap((prev) => ({ ...prev, [lessonId]: lessonProgress }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete lesson')
      }
    },
    [uid, userProgress],
  )

  return {
    userProgress,
    lessonProgressMap,
    loading,
    error,
    loadLessonProgress,
    saveLessonProgress,
    completeLesson,
  }
}
