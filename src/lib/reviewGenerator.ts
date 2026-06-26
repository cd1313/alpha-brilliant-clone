import type {
  ChallengeStep,
  Feedback,
  HyperbolaOrientation,
  ReflectionStep,
  TrigFunction,
} from '../types/lesson'
import type { SkillStat } from '../types/progress'
import type { ReviewTopic, ReviewSkill } from './reviewSkills'
import { formatCircleEquation } from './circleGeometry'
import { formatParabolaEquation } from './parabolaGeometry'
import { deriveEllipse, formatEllipseEquation } from './ellipseGeometry'
import { deriveHyperbola, formatHyperbolaEquation } from './hyperbolaGeometry'
import { deriveUnitCircle } from './unitCircleGeometry'
import { formatTrigEquation } from './trigGraphGeometry'

export type GeneratedItem = {
  id: string
  skillId: string
  conic: ReviewTopic
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

// --- trig: unit circle ------------------------------------------------------

type SpecialAngle = { angle: number; label: string; cos: string; sin: string }

const SPECIAL_ANGLES: SpecialAngle[] = [
  { angle: Math.PI / 6, label: 'π/6', cos: '√3/2', sin: '1/2' },
  { angle: Math.PI / 4, label: 'π/4', cos: '√2/2', sin: '√2/2' },
  { angle: Math.PI / 3, label: 'π/3', cos: '1/2', sin: '√3/2' },
  { angle: Math.PI / 2, label: 'π/2', cos: '0', sin: '1' },
  { angle: (2 * Math.PI) / 3, label: '2π/3', cos: '−1/2', sin: '√3/2' },
  { angle: (3 * Math.PI) / 4, label: '3π/4', cos: '−√2/2', sin: '√2/2' },
  { angle: (5 * Math.PI) / 6, label: '5π/6', cos: '−√3/2', sin: '1/2' },
  { angle: Math.PI, label: 'π', cos: '−1', sin: '0' },
  { angle: (4 * Math.PI) / 3, label: '4π/3', cos: '−1/2', sin: '−√3/2' },
  { angle: (3 * Math.PI) / 2, label: '3π/2', cos: '0', sin: '−1' },
  { angle: (5 * Math.PI) / 3, label: '5π/3', cos: '1/2', sin: '−√3/2' },
  { angle: (7 * Math.PI) / 4, label: '7π/4', cos: '√2/2', sin: '−√2/2' },
]

const COS_SIN_POOL = ['1/2', '√3/2', '√2/2', '0', '1', '−1', '−1/2', '−√3/2', '−√2/2']

function unitCircleChallenge(): ChallengeStep {
  const special = pick(SPECIAL_ANGLES.filter((s) => s.angle > 0))
  return {
    type: 'challenge',
    title: 'Place the angle',
    prompt: `Drag the terminal point to the angle θ = ${special.label}.`,
    hideTarget: true,
    unitCircleTarget: { kind: 'angle', angle: special.angle },
    unitCircleConfig: { showAngle: true, showCoordinates: true, snapSpecial: true },
    feedback: challengeFeedback(
      `Nice! θ = ${special.label} lands at (${special.cos}, ${special.sin}).`,
      `${special.label} is ${Math.round((special.angle * 180) / Math.PI)}° — sweep counterclockwise from the positive x-axis.`,
    ),
  }
}

function unitCircleReflection(skill: ReviewSkill): ReflectionStep {
  const special = pick(SPECIAL_ANGLES)
  return pick([
    () => {
      const correct = special.cos
      const distractors = shuffle(COS_SIN_POOL.filter((v) => v !== correct)).slice(0, 3)
      return reflectionStep({
        skillId: skill.id,
        stem: `What is cos(${special.label})?`,
        correct,
        distractors,
        explanation: `On the unit circle, cos(${special.label}) is the x-coordinate of the terminal point: ${correct}.`,
        incorrect: 'Remember: cosine is the x-coordinate of the point on the unit circle.',
      })
    },
    () => {
      const correct = special.sin
      const distractors = shuffle(COS_SIN_POOL.filter((v) => v !== correct)).slice(0, 3)
      return reflectionStep({
        skillId: skill.id,
        stem: `What is sin(${special.label})?`,
        correct,
        distractors,
        explanation: `On the unit circle, sin(${special.label}) is the y-coordinate of the terminal point: ${correct}.`,
        incorrect: 'Remember: sine is the y-coordinate of the point on the unit circle.',
      })
    },
    () => {
      // Use an angle that lies strictly inside a quadrant.
      const inQuadrant = pick(SPECIAL_ANGLES.filter((s) => deriveUnitCircle({ angle: s.angle }).quadrant !== null))
      const q = deriveUnitCircle({ angle: inQuadrant.angle }).quadrant!
      const labels: Record<number, string> = { 1: 'Quadrant I', 2: 'Quadrant II', 3: 'Quadrant III', 4: 'Quadrant IV' }
      return reflectionStep({
        skillId: skill.id,
        stem: `Which quadrant contains the terminal side of θ = ${inQuadrant.label}?`,
        correct: labels[q],
        distractors: [labels[1], labels[2], labels[3], labels[4]].filter((l) => l !== labels[q]),
        explanation: `${inQuadrant.label} ≈ ${Math.round((inQuadrant.angle * 180) / Math.PI)}°, which lands in ${labels[q]}.`,
        incorrect: 'Convert to degrees and recall: QI is 0–90°, QII 90–180°, QIII 180–270°, QIV 270–360°.',
      })
    },
  ])()
}

// --- trig: graphs -----------------------------------------------------------

function trigGraphChallenge(_skill: ReviewSkill, stat?: SkillStat): ChallengeStep {
  const fn: TrigFunction = coin() ? 'sin' : 'cos'
  const amplitude = randInt(1, 3)
  const b = pick([1, 2])
  // Phase shift biased to nonzero when the learner struggles with phase.
  const wantsPhase = wants(stat, 'phase shift') || Math.random() < 0.4
  const phaseChoices = [0, Math.PI / 2, -Math.PI / 2]
  const phase = wantsPhase ? pick(phaseChoices) : 0
  const vertical = coin() ? randInt(-2, 2) : 0

  const state = { fn, amplitude, b, phase, vertical }

  return {
    type: 'challenge',
    title: 'Graph the function',
    prompt: `Graph the function ${formatTrigEquation(state)}.`,
    hideTarget: true,
    trigGraphTarget: { kind: 'transform', fn, amplitude, b, phase, vertical },
    trigGraphConfig: { fn, showEquation: false, showMidline: true },
    feedback: challengeFeedback(
      `Well done! Amplitude ${amplitude}, period ${b === 1 ? '2π' : b === 2 ? 'π' : '2π/' + b}, midline y = ${vertical}.`,
      `The number in front sets the amplitude (${amplitude}); the coefficient of x sets the period (2π/${b}); the constant shifts the midline to y = ${vertical}.`,
    ),
  }
}

function periodLabel(b: number): string {
  if (b === 1) return '2π'
  if (b === 2) return 'π'
  if (b === 0.5) return '4π'
  return `2π/${b}`
}

function trigGraphReflection(skill: ReviewSkill): ReflectionStep {
  const fn: TrigFunction = coin() ? 'sin' : 'cos'
  const amplitude = randInt(2, 4)
  const b = pick([1, 2])
  const vertical = pick([-2, -1, 1, 2])
  const eq = formatTrigEquation({ fn, amplitude, b, phase: 0, vertical })
  return pick([
    () =>
      reflectionStep({
        skillId: skill.id,
        stem: `What is the amplitude of ${eq}?`,
        correct: String(amplitude),
        distractors: [String(amplitude + 1), String(amplitude - 1), periodLabel(b)],
        explanation: `Amplitude is |a|, the coefficient in front of ${fn}: ${amplitude}.`,
        incorrect: 'Amplitude is the number multiplying the trig function.',
      }),
    () =>
      reflectionStep({
        skillId: skill.id,
        stem: `What is the period of ${eq}?`,
        correct: periodLabel(b),
        distractors: [periodLabel(b === 1 ? 2 : 1), '2π', String(amplitude)].filter(
          (v) => v !== periodLabel(b),
        ),
        explanation: `Period = 2π / b = 2π / ${b} = ${periodLabel(b)}.`,
        incorrect: 'Period = 2π divided by the coefficient of x.',
      }),
    () =>
      reflectionStep({
        skillId: skill.id,
        stem: `What is the midline of ${eq}?`,
        correct: `y = ${vertical}`,
        distractors: [`y = ${-vertical}`, 'y = 0', `y = ${amplitude}`].filter(
          (v) => v !== `y = ${vertical}`,
        ),
        explanation: `The constant added at the end shifts the midline to y = ${vertical}.`,
        incorrect: 'The midline is y = d, where d is the constant added outside the trig function.',
      }),
  ])()
}

const CHALLENGE_BY_CONIC: Record<
  ReviewTopic,
  (s: ReviewSkill, st?: SkillStat, frac?: boolean) => ChallengeStep
> = {
  circle: circleChallenge,
  parabola: parabolaChallenge,
  ellipse: ellipseChallenge,
  hyperbola: hyperbolaChallenge,
  'unit-circle': unitCircleChallenge,
  'trig-graph': trigGraphChallenge,
}

const REFLECTION_BY_CONIC: Record<ReviewTopic, (s: ReviewSkill, st?: SkillStat) => ReflectionStep> = {
  circle: circleReflection,
  parabola: parabolaReflection,
  ellipse: ellipseReflection,
  hyperbola: hyperbolaReflection,
  'unit-circle': unitCircleReflection,
  'trig-graph': trigGraphReflection,
}

/**
 * Build a ReflectionStep from an AI-generated payload, falling back to the same internal
 * builder used by deterministic generators to guarantee consistent structure.
 */
export function reflectionStepFromAi(
  skill: ReviewSkill,
  ai: { stem: string; correct: string; distractors: string[]; explanation: string },
): ReflectionStep {
  return reflectionStep({
    skillId: skill.id,
    stem: ai.stem,
    correct: ai.correct,
    distractors: ai.distractors,
    explanation: ai.explanation,
    incorrect: 'Think about the defining property of this conic section.',
  })
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
