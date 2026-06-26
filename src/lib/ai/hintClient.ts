import { callAiAssist, isAiConfigured } from './aiAssist'
import type { HintDetail } from '../feedback'

const cache = new Map<string, string>()

export async function requestHint(args: {
  conic: string
  prompt: string
  wrongComponents: string[]
  details?: HintDetail[]
}): Promise<string | null> {
  if (!isAiConfigured) return null
  const detailKey = (args.details ?? [])
    .map((d) => `${d.component}:${d.direction}`)
    .join(',')
  const key = `${args.conic}|${args.prompt}|${args.wrongComponents.join(',')}|${detailKey}`
  if (cache.has(key)) return cache.get(key)!
  const data = await callAiAssist<{ hint: string }>({ kind: 'tailor', ...args })
  if (!data || typeof data.hint !== 'string' || !data.hint.trim()) return null
  cache.set(key, data.hint.trim())
  return cache.get(key)!
}
