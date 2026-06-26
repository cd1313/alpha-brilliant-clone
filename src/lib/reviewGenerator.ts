import type {
  ChallengeStep,
  Feedback,
  HyperbolaOrientation,
  ReflectionStep,
} from '../types/lesson'
import type { SkillStat } from '../types/progress'
import type { ReviewConic, ReviewSkill } from './reviewSkills'
import { formatCircleEquation } from './circleGeometry'
import { formatParabolaEquation } from './parabolaGeometry'
import { deriveEllipse, formatEllipseEquation } from './ellipseGeometry'
import { deriveHyperbola, formatHyperbolaEquation } from './hyperbolaGeometry'

export type GeneratedItem = {
  id: string
  skillId: string
  conic: ReviewConic
  kind: 'challenge' | 'reflection'
  step: ChallengeStep | ReflectionStep
}

// --- small deterministic helpers -------------------------------------------

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
/** Random value on 0.5 steps within [min, max] inclusive (e.g. -2, -1.5, ... 3). */
const randHalf = (min: number, max: number) =>
  randInt(Math.round(min * 2), Math.round(max * 2)) / 2
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const coin = () => Math.random() < 0.5
const wants = (stat: SkillStat | undefined, component: string) =>
  stat?.weakComponents?.includes(component) ?? false

let counter = 0
const nextId = (skillId: string) => `${skillId}-${Date.now()}-${counter++}`

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function challengeFeedback(correct: string, hint: string): Feedback {
  return {
    correct,
    incorrect: 'Not quite — check the values you read from the equation and try again.',
    hint,
  }
}

/** Build a reflection step from a known-correct answer and verified-wrong distractors. */
function reflectionStep(args: {
  skillId: string
  stem: string
  correct: string
  distractors: string[]
  explanation: string
  incorrect: string
  /** Struggle component tagged on a wrong answer (e.g. 'foci') for finer targeting. */
  weakComponent?: string
}): ReflectionStep {
  const seen = new Set<string>([args.correct])
  const distractors: string[] = []
  for (const d of args.distractors) {
    if (seen.has(d)) continue
    seen.add(d)
    distractors.push(d)
    if (distractors.length === 3) break
  }
  const options = shuffle([
    { label: args.correct, correct: true },
    ...distractors.map((label) => ({ label, correct: false })),
  ])
  const choices = options.map((o, i) => ({ id: String.fromCharCode(97 + i), label: o.label }))
  const correctChoiceId = choices[options.findIndex((o) => o.correct)].id

  return {
    type: 'reflection',
    title: 'Review question',
    prompt: args.stem,
    choices,
    correctChoiceId,
    feedback: args.explanation,
    incorrectFeedback: args.incorrect,
    ...(args.weakComponent ? { weakComponent: args.weakComponent } : {}),
  }
}

// --- challenge generators ---------------------------------------------------

function circleChallenge(_skill: ReviewSkill, stat?: SkillStat, frac = false): ChallengeStep {
  const shifted = wants(stat, 'center') || coin()
  // Keep r whole so r² stays a clean number in the equation; the center may be fractional.
  const r = shifted ? randInt(2, 3) : randInt(2, 6)
  const h = shifted ? (frac ? randHalf(-3, 3) : randInt(-3, 3)) : 0
  const k = shifted ? (frac ? randHalf(-2, 2) : randInt(-2, 2)) : 0

  return {
    type: 'challenge',
    title: 'Graph the circle',
    prompt: `Graph the circle ${formatCircleEquation(h, k, r)}.`,
    hideTarget: true,
    circleTarget: { kind: 'radius', centerX: h, centerY: k, radius: r },
    // Shifted circles must allow moving the center; the 'radius' target kind otherwise
    // defaults the center to non-draggable (lessons only used origin-centered radius targets).
    circleConfig: {
      highlightCenter: true,
      showRadius: false,
      showEquation: false,
      centerDraggable: shifted,
    },
    feedback: challengeFeedback(
      `Nice! r = ${r}${shifted ? ` with center (${h}, ${k})` : ''}.`,
      `Take the square root of ${r * r} to get r = ${r}.${shifted ? ` The center is at (${h}, ${k}).` : ''}`,
    ),
  }
}

