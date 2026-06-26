import { availableReviewSkills } from './reviewSkills'
import { todayString } from './dates'
import type { UserProgress } from '../types/progress'

/**
 * The daily review gate: once Smart Review is unlocked (at least one conic lesson completed),
 * the learner must finish a Smart Review/Practice session each day before starting a brand-new
 * lesson. Returns true when that requirement is outstanding for today.
 */
export function dailyReviewRequired(userProgress: UserProgress): boolean {
  if (availableReviewSkills(userProgress.completedLessons).length === 0) return false
  return userProgress.lastReviewDate !== todayString()
}
