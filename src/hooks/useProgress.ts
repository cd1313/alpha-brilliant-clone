import { useCallback, useEffect, useRef, useState } from 'react'
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
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

function yesterdayString(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().slice(0, 10)
}

function computeStreak(lastActiveDate: string | null, currentStreak: number, today: string): number {
  if (lastActiveDate === today) {
    return currentStreak
  }
  if (lastActiveDate === yesterdayString()) {
    return currentStreak + 1
  }
  return 1
}

function userDocRef(uid: string) {
  if (!db) throw new Error('Firestore not configured')
  return doc(db, 'users', uid)
}

function lessonProgressDocRef(uid: string, lessonId: string) {
  if (!db) throw new Error('Firestore not configured')
  return doc(db, 'users', uid, 'lessonProgress', lessonId)
}

function completedLessonProgress(): LessonProgress {
  return {
    currentStepIndex: 0,
    completed: true,
    masteryIndex: 0,
    distinctConicsSeen: [],
    distinctPValues: [],
    movedFocus: false,
    movedDirectrix: false,
  }
}

export function useProgress(uid: string | undefined) {
  const [userProgress, setUserProgress] = useState<UserProgress>(defaultUserProgress())
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(() => Boolean(uid && db))
  const [error, setError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uidRef = useRef(uid)
  const pendingSaveRef = useRef<{ lessonId: string; progress: LessonProgress } | null>(null)

  uidRef.current = uid

  const flushPendingSave = useCallback(async () => {
    const currentUid = uidRef.current
    const pending = pendingSaveRef.current
    if (!currentUid || !db || !pending) return

    pendingSaveRef.current = null
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const { lessonId, progress } = pending

    try {
      await setDoc(lessonProgressDocRef(currentUid, lessonId), progress)
      await updateDoc(userDocRef(currentUid), {
        currentLesson: { lessonId, stepIndex: progress.currentStepIndex },
      })
      setUserProgress((prev) => ({
        ...prev,
        currentLesson: { lessonId, stepIndex: progress.currentStepIndex },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save progress')
    }
  }, [])

  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    pendingSaveRef.current = null
  }, [])

  useEffect(() => {
    if (!uid || !db) {
      return
    }

    let cancelled = false
    const userRef = userDocRef(uid)

    const unsubscribe = onSnapshot(
      userRef,
      async (snap) => {
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
          try {
            await setDoc(userRef, defaultUserProgress())
          } catch (err) {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : 'Failed to create progress')
            }
          }
        }

        if (!cancelled) setLoading(false)
      },
      (err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      },
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [uid])

  useEffect(() => {
    return () => {
      void flushPendingSave()
    }
  }, [flushPendingSave])

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
      pendingSaveRef.current = { lessonId, progress }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void flushPendingSave()
      }, 400)
    },
    [uid, flushPendingSave],
  )

  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (!uid || !db) return

      cancelPendingSave()

      const today = todayString()
      const lessonProgress = completedLessonProgress()

      try {
        const result = await runTransaction(db, async (transaction) => {
          const userRef = userDocRef(uid)
          const lessonRef = lessonProgressDocRef(uid, lessonId)
          const userSnap = await transaction.get(userRef)

          const existing = userSnap.exists()
            ? {
                streak: userSnap.data().streak ?? 0,
                lastActiveDate: userSnap.data().lastActiveDate ?? null,
                completedLessons: (userSnap.data().completedLessons ?? []) as string[],
              }
            : {
                streak: 0,
                lastActiveDate: null,
                completedLessons: [] as string[],
              }

          const newStreak = computeStreak(existing.lastActiveDate, existing.streak, today)
          const completedLessons = existing.completedLessons.includes(lessonId)
            ? existing.completedLessons
            : [...existing.completedLessons, lessonId]

          transaction.set(lessonRef, lessonProgress)

          if (userSnap.exists()) {
            transaction.update(userRef, {
              streak: newStreak,
              lastActiveDate: today,
              completedLessons,
              currentLesson: null,
            })
          } else {
            transaction.set(userRef, {
              ...defaultUserProgress(),
              streak: newStreak,
              lastActiveDate: today,
              completedLessons,
              currentLesson: null,
            })
          }

          return { newStreak, completedLessons }
        })

        setUserProgress({
          streak: result.newStreak,
          lastActiveDate: today,
          completedLessons: result.completedLessons,
          currentLesson: null,
        })
        setLessonProgressMap((prev) => ({ ...prev, [lessonId]: lessonProgress }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete lesson')
      }
    },
    [uid, cancelPendingSave],
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