function parabolaChallenge(_skill: ReviewSkill, stat?: SkillStat, frac = false): ChallengeStep {
  // Bias toward the harder downward case if they struggle with opening direction,
  // and toward narrower curves if they struggle with width.
  const opensUp = wants(stat, 'opening direction') ? Math.random() < 0.3 : coin()
  const shifted = wants(stat, 'vertex') || coin()
  // Half-integer p keeps 4p a whole number in the equation while still being plottable.
  const pMax = wants(stat, 'width') ? 2 : 3
  const p = frac ? randHalf(1, pMax) : randInt(1, pMax)
  const vertexX = shifted ? (frac ? randHalf(-3, 3) : randInt(-3, 3)) : 0
  const vertexY = shifted ? (frac ? randHalf(-1, 1) : randInt(-1, 1)) : 0
  const focusY = opensUp ? vertexY + p : vertexY - p
  const opens: 'up' | 'down' = opensUp ? 'up' : 'down'

  return {
    type: 'challenge',
    title: 'Graph the parabola',
    prompt: `Graph the parabola ${formatParabolaEquation(vertexX, vertexY, p, opens)}.`,
    hideTarget: true,
    parabolaTarget: { kind: 'focus', vertexX, vertexY, focusX: vertexX, focusY },
    parabolaConfig: { highlightVertex: true, showParameterP: true, showEquation: false },
    feedback: challengeFeedback(
      `Well done! Vertex (${vertexX}, ${vertexY}) with p = ${p}, opening ${opens === 'up' ? 'upward' : 'downward'}.`,
      `4p = ${4 * p}, so p = ${p}. Put the vertex at (${vertexX}, ${vertexY}) and the focus ${p} unit(s) ${opens === 'up' ? 'above' : 'below'} it.`,
    ),
  }
}

function ellipseChallenge(_skill: ReviewSkill, stat?: SkillStat, frac = false): ChallengeStep {
  const shifted = wants(stat, 'center') || coin()
  // a != b so it is a true ellipse. When shifted, cap axes at 4 so the a/b handles
  // stay on-screen once the center moves; centered ellipses may go a little larger.
  const centeredPairs: Array<[number, number]> = [
    [5, 3],
    [3, 5],
    [4, 2],
    [2, 4],
    [5, 4],
    [4, 5],
  ]
  const shiftedPairs: Array<[number, number]> = [
    [4, 2],
    [2, 4],
    [4, 3],
    [3, 4],
    [3, 2],
    [2, 3],
  ]
  const [a, b] = pick(shifted ? shiftedPairs : centeredPairs)
  // a/b stay whole so a²/b² read cleanly; the center may be fractional.
  const h = shifted ? (frac ? randHalf(-2, 2) : randInt(-2, 2)) : 0
  const k = shifted ? (frac ? randHalf(-1, 1) : randInt(-1, 1)) : 0

  return {
    type: 'challenge',
    title: 'Graph the ellipse',
    prompt: `Graph the ellipse ${formatEllipseEquation(h, k, a, b)}.`,
    hideTarget: true,
    ellipseTarget: { kind: 'axes', centerX: h, centerY: k, a, b },
    ellipseConfig: {
      highlightCenter: true,
      showAxes: false,
      showEquation: false,
      centerDraggable: true,
    },
    feedback: challengeFeedback(
      `Great! a = ${a}, b = ${b}${shifted ? `, center (${h}, ${k})` : ''}.`,
      `The denominators are a² and b²: a = ${a}, b = ${b}.${shifted ? ` Center at (${h}, ${k}).` : ''}`,
    ),
  }
}

