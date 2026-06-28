import { availableReviewSkills } from './reviewSkills'
import { todayString } from './dates'
import type { UserProgress } from '../types/progress'

/** Minimum accuracy on a Smart Review/Practice session to satisfy the daily review gate. */
export const REVIEW_PASS_RATE = 0.8

/** Whether a session's score clears the daily review accuracy bar (>= REVIEW_PASS_RATE). */
export function meetsReviewThreshold(correct: number, total: number): boolean {
  return total > 0 && correct / total >= REVIEW_PASS_RATE
}

/**
 * The daily review gate: once Smart Review is unlocked (at least one conic lesson completed),
 * the learner must pass a Smart Review/Practice session (scoring at least REVIEW_PASS_RATE)
 * each day before starting a brand-new lesson. Returns true when that requirement is
 * outstanding for today.
 */
export function dailyReviewRequired(userProgress: UserProgress): boolean {
  if (availableReviewSkills(userProgress.completedLessons).length === 0) return false
  return userProgress.lastReviewDate !== todayString()
}
