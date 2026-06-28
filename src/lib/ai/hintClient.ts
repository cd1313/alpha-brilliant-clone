import { callAiAssist, isAiConfigured } from './aiAssist'
import type { HintDetail } from '../feedback'

const cache = new Map<string, string>()

export async function requestHint(args: {
  conic: string
  prompt: string
  wrongComponents: string[]
  details?: HintDetail[]
  /** Incremented each time the student requests a new hint for the same wrong parts,
   *  so the backend can vary its diagnostic framing on each press. */
  hintIndex?: number
}): Promise<string | null> {
  if (!isAiConfigured) return null
  const detailKey = (args.details ?? [])
    .map((d) => `${d.component}:${d.direction}`)
    .join(',')
  // Include hintIndex in the cache key so each press gets its own cached slot.
  // Re-pressing with the same index (e.g. after a page reload) still hits the cache.
  const key = `${args.conic}|${args.prompt}|${args.wrongComponents.join(',')}|${detailKey}|${args.hintIndex ?? 0}`
  if (cache.has(key)) return cache.get(key)!
  const data = await callAiAssist<{ hint: string }>({ kind: 'tailor', ...args })
  if (!data || typeof data.hint !== 'string' || !data.hint.trim()) return null
  cache.set(key, data.hint.trim())
  return cache.get(key)!
}