function hyperbolaChallenge(_skill: ReviewSkill, stat?: SkillStat, frac = false): ChallengeStep {
  // If opening direction is a weak spot, bias toward the up/down (toggle) case.
  const orientation: HyperbolaOrientation = wants(stat, 'opening direction')
    ? Math.random() < 0.7
      ? 'vertical'
      : 'horizontal'
    : coin()
      ? 'horizontal'
      : 'vertical'
  const shifted = wants(stat, 'center') || coin()
  const pairs: Array<[number, number]> = [
    [3, 2],
    [2, 3],
    [3, 4],
    [2, 2],
    [4, 2],
  ]
  const [a, b] = pick(pairs)
  // a/b stay whole so a²/b² read cleanly; the center may be fractional.
  const h = shifted ? (frac ? randHalf(-2, 2) : randInt(-2, 2)) : 0
  const k = shifted ? (frac ? randHalf(-1, 1) : randInt(-1, 1)) : 0

  return {
    type: 'challenge',
    title: 'Graph the hyperbola',
    prompt: `Graph the hyperbola ${formatHyperbolaEquation(h, k, a, b, orientation)}.`,
    hideTarget: true,
    hyperbolaTarget: { kind: 'axes', centerX: h, centerY: k, a, b, orientation },
    hyperbolaConfig: {
      showAsymptotes: true,
      showAxes: false,
      showEquation: false,
      centerDraggable: true,
      allowOrientationToggle: true,
    },
    feedback: challengeFeedback(
      `Nice! Opens ${orientation === 'horizontal' ? 'left/right' : 'up/down'}, a = ${a}, b = ${b}${shifted ? `, center (${h}, ${k})` : ''}.`,
      `Take the square roots of the denominators: a = ${a}, b = ${b}. The positive term tells you it opens ${orientation === 'horizontal' ? 'left/right' : 'up/down'}.`,
    ),
  }
}

// --- reflection generators (correct answer computed from the engine) --------

function circleReflection(skill: ReviewSkill): ReflectionStep {
  // Nonzero so the sign-flipped distractors are all distinct from the answer.
  const nonzero = () => pick([-4, -3, -2, 2, 3, 4])
  const h = nonzero()
  const k = nonzero()
  const r = randInt(2, 6)
  return pick([
    () =>
      reflectionStep({
        skillId: skill.id,
        stem: 'In the equation (x − h)² + (y − k)² = r², what does r represent?',
        correct: 'The distance from the center to any point on the circle (the radius).',
        distractors: [
          'The distance across the circle (the diameter).',
          'The distance between two foci.',
          'The area enclosed by the circle.',
        ],
        explanation: 'A circle is all points a fixed distance r — the radius — from the center.',
        incorrect: 'Recall how a circle is defined: every point is the same distance r from the center.',
      }),
    () =>
      reflectionStep({
        skillId: skill.id,
        stem: `What is the center of ${formatCircleEquation(h, k, r)}?`,
        correct: `(${h}, ${k})`,
        distractors: [`(${-h}, ${-k})`, `(${h}, ${-k})`, `(${-h}, ${k})`],
        explanation: `(x − h)² + (y − k)² = r² has center (h, k) = (${h}, ${k}).`,
        incorrect: 'Read h and k from (x − h)² + (y − k)². Watch the signs.',
      }),
  ])()
}

function parabolaReflection(skill: ReviewSkill): ReflectionStep {
  return pick([
    () =>
      reflectionStep({
        skillId: skill.id,
        stem: 'Which statement is always true for a parabola?',
        correct: 'Every point is equidistant from the focus and the directrix.',
        distractors: [
          'Every point is equidistant from two foci.',
          'The sum of distances to two foci is constant.',
          'It always opens upward.',
        ],
        explanation: 'A parabola is the set of points equidistant from the focus and the directrix.',
        incorrect: 'Think back to the focus–directrix definition of a parabola.',
      }),
    () =>
      reflectionStep({
        skillId: skill.id,
        stem: 'For x² = 4py, where is the focus relative to the vertex?',
        correct: 'p units from the vertex along the axis of symmetry.',
        distractors: [
          '4p units from the vertex.',
          'On the directrix.',
          '2p units from the vertex.',
        ],
        explanation: 'In x² = 4py the focus sits p units from the vertex along the axis of symmetry.',
        incorrect: 'The coefficient is 4p, but the focal distance itself is p.',
      }),
  ])()
}

