import type { Lesson, Step } from '../types/lesson'
import type { SkillStat } from '../types/progress'

export type ReviewConic = 'circle' | 'parabola' | 'ellipse' | 'hyperbola'
export type ReviewSkillKind = 'challenge' | 'reflection'

export type ReviewSkill = {
  id: string
  conic: ReviewConic
  /** Lesson that must be completed before this skill can be reviewed. */
  lessonId: string
  kind: ReviewSkillKind
  label: string
}

/**
 * Review skills are coarse (one challenge + one reflection per conic). Finer-grained
 * weaknesses (center vs radius, foci, orientation, ...) are captured as `weakComponents`
 * on each SkillStat and used by the generator to bias difficulty/topic.
 */
export const REVIEW_SKILLS: ReviewSkill[] = [
  { id: 'circle-challenge', conic: 'circle', lessonId: 'circles', kind: 'challenge', label: 'Graphing circles from equations' },
  { id: 'circle-reflection', conic: 'circle', lessonId: 'circles', kind: 'reflection', label: 'Circle concepts' },
  { id: 'parabola-challenge', conic: 'parabola', lessonId: 'parabolas', kind: 'challenge', label: 'Graphing parabolas' },
  { id: 'parabola-reflection', conic: 'parabola', lessonId: 'parabolas', kind: 'reflection', label: 'Parabola concepts' },
  { id: 'ellipse-challenge', conic: 'ellipse', lessonId: 'ellipses', kind: 'challenge', label: 'Graphing ellipses' },
  { id: 'ellipse-reflection', conic: 'ellipse', lessonId: 'ellipses', kind: 'reflection', label: 'Ellipse concepts and foci' },
  { id: 'hyperbola-challenge', conic: 'hyperbola', lessonId: 'hyperbolas', kind: 'challenge', label: 'Graphing hyperbolas' },
  { id: 'hyperbola-reflection', conic: 'hyperbola', lessonId: 'hyperbolas', kind: 'reflection', label: 'Hyperbola concepts and foci' },
]

const SKILL_BY_ID = new Map(REVIEW_SKILLS.map((s) => [s.id, s]))

export function getReviewSkill(id: string): ReviewSkill | undefined {
  return SKILL_BY_ID.get(id)
}

/**
 * Infer the review skill id for a lesson step so normal-lesson attempts feed the same
 * struggle stats the review uses. Returns null for steps that aren't reviewable
 * (intro/cone lessons, explore and mastery steps).
 */
export function skillForStep(lesson: Lesson, step: Step): string | null {
  const sim = lesson.simulator
  if (!sim || sim === 'cone') return null
  if (step.type === 'challenge') return `${sim}-challenge`
  if (step.type === 'reflection') return `${sim}-reflection`
  return null
}

/** Review skills whose prerequisite lesson the learner has completed. */
export function availableReviewSkills(completedLessonIds: string[]): ReviewSkill[] {
  const done = new Set(completedLessonIds)
  return REVIEW_SKILLS.filter((s) => done.has(s.lessonId))
}

/**
 * The challenge skill a lesson unlocks for Practice (5 generated problems for that conic),
 * or undefined when the lesson has no interactive challenges (e.g. the Introduction/cone).
 */
export function getPracticeSkill(lessonId: string): ReviewSkill | undefined {
  return REVIEW_SKILLS.find((s) => s.lessonId === lessonId && s.kind === 'challenge')
}

/** How many of the very weakest skills are guaranteed a slot each session. */
const GUARANTEED_WEAK = 2

/**
 * Higher weight = more likely to be reviewed. Recent struggle (the EMA `recentMissRate`)
 * dominates lifetime miss rate, with an extra bump if the most recent attempt was wrong.
 */
function skillWeight(stat: SkillStat | undefined): number {
  if (!stat || stat.attempts === 0) return 1
  const lifetime = stat.misses / stat.attempts
  const recent = stat.recentMissRate ?? lifetime
  const recencyBonus = stat.lastResult === 'incorrect' ? 1 : 0
  return 1 + 4 * recent + 1 * lifetime + recencyBonus
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Weighted random pick (and removal) from a pool. */
function weightedPick(pool: ReviewSkill[], stats: Record<string, SkillStat>): ReviewSkill {
  const weights = pool.map((s) => skillWeight(stats[s.id]))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = Math.random() * total
  let chosen = 0
  for (let j = 0; j < pool.length; j++) {
    r -= weights[j]
    if (r <= 0) {
      chosen = j
      break
    }
  }
  return pool.splice(chosen, 1)[0]
}

/**
 * Pick `count` skills, guaranteeing the top weakest skills appear, then filling the rest
 * weighted toward struggle (recent-dominant). Avoids repeats until the pool is exhausted.
 */
export function pickReviewSkills(
  available: ReviewSkill[],
  stats: Record<string, SkillStat>,
  count: number,
): ReviewSkill[] {
  if (available.length === 0) return []

  // Force-include the genuinely weakest skills (weight > 1 means real struggle).
  const guaranteed = [...available]
    .sort((a, b) => skillWeight(stats[b.id]) - skillWeight(stats[a.id]))
    .filter((s) => skillWeight(stats[s.id]) > 1)
    .slice(0, GUARANTEED_WEAK)

  const picks: ReviewSkill[] = [...guaranteed]
  let pool = available.filter((s) => !guaranteed.includes(s))

  while (picks.length < count) {
    if (pool.length === 0) pool = [...available]
    picks.push(weightedPick(pool, stats))
  }

  // Shuffle so the guaranteed-weak skills aren't always first.
  return shuffle(picks).slice(0, count)
}
