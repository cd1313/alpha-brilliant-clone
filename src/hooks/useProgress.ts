import { useCallback, useEffect, useRef, useState } from 'react'
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { localDateString, todayString } from '../lib/dates'
import {
  defaultUserProgress,
  type LessonProgress,
  type SkillStat,
  type UserProgress,
} from '../types/progress'

function yesterdayString(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return localDateString(yesterday)
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

function skillStatsColRef(uid: string) {
  if (!db) throw new Error('Firestore not configured')
  return collection(db, 'users', uid, 'skillStats')
}

function skillStatDocRef(uid: string, skillId: string) {
  if (!db) throw new Error('Firestore not configured')
  return doc(db, 'users', uid, 'skillStats', skillId)
}

function completedLessonProgress(): LessonProgress {
  return {
    currentStepIndex: 0,
    completed: true,
    masteryIndex: 0,
    distinctConicsSeen: [],
    distinctPValues: [],
    distinctRValues: [],
    movedFocus: false,
    movedDirectrix: false,
    movedCenter: false,
    movedRadius: false,
  }
}

export function useProgress(uid: string | undefined) {
  const [userProgress, setUserProgress] = useState<UserProgress>(defaultUserProgress())
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, LessonProgress>>({})
  const [skillStats, setSkillStats] = useState<Record<string, SkillStat>>({})
  const [loading, setLoading] = useState(() => Boolean(uid && db))
  const [error, setError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uidRef = useRef(uid)
  const pendingSaveRef = useRef<{ lessonId: string; progress: LessonProgress } | null>(null)
  // Mirror of skillStats so recordSkillAttempt can read the prior value (e.g. for the EMA)
  // without depending on a possibly-stale state closure.
  const skillStatsRef = useRef<Record<string, SkillStat>>({})

  // Keep the latest uid available to deferred callbacks (timeouts, unmount flush)
  // without writing to the ref during render.
  useEffect(() => {
    uidRef.current = uid
  }, [uid])

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
            lastReviewDate: data.lastReviewDate ?? null,
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

  const loadSkillStats = useCallback(async (): Promise<Record<string, SkillStat>> => {
    if (!uid || !db) return {}
    try {
      const snap = await getDocs(skillStatsColRef(uid))
      const next: Record<string, SkillStat> = {}
      snap.forEach((docSnap) => {
        next[docSnap.id] = docSnap.data() as SkillStat
      })
      skillStatsRef.current = next
      setSkillStats(next)
      return next
    } catch {
      // Non-fatal: review can still run with no prior stats.
      return {}
    }
  }, [uid])

  // Warm the skill-stats ref once so recordSkillAttempt has prior values for the EMA,
  // even during a lesson where the review page never loaded them. Only the ref is needed
  // here (no render reads this state directly), so we avoid setState in the effect.
  useEffect(() => {
    if (!uid || !db) return
    let cancelled = false
    getDocs(skillStatsColRef(uid))
      .then((snap) => {
        if (cancelled) return
        const next: Record<string, SkillStat> = {}
        snap.forEach((docSnap) => {
          next[docSnap.id] = docSnap.data() as SkillStat
        })
        skillStatsRef.current = next
      })
      .catch(() => {
        // Non-fatal: EMA will seed from lifetime rate on the next attempt.
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  /**
   * Record one challenge/reflection attempt for a skill. Fire-and-forget: failures here
   * must never interrupt a lesson, so errors are swallowed. attempts/misses use atomic
   * increments; recentMissRate is an EMA computed from the warm-loaded prior value.
   */
  const recordSkillAttempt = useCallback(
    (skillId: string, result: { correct: boolean; weakComponents?: string[] }) => {
      if (!uid || !db) return

      const { correct, weakComponents } = result
      const RECENT_ALPHA = 0.5
      const miss = correct ? 0 : 1

      const cur =
        skillStatsRef.current[skillId] ?? { attempts: 0, misses: 0, lastResult: 'correct' as const }
      const attempts = cur.attempts + 1
      const misses = cur.misses + miss
      const priorRecent =
        cur.recentMissRate ?? (cur.attempts > 0 ? cur.misses / cur.attempts : miss)
      const recentMissRate = RECENT_ALPHA * miss + (1 - RECENT_ALPHA) * priorRecent
      const merged = Array.from(new Set([...(cur.weakComponents ?? []), ...(weakComponents ?? [])]))

      const nextStat: SkillStat = {
        attempts,
        misses,
        lastResult: correct ? 'correct' : 'incorrect',
        weakComponents: merged,
        recentMissRate,
      }
      const nextMap = { ...skillStatsRef.current, [skillId]: nextStat }
      skillStatsRef.current = nextMap
      setSkillStats(nextMap)

      const payload: Record<string, unknown> = {
        attempts: increment(1),
        misses: increment(miss),
        lastResult: correct ? 'correct' : 'incorrect',
        recentMissRate,
      }
      if (weakComponents && weakComponents.length > 0) {
        payload.weakComponents = arrayUnion(...weakComponents)
      }

      void setDoc(skillStatDocRef(uid, skillId), payload, { merge: true }).catch(() => {
        // Swallow — struggle tracking is best-effort and must not disrupt the lesson.
      })
    },
    [uid],
  )

  /**
   * Mark that the user finished a Smart Review/Practice session today, clearing the daily
   * review gate. This write must succeed: the onSnapshot listener would otherwise overwrite
   * the optimistic local value, so surface failures rather than swallowing them.
   */
  const markReviewDone = useCallback(() => {
    if (!uid || !db) return
    const today = todayString()
    setUserProgress((prev) => ({ ...prev, lastReviewDate: today }))
    void setDoc(userDocRef(uid), { lastReviewDate: today }, { merge: true }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to record review')
    })
  }, [uid])

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
                lastReviewDate: (userSnap.data().lastReviewDate ?? null) as string | null,
              }
            : {
                streak: 0,
                lastActiveDate: null,
                completedLessons: [] as string[],
                lastReviewDate: null as string | null,
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

          return { newStreak, completedLessons, lastReviewDate: existing.lastReviewDate }
        })

        setUserProgress({
          streak: result.newStreak,
          lastActiveDate: today,
          completedLessons: result.completedLessons,
          currentLesson: null,
          lastReviewDate: result.lastReviewDate,
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
    skillStats,
    loading,
    error,
    loadLessonProgress,
    saveLessonProgress,
    loadSkillStats,
    recordSkillAttempt,
    completeLesson,
    markReviewDone,
  }
}
