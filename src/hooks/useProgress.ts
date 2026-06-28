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
import { addDaysString, localDateString, todayString } from '../lib/dates'
import { markPreAssessmentDoneLocal } from '../lib/preAssessment'
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
      // No user yet (auth still resolving) — there is nothing to load, so we are
      // not in a loading state. Callers gate the warm-up redirect on auth instead.
      setLoading(false)
      return
    }

    // A uid just became available (or changed): we have NOT yet received this
    // user's progress from the backend. Stay in the loading state until the first
    // snapshot resolves so consumers never evaluate redirects against default
    // progress (which would bounce returning users into the pre-assessment).
    setLoading(true)

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
            passedUnitTests: data.passedUnitTests ?? [],
            completedPreAssessments: data.completedPreAssessments ?? [],
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
    (
      skillId: string,
      result: {
        correct: boolean
        weakComponents?: string[]
        confidence?: 'sure' | 'unsure' | 'guessing'
      },
    ) => {
      if (!uid || !db) return

      const { correct, weakComponents, confidence } = result
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

      // SM-2-inspired spaced repetition. Correct answers push the next review out by a
      // confidence-adjusted multiplier; incorrect answers reset to tomorrow.
      const multiplier = confidence === 'sure' ? 2.5 : 1.5
      const priorInterval = cur.reviewInterval && cur.reviewInterval > 0 ? cur.reviewInterval : 1
      const reviewInterval = correct ? Math.max(1, Math.floor(priorInterval * multiplier)) : 1
      const nextReviewDate = correct ? addDaysString(reviewInterval) : addDaysString(1)

      const nextStat: SkillStat = {
        attempts,
        misses,
        lastResult: correct ? 'correct' : 'incorrect',
        weakComponents: merged,
        recentMissRate,
        reviewInterval,
        nextReviewDate,
        ...(confidence ? { lastConfidence: confidence } : {}),
      }
      const nextMap = { ...skillStatsRef.current, [skillId]: nextStat }
      skillStatsRef.current = nextMap
      setSkillStats(nextMap)

      const payload: Record<string, unknown> = {
        attempts: increment(1),
        misses: increment(miss),
        lastResult: correct ? 'correct' : 'incorrect',
        recentMissRate,
        reviewInterval,
        nextReviewDate,
      }
      if (weakComponents && weakComponents.length > 0) {
        payload.weakComponents = arrayUnion(...weakComponents)
      }
      if (confidence) {
        payload.lastConfidence = confidence
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

  /**
   * Seed skillStats from a unit's start-of-unit pre-assessment, then record the section
   * id so the pre-assessment is not shown again for that unit. `results` maps skill ids
   * to whether the learner answered that topic correctly. Correct topics start a few days
   * out; incorrect ones are due tomorrow so Smart Review surfaces them early.
   */
  const markPreAssessmentDone = useCallback(
    async (sectionId: string, results: Record<string, boolean>) => {
      if (!uid || !db) return

      const nextMap = { ...skillStatsRef.current }
      const writes: Promise<unknown>[] = []

      for (const [skillId, correct] of Object.entries(results)) {
        const seed: SkillStat = correct
          ? {
              attempts: 1,
              misses: 0,
              lastResult: 'correct',
              recentMissRate: 0,
              reviewInterval: 3,
              nextReviewDate: addDaysString(3),
            }
          : {
              attempts: 1,
              misses: 1,
              lastResult: 'incorrect',
              recentMissRate: 1,
              reviewInterval: 1,
              nextReviewDate: addDaysString(1),
            }
        nextMap[skillId] = seed
        writes.push(setDoc(skillStatDocRef(uid, skillId), seed, { merge: true }))
      }

      // Reflect completion locally first so this hook instance never re-shows the
      // pre-assessment for this unit regardless of how the network writes resolve.
      skillStatsRef.current = nextMap
      setSkillStats(nextMap)
      setUserProgress((prev) => ({
        ...prev,
        completedPreAssessments: (prev.completedPreAssessments ?? []).includes(sectionId)
          ? prev.completedPreAssessments ?? []
          : [...(prev.completedPreAssessments ?? []), sectionId],
      }))

      // Device-local safety net: even if the server write below is rejected and the
      // optimistic value is rolled back by persistentLocalCache, the course map reads
      // this key and will not bounce the learner back into the pre-assessment on this device.
      markPreAssessmentDoneLocal(uid, sectionId)

      // Seeding skillStats is best-effort: allSettled never rejects, so a partial
      // failure (e.g. not-yet-deployed rules) cannot cascade and block the critical
      // completedPreAssessments write below — otherwise the course map would redirect
      // back into the pre-assessment forever.
      await Promise.allSettled(writes)

      // completedPreAssessments is what the course map reads from the server to know the
      // unit's pre-assessment is done. Use setDoc(merge) with arrayUnion — matching
      // markUnitTestPassed — so it succeeds even if the user doc is missing some fields,
      // and isolate its failure from the seeding above.
      try {
        await setDoc(
          userDocRef(uid),
          { completedPreAssessments: arrayUnion(sectionId) },
          { merge: true },
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save pre-assessment')
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
                lastReviewDate: (userSnap.data().lastReviewDate ?? null) as string | null,
                passedUnitTests: (userSnap.data().passedUnitTests ?? []) as string[],
              }
            : {
                streak: 0,
                lastActiveDate: null,
                completedLessons: [] as string[],
                lastReviewDate: null as string | null,
                passedUnitTests: [] as string[],
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

          return { newStreak, completedLessons, lastReviewDate: existing.lastReviewDate, passedUnitTests: existing.passedUnitTests }
        })

        setUserProgress((prev) => ({
          ...prev,
          streak: result.newStreak,
          lastActiveDate: today,
          completedLessons: result.completedLessons,
          currentLesson: null,
          lastReviewDate: result.lastReviewDate,
          passedUnitTests: result.passedUnitTests,
        }))
        setLessonProgressMap((prev) => ({ ...prev, [lessonId]: lessonProgress }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete lesson')
      }
    },
    [uid, cancelPendingSave],
  )

  const markUnitTestPassed = useCallback(
    (sectionId: string) => {
      if (!uid || !db) return
      setUserProgress((prev) => ({
        ...prev,
        passedUnitTests: prev.passedUnitTests.includes(sectionId)
          ? prev.passedUnitTests
          : [...prev.passedUnitTests, sectionId],
      }))
      void setDoc(
        userDocRef(uid),
        { passedUnitTests: arrayUnion(sectionId) },
        { merge: true },
      ).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to record unit test result')
      })
    },
    [uid],
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
    markUnitTestPassed,
    markPreAssessmentDone,
  }
}
