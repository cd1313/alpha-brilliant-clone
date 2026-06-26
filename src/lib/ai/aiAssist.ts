import { httpsCallable } from 'firebase/functions'
import { functions, isFirebaseConfigured } from '../firebase'

const TIMEOUT_MS = 20000

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI request timed out')), ms),
    ),
  ])
}

/** True when the app is wired to Firebase (so the callable could exist once deployed). */
export const isAiConfigured = isFirebaseConfigured

/**
 * Low-level call to the `aiAssist` Cloud Function. Returns null on any failure (not deployed,
 * timeout, quota, auth, etc.) so every caller can fall back to deterministic behavior.
 */
export async function callAiAssist<T>(payload: Record<string, unknown>): Promise<T | null> {
  if (!functions) return null
  try {
    const fn = httpsCallable<Record<string, unknown>, T>(functions, 'aiAssist')
    const result = await withTimeout(fn(payload))
    return result.data
  } catch (err) {
    console.warn('[ai] aiAssist call failed:', err)
    return null
  }
}
