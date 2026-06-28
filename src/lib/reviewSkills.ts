import type { Lesson, Step } from '../types/lesson'
import type { SkillStat } from '../types/progress'
import { todayString } from './dates'

/**
 * The set of reviewable topics. Originally just the four conics; now widened to
 * include the trig simulators. The field stays named `conic` for back-compat with
 * the generator/review pipeline, but it really means "review topic".
 */
export type ReviewTopic =
  | 'circle'
  | 'parabola'
  | 'ellipse'
  | 'hyperbola'
  | 'unit-circle'
  | 'trig-graph'

/** @deprecated Use ReviewTopic — kept as an alias so existing imports keep working. */
export type ReviewConic = ReviewTopic
export type ReviewSkillKind = 'challenge' | 'reflection'

export type ReviewSkill = {
  id: string
  conic: ReviewTopic
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
  { id: 'unit-circle-challenge', conic: 'unit-circle', lessonId: 'trig-angles', kind: 'challenge', label: 'Angles on the unit circle' },
  { id: 'unit-circle-reflection', conic: 'unit-circle', lessonId: 'trig-angles', kind: 'reflection', label: 'Unit circle concepts' },
  { id: 'trig-graph-challenge', conic: 'trig-graph', lessonId: 'trig-sine-cosine', kind: 'challenge', label: 'Graphing trig functions' },
  { id: 'trig-graph-reflection', conic: 'trig-graph', lessonId: 'trig-sine-cosine', kind: 'reflection', label: 'Trig graph concepts' },
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
 * A skill is due when it has never been scheduled (new) or its next review date has
 * arrived. Due skills are heavily prioritized by `skillWeight`.
 */
function isDue(stat: SkillStat | undefined): boolean {
  if (!stat?.nextReviewDate) return true
  return stat.nextReviewDate <= todayString()
}

/**
 * Higher weight = more likely to be reviewed. Due skills (spaced repetition) receive a
 * large bonus so they almost always come up before non-due skills; within the due pool
 * the EMA `recentMissRate` formula acts as a tiebreaker. A reported-`sure` but wrong
 * answer signals a likely misconception and earns an extra bump.
 */
function skillWeight(stat: SkillStat | undefined): number {
  const dueBonus = isDue(stat) ? 6 : 0
  if (!stat || stat.attempts === 0) return 1 + dueBonus
  const lifetime = stat.misses / stat.attempts
  const recent = stat.recentMissRate ?? lifetime
  const recencyBonus = stat.lastResult === 'incorrect' ? 1 : 0
  const misconceptionBonus =
    stat.lastConfidence === 'sure' && stat.lastResult === 'incorrect' ? 2 : 0
  return 1 + dueBonus + 4 * recent + 1 * lifetime + recencyBonus + misconceptionBonus
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
 *
 * `maxReflections` caps the number of reflection-kind slots per session; excess reflections
 * are swapped for challenge-kind skills from the available pool.
 */
export function pickReviewSkills(
  available: ReviewSkill[],
  stats: Record<string, SkillStat>,
  count: number,
  maxReflections = 1,
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

  const selected = shuffle(picks).slice(0, count)

  // Replace excess reflections with challenge-kind skills.
  // When a student has few completed lessons the pick loop allows repeats, so
  // all challenge IDs may already be in `selected`. Fall back to repeating any
  // available challenge rather than silently keeping the extra reflections.
  const reflectionCount = selected.filter((s) => s.kind === 'reflection').length
  if (reflectionCount > maxReflections) {
    const selectedIds = new Set(selected.map((s) => s.id))
    const allChallenges = available.filter((s) => s.kind === 'challenge')
    // Prefer challenges not already in the session; fall back to any challenge.
    const replacements = shuffle([
      ...allChallenges.filter((s) => !selectedIds.has(s.id)),
      ...shuffle(allChallenges),
    ])
    let reflectionsSeen = 0
    const result: ReviewSkill[] = []
    for (const s of selected) {
      if (s.kind === 'reflection') {
        reflectionsSeen++
        if (reflectionsSeen > maxReflections && replacements.length > 0) {
          result.push(replacements.shift()!)
        } else {
          result.push(s)
        }
      } else {
        result.push(s)
      }
    }
    return shuffle(result)
  }

  return selected
}
