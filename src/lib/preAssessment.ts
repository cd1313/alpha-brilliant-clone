// Device-local fallback for the per-unit pre-assessment.
//
// The authoritative record lives on the Firestore user doc (completedPreAssessments),
// but persistentLocalCache means a rejected/rolled-back server write would revert the
// course map's snapshot and re-offer the pre-check. Recording completion in localStorage
// as well guarantees the user is never re-shown a unit's pre-check on this device,
// regardless of how the network write resolves.

import type { CourseSection } from '../types/lesson'
import type { UserProgress } from '../types/progress'
import { sectionHasUnitTest } from './course'

const KEY_PREFIX = 'asymptote:preAssessmentDone:'

function storageKey(uid: string, sectionId: string): string {
  return `${KEY_PREFIX}${uid}:${sectionId}`
}

/** Persist that this device's user completed the unit's pre-check. Safe anywhere. */
export function markPreAssessmentDoneLocal(uid: string | undefined, sectionId: string): void {
  if (typeof window === 'undefined' || !uid) return
  try {
    window.localStorage.setItem(storageKey(uid, sectionId), 'true')
  } catch {
    // Storage may be unavailable (private mode / quota). The server record remains the
    // source of truth; this is only a best-effort safety net.
  }
}

/** Whether this device has recorded the unit's pre-check as completed. */
export function isPreAssessmentDoneLocal(uid: string | undefined, sectionId: string): boolean {
  if (typeof window === 'undefined' || !uid) return false
  try {
    return window.localStorage.getItem(storageKey(uid, sectionId)) === 'true'
  } catch {
    return false
  }
}

/**
 * Whether the unit's pre-check is recorded as done, checking both the server record
 * (completedPreAssessments) and the device-local guard. Single source of truth used
 * across the course map and the lesson gate.
 */
export function isPreCheckDone(
  userProgress: Pick<UserProgress, 'completedPreAssessments'>,
  sectionId: string,
  uid: string | undefined,
): boolean {
  return (
    (userProgress.completedPreAssessments ?? []).includes(sectionId) ||
    isPreAssessmentDoneLocal(uid, sectionId)
  )
}

/**
 * Whether the learner must finish this unit's pre-check before starting its lessons.
 * Applies only at the start of a unit (no lessons completed yet) and only to units that
 * have a pre-check. Once the unit is underway the gate lifts, so in-progress learners
 * are never locked out of their lessons.
 */
export function preCheckRequired(
  section: CourseSection,
  userProgress: UserProgress,
  uid: string | undefined,
): boolean {
  if (!sectionHasUnitTest(section)) return false
  if (isPreCheckDone(userProgress, section.id, uid)) return false
  const startedUnit = section.lessons.some((l) => userProgress.completedLessons.includes(l.id))
  return !startedUnit
}