function ellipseReflection(skill: ReviewSkill, stat?: SkillStat): ReflectionStep {
  // Bias toward the foci question when the learner has struggled with foci.
  const askFoci = wants(stat, 'foci') ? Math.random() < 0.8 : coin()
  if (askFoci) {
    const { a, b } = pick([
      { a: 5, b: 3 },
      { a: 5, b: 4 },
    ])
    const horizontal = coin()
    const ea = horizontal ? a : b
    const eb = horizontal ? b : a
    const derived = deriveEllipse({ centerX: 0, centerY: 0, a: ea, b: eb })
    const c = Math.round(derived.c)
    const onX = derived.orientation === 'horizontal'
    const correct = onX ? `(±${c}, 0)` : `(0, ±${c})`
    return reflectionStep({
      skillId: skill.id,
      weakComponent: 'foci',
      stem: `Where are the foci of ${formatEllipseEquation(0, 0, ea, eb)}?`,
      correct,
      distractors: [
        onX ? `(0, ±${c})` : `(±${c}, 0)`,
        `(±${a}, 0)`,
        `(0, ±${b})`,
      ],
      explanation: `c = √(${Math.max(ea, eb) ** 2} − ${Math.min(ea, eb) ** 2}) = ${c}, on the major (${onX ? 'horizontal' : 'vertical'}) axis.`,
      incorrect: 'Use c² = a² − b², then place the foci on the longer (major) axis.',
    })
  }
  return reflectionStep({
    skillId: skill.id,
    stem: 'What is constant for every point on an ellipse?',
    correct: 'The sum of the distances to the two foci.',
    distractors: [
      'The difference of the distances to the two foci.',
      'The distance to a single focus.',
      'The distance to the directrix.',
    ],
    explanation: 'An ellipse is defined by a constant sum of distances to its two foci.',
    incorrect: 'Recall the defining property: it involves the sum of two distances.',
  })
}

function hyperbolaReflection(skill: ReviewSkill, stat?: SkillStat): ReflectionStep {
  const askFoci = wants(stat, 'foci') ? Math.random() < 0.8 : coin()
  if (askFoci) {
    const { a, b } = pick([
      { a: 3, b: 4 },
      { a: 4, b: 3 },
    ])
    const horizontal = coin()
    const derived = deriveHyperbola({
      centerX: 0,
      centerY: 0,
      a,
      b,
      orientation: horizontal ? 'horizontal' : 'vertical',
    })
    const c = Math.round(derived.c)
    const correct = horizontal ? `(±${c}, 0)` : `(0, ±${c})`
    return reflectionStep({
      skillId: skill.id,
      weakComponent: 'foci',
      stem: `Where are the foci of ${formatHyperbolaEquation(0, 0, a, b, horizontal ? 'horizontal' : 'vertical')}?`,
      correct,
      distractors: [
        horizontal ? `(0, ±${c})` : `(±${c}, 0)`,
        `(±${a}, 0)`,
        `(0, ±${b})`,
      ],
      explanation: `For a hyperbola c² = a² + b², so c = √(${a * a} + ${b * b}) = ${c}, in the direction it opens.`,
      incorrect: 'For a hyperbola you add: c² = a² + b². The foci lie in the opening direction.',
    })
  }
  return reflectionStep({
    skillId: skill.id,
    stem: 'What is constant for every point on a hyperbola?',
    correct: 'The absolute difference of the distances to the two foci.',
    distractors: [
      'The sum of the distances to the two foci.',
      'The distance to a single focus.',
      'The distance to the center.',
    ],
    explanation: 'A hyperbola is defined by a constant absolute difference of distances to its two foci.',
    incorrect: 'It is like an ellipse but with a difference instead of a sum.',
  })
}

const CHALLENGE_BY_CONIC: Record<
  ReviewConic,
  (s: ReviewSkill, st?: SkillStat, frac?: boolean) => ChallengeStep
> = {
  circle: circleChallenge,
  parabola: parabolaChallenge,
  ellipse: ellipseChallenge,
  hyperbola: hyperbolaChallenge,
}

const REFLECTION_BY_CONIC: Record<ReviewConic, (s: ReviewSkill, st?: SkillStat) => ReflectionStep> = {
  circle: circleReflection,
  parabola: parabolaReflection,
  ellipse: ellipseReflection,
  hyperbola: hyperbolaReflection,
}

/** Produce one validated review item for a skill. Pure/deterministic — no AI required. */
export function generateReviewItem(
  skill: ReviewSkill,
  stat?: SkillStat,
  options?: { allowFractions?: boolean },
): GeneratedItem {
  const step =
    skill.kind === 'challenge'
      ? CHALLENGE_BY_CONIC[skill.conic](skill, stat, options?.allowFractions ?? false)
      : REFLECTION_BY_CONIC[skill.conic](skill, stat)

  return {
    id: nextId(skill.id),
    skillId: skill.id,
    conic: skill.conic,
    kind: skill.kind,
    step,
  }
}
