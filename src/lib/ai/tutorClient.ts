import { getReviewSkill } from '../reviewSkills'
import type { SkillStat } from '../../types/progress'
import { callAiAssist, isAiConfigured } from './aiAssist'

/** Opt-in: stays off unless Firebase is configured AND the flag is set. */
const TUTOR_ENABLED = isAiConfigured && import.meta.env.VITE_ENABLE_AI_TUTOR === 'true'

export function isTutorEnabled(): boolean {
  return TUTOR_ENABLED
}

export type SkillPerformance = {
  label: string
  attempts: number
  misses: number
  weakComponents: string[]
}

export type TutorPerformance = {
  topic: string
  source: 'lesson' | 'review' | 'practice'
  skills: SkillPerformance[]
}

export type TutorSummary = {
  summary: string
  suggestions: string[]
}

export type ChatTurn = { role: 'user' | 'model'; text: string }

export type SessionAttempt = { skillId: string; correct: boolean; weakComponents?: string[] }

/** Aggregate this session's attempts into a per-skill performance payload. */
export function performanceFromAttempts(
  topic: string,
  source: 'lesson' | 'review' | 'practice',
  attempts: SessionAttempt[],
): TutorPerformance {
  const bySkill = new Map<string, SkillPerformance>()
  for (const a of attempts) {
    const cur =
      bySkill.get(a.skillId) ??
      { label: getReviewSkill(a.skillId)?.label ?? a.skillId, attempts: 0, misses: 0, weakComponents: [] }
    cur.attempts += 1
    if (!a.correct) cur.misses += 1
    if (a.weakComponents?.length) {
      cur.weakComponents = Array.from(new Set([...cur.weakComponents, ...a.weakComponents]))
    }
    bySkill.set(a.skillId, cur)
  }
  return { topic, source, skills: [...bySkill.values()] }
}

/** Build a performance payload from cumulative skill stats (fallback when no live session). */
export function performanceFromStats(
  topic: string,
  source: 'lesson' | 'review' | 'practice',
  skillIds: string[],
  stats: Record<string, SkillStat>,
): TutorPerformance {
  const skills: SkillPerformance[] = skillIds
    .map((id) => ({
      label: getReviewSkill(id)?.label ?? id,
      attempts: stats[id]?.attempts ?? 0,
      misses: stats[id]?.misses ?? 0,
      weakComponents: stats[id]?.weakComponents ?? [],
    }))
    .filter((s) => s.attempts > 0)
  return { topic, source, skills }
}

/**
 * Summarize how the learner did and suggest what to study, via the aiAssist Cloud Function
 * (OpenAI). Returns null on disabled/error/quota so the caller can fall back.
 */
export async function requestSummary(perf: TutorPerformance): Promise<TutorSummary | null> {
  if (!isTutorEnabled()) return null
  const data = await callAiAssist<TutorSummary>({
    kind: 'summary',
    topic: perf.topic,
    source: perf.source,
    skills: perf.skills,
  })
  if (!data || typeof data.summary !== 'string' || !Array.isArray(data.suggestions)) return null
  return { summary: data.summary, suggestions: data.suggestions.slice(0, 4) }
}

/**
 * One scope-limited tutor chat turn. The Cloud Function's system instruction keeps it on the
 * just-covered topic and redirects off-topic questions. Returns null on disabled/error/quota.
 */
export async function requestChatReply(args: {
  topic: string
  concepts?: string[]
  history: ChatTurn[]
  message: string
}): Promise<string | null> {
  if (!isTutorEnabled()) return null
  const data = await callAiAssist<{ reply: string }>({
    kind: 'chat',
    topic: args.topic,
    concepts: args.concepts,
    history: args.history,
    message: args.message,
  })
  const reply = data?.reply?.trim()
  return reply && reply.length > 0 ? reply : null
}
