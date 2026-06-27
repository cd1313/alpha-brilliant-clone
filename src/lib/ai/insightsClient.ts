import { topicLabel } from '../learnerProfile'
import type { TopicProfile } from '../learnerProfile'
import { callAiAssist } from './aiAssist'
import { isTutorEnabled } from './tutorClient'

export type WeaknessInsights = {
  narrative: string
  plan: { action: string; topic: string }[]
}

/** Deterministic numbers-only payload sent to the AI overlay (no free text from the client). */
function toPayload(topics: TopicProfile[]) {
  return topics.map((t) => ({
    topic: t.topic,
    label: topicLabel(t.topic),
    mastery: t.mastery,
    attempts: t.attempts,
    misses: t.misses,
    weakComponents: t.weakComponents,
  }))
}

/**
 * Ask the AI to interpret the deterministic weakness profile (narrative + study plan).
 * Returns null on disabled/error/quota so the caller can fall back to deterministic text.
 */
export async function requestInsights(topics: TopicProfile[]): Promise<WeaknessInsights | null> {
  if (!isTutorEnabled()) return null
  if (topics.length === 0) return null
  const data = await callAiAssist<WeaknessInsights>({
    kind: 'insights',
    topics: toPayload(topics),
  })
  if (!data || typeof data.narrative !== 'string' || !Array.isArray(data.plan)) return null
  const plan = data.plan
    .filter((p) => p && typeof p.action === 'string' && typeof p.topic === 'string')
    .slice(0, 4)
  if (!data.narrative.trim()) return null
  return { narrative: data.narrative, plan }
}
