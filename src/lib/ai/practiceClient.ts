import type { ReviewConic } from '../reviewSkills'
import { callAiAssist, isAiConfigured } from './aiAssist'

/** Opt-in: stays off unless Firebase is configured AND the flag is set. */
const PRACTICE_AI_ENABLED = isAiConfigured && import.meta.env.VITE_ENABLE_AI_PRACTICE === 'true'

export function isPracticeAiEnabled(): boolean {
  return PRACTICE_AI_ENABLED
}

export type TailoredProblem = { hint: string }

// In-session memo so re-rolling or repeated items don't re-spend quota.
const cache = new Map<string, TailoredProblem>()

/**
 * Ask the Cloud Function (OpenAI) to generate a weakness-targeted hint for an already-validated
 * problem. The numbers/answer and prompt are never altered — only the hint is enriched.
 * Returns null on disabled/error/quota so callers keep the deterministic hint.
 */
export async function tailorProblem(args: {
  conic: ReviewConic
  equation: string
  targetedComponent: string
  conceptNotes: string[]
  profileLine: string
}): Promise<TailoredProblem | null> {
  if (!isPracticeAiEnabled()) return null

  const key = `${args.conic}|${args.equation}|${args.targetedComponent}`
  const cached = cache.get(key)
  if (cached) return cached

  const data = await callAiAssist<TailoredProblem>({
    kind: 'tailor',
    conic: args.conic,
    equation: args.equation,
    targetedComponent: args.targetedComponent,
    conceptNotes: args.conceptNotes,
    profileLine: args.profileLine,
  })
  if (!data || typeof data.hint !== 'string') return null

  const hint = data.hint.trim()
  if (!hint) return null
  const result: TailoredProblem = { hint }
  cache.set(key, result)
  return result
}
