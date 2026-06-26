import type { ReviewConic } from './reviewSkills'
import type { SkillStat } from '../types/progress'

/**
 * Compact, lightweight "knowledge base": one short note per conic component. This is the
 * retrieval corpus for tailored practice. It is small on purpose (no vector store needed);
 * `retrieveConceptContext` is the single seam to swap in real retrieval later.
 */
const CONCEPT_NOTES: Record<ReviewConic, Record<string, string>> = {
  circle: {
    _: 'A circle (x - h)^2 + (y - k)^2 = r^2 has center (h, k) and radius r.',
    center: 'The center (h, k) comes straight from the shifts inside the squares; watch the signs.',
    radius: 'r is the square root of the right-hand side, not the right-hand side itself.',
  },
  parabola: {
    _: 'A parabola is the set of points equidistant from the focus and the directrix; x^2 = 4py opens along the axis.',
    vertex: 'The vertex sits exactly between the focus and the directrix.',
    focus: 'In x^2 = 4py the focus is p units from the vertex (the coefficient is 4p).',
    width: 'A larger |p| gives a wider opening; a smaller |p| makes it narrow.',
    'opening direction': 'The sign of the coefficient decides whether it opens up/down (or left/right).',
  },
  ellipse: {
    _: 'An ellipse x^2/a^2 + y^2/b^2 = 1 has a constant sum of distances to its two foci.',
    center: 'The center is read from the shifts (h, k) inside the squared terms.',
    a: 'a is the horizontal semi-axis: sqrt of the denominator under the x term.',
    b: 'b is the vertical semi-axis: sqrt of the denominator under the y term.',
    foci: 'For an ellipse c^2 = a^2 - b^2, and the foci lie on the longer (major) axis.',
  },
  hyperbola: {
    _: 'A hyperbola has a constant absolute difference of distances to its two foci.',
    center: 'The center is read from the shifts (h, k) inside the squared terms.',
    a: 'a (transverse semi-axis) is sqrt of the denominator under the positive term.',
    b: 'b (conjugate semi-axis) sets the asymptote slope b/a.',
    foci: 'For a hyperbola c^2 = a^2 + b^2 (add, not subtract); foci lie in the opening direction.',
    'opening direction': 'The variable of the positive term tells you which way it opens.',
  },
  'unit-circle': {
    _: 'On the unit circle the terminal point of angle θ is (cos θ, sin θ); a full turn is 2π radians.',
    angle: 'Measure θ counterclockwise from the positive x-axis; 180° = π radians.',
    coordinates: 'cos θ is the x-coordinate and sin θ is the y-coordinate of the terminal point.',
    quadrant: 'Signs of (cos θ, sin θ) follow the quadrant: (+,+), (−,+), (−,−), (+,−).',
  },
  'trig-graph': {
    _: 'For y = a·f(b(x − c)) + d: a is amplitude, period is 2π/b (π/b for tangent), c is phase shift, d is the midline.',
    amplitude: 'Amplitude |a| is how far the curve rises above and falls below its midline.',
    period: 'The period is 2π/b; a larger b compresses the graph horizontally.',
    'phase shift': 'Replacing x with (x − c) slides the graph right by c.',
    'vertical shift': 'Adding d moves the entire graph up to the midline y = d.',
  },
}

const CONICS: ReviewConic[] = ['circle', 'parabola', 'ellipse', 'hyperbola']

export type ConicProfile = {
  conic: ReviewConic
  attempts: number
  misses: number
  recentMissRate: number
  weakComponents: string[]
}

export type LearnerProfile = Record<ReviewConic, ConicProfile>

/** Union of weak components recorded for a conic's challenge + reflection skills. */
function componentsForConic(stats: Record<string, SkillStat>, conic: ReviewConic): string[] {
  const ids = [`${conic}-challenge`, `${conic}-reflection`]
  const set = new Set<string>()
  for (const id of ids) {
    for (const c of stats[id]?.weakComponents ?? []) set.add(c)
  }
  return [...set]
}

/** Summarize skillStats into a per-conic weakness profile (the "user profile"). */
export function buildLearnerProfile(stats: Record<string, SkillStat>): LearnerProfile {
  const profile = {} as LearnerProfile
  for (const conic of CONICS) {
    const challenge = stats[`${conic}-challenge`]
    const reflection = stats[`${conic}-reflection`]
    const attempts = (challenge?.attempts ?? 0) + (reflection?.attempts ?? 0)
    const misses = (challenge?.misses ?? 0) + (reflection?.misses ?? 0)
    // Prefer the challenge skill's recency signal; fall back to lifetime rate.
    const recentMissRate =
      challenge?.recentMissRate ?? (attempts > 0 ? misses / attempts : 0)
    profile[conic] = {
      conic,
      attempts,
      misses,
      recentMissRate,
      weakComponents: componentsForConic(stats, conic),
    }
  }
  return profile
}

/** Pick a weak component to target for a problem, or a sensible default. */
export function pickTargetedComponent(p: ConicProfile): string {
  if (p.weakComponents.length === 0) return 'graphing from the equation'
  return p.weakComponents[Math.floor(Math.random() * p.weakComponents.length)]
}

/** Retrieve the relevant concept notes for a conic + the components in play. */
export function retrieveConceptContext(conic: ReviewConic, components: string[]): string[] {
  const notes = CONCEPT_NOTES[conic]
  const out = [notes._]
  for (const c of components) {
    if (notes[c]) out.push(notes[c])
  }
  return Array.from(new Set(out)).slice(0, 4)
}

/** A one-line natural-language summary of how the learner is doing on a conic. */
export function profileLine(p: ConicProfile): string {
  if (p.attempts === 0) return 'No prior attempts recorded.'
  const pct = Math.round((p.misses / p.attempts) * 100)
  const weak = p.weakComponents.length ? ` Weak areas: ${p.weakComponents.join(', ')}.` : ''
  return `Missed ${p.misses} of ${p.attempts} (${pct}%) on ${p.conic}s.${weak}`
}
