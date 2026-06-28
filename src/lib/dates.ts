/** Local calendar date (YYYY-MM-DD) so day boundaries are the user's midnight, not UTC. */
export function localDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayString(): string {
  return localDateString(new Date())
}

export function yesterdayString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateString(d)
}

/** Local date (YYYY-MM-DD) for today plus `n` days (negative values go back in time). */
export function addDaysString(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return localDateString(d)
}

/**
 * The streak the user should see right now. The stored streak value is only
 * written on lesson completion, so if a day was missed it stays stale until
 * the next activity. This returns 0 immediately when the streak is broken.
 */
export function effectiveStreak(storedStreak: number, lastActiveDate: string | null): number {
  if (!lastActiveDate) return 0
  const today = todayString()
  if (lastActiveDate === today || lastActiveDate === yesterdayString()) return storedStreak
  return 0
}
