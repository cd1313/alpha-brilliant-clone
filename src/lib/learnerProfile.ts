import type { ReviewTopic } from './reviewSkills'
import { REVIEW_SKILLS } from './reviewSkills'
import type { SkillStat } from '../types/progress'

/** Every reviewable topic, in display order. */
const TOPICS: ReviewTopic[] = ['circle', 'parabola', 'ellipse', 'hyperbola', 'unit-circle', 'trig-graph']

/** Human-readable names for each topic, for headings and chart axes. */
const TOPIC_LABELS: Record<ReviewTopic, string> = {
  circle: 'Circles',
  parabola: 'Parabolas',
  ellipse: 'Ellipses',
  hyperbola: 'Hyperbolas',
  'unit-circle': 'Unit Circle',
  'trig-graph': 'Trig Graphs',
}

export type TopicProfile = {
  topic: ReviewTopic
  attempts: number
  misses: number
  recentMissRate: number
  weakComponents: string[]
  /** 0..1 mastery from miss rates, or null when the topic has no attempts yet. */
  mastery: number | null
}

export type WeaknessProfile = Record<ReviewTopic, TopicProfile>

/** Display name for a topic (e.g. 'unit-circle' -> 'Unit Circle'). */
export function topicLabel(topic: ReviewTopic): string {
  return TOPIC_LABELS[topic]
}

/** Display label for a weak component scoped to its topic (e.g. "Ellipses · foci"). */
export function componentLabel(topic: ReviewTopic, component: string): string {
  return `${TOPIC_LABELS[topic]} · ${component}`
}

/** The lesson a topic's challenge skill belongs to, used for deep-links. */
export function lessonForTopic(topic: ReviewTopic): string | undefined {
  return REVIEW_SKILLS.find((s) => s.conic === topic && s.kind === 'challenge')?.lessonId
}

/**
 * Mastery for a single tested skill: 1 - (0.6 * recent miss rate + 0.4 * lifetime miss rate),
 * clamped to [0, 1]. Returns null when the skill has never been attempted.
 */
export function masteryScore(stat: SkillStat | undefined): number | null {
  if (!stat || stat.attempts === 0) return null
  const lifetime = stat.misses / stat.attempts
  const recent = stat.recentMissRate ?? lifetime
  const score = 1 - (0.6 * recent + 0.4 * lifetime)
  return Math.max(0, Math.min(1, score))
}

/** Topic mastery = average of its tested challenge + reflection scores; null if none tested. */
function topicMastery(stats: Record<string, SkillStat>, topic: ReviewTopic): number | null {
  const ids = [`${topic}-challenge`, `${topic}-reflection`]
  const scores = ids
    .map((id) => masteryScore(stats[id]))
    .filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

/** Union of weak components recorded for a topic's challenge + reflection skills. */
function componentsForTopic(stats: Record<string, SkillStat>, topic: ReviewTopic): string[] {
  const ids = [`${topic}-challenge`, `${topic}-reflection`]
  const set = new Set<string>()
  for (const id of ids) {
    for (const c of stats[id]?.weakComponents ?? []) set.add(c)
  }
  return [...set]
}

/** Summarize skillStats into a per-topic weakness profile across all six topics. */
export function buildWeaknessProfile(stats: Record<string, SkillStat>): WeaknessProfile {
  const profile = {} as WeaknessProfile
  for (const topic of TOPICS) {
    const challenge = stats[`${topic}-challenge`]
    const reflection = stats[`${topic}-reflection`]
    const attempts = (challenge?.attempts ?? 0) + (reflection?.attempts ?? 0)
    const misses = (challenge?.misses ?? 0) + (reflection?.misses ?? 0)
    // Prefer the challenge skill's recency signal; fall back to lifetime rate.
    const recentMissRate =
      challenge?.recentMissRate ?? (attempts > 0 ? misses / attempts : 0)
    profile[topic] = {
      topic,
      attempts,
      misses,
      recentMissRate,
      weakComponents: componentsForTopic(stats, topic),
      mastery: topicMastery(stats, topic),
    }
  }
  return profile
}

/** The profiles for topics the learner has actually attempted, in display order. */
export function attemptedTopics(profile: WeaknessProfile): TopicProfile[] {
  return TOPICS.map((t) => profile[t]).filter((p) => p.attempts > 0)
}

/** A one-line natural-language summary of how the learner is doing on a topic. */
export function profileLine(p: TopicProfile): string {
  if (p.attempts === 0) return 'No prior attempts recorded.'
  const pct = Math.round((p.misses / p.attempts) * 100)
  const weak = p.weakComponents.length ? ` Weak areas: ${p.weakComponents.join(', ')}.` : ''
  return `Missed ${p.misses} of ${p.attempts} (${pct}%) on ${TOPIC_LABELS[p.topic]}.${weak}`
}
