import type { GeneratedItem } from './reviewGenerator'

export type SavedSession = {
  items: GeneratedItem[]
  index: number
  correctCount: number
  date: string  // YYYY-MM-DD local date — sessions expire at end of day
}

export const PRACTICE_KEY = (lessonId: string) => `asymptote_practice_${lessonId}`
export const REVIEW_KEY = 'asymptote_review_session'

function todayString(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

export function saveSession(key: string, data: Omit<SavedSession, 'date'>): void {
  try {
    const payload: SavedSession = { ...data, date: todayString() }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

export function loadSession(key: string): Omit<SavedSession, 'date'> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedSession
    // Discard sessions from previous days so users can't resume yesterday's
    // review to satisfy today's daily gate.
    if (parsed.date !== todayString()) {
      localStorage.removeItem(key)
      return null
    }
    const { date: _date, ...rest } = parsed
    return rest
  } catch {
    return null
  }
}

export function clearSession(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}
