export type HyperbolaOrientation = 'horizontal' | 'vertical'

export type HyperbolaState = {
  centerX: number
  centerY: number
  /** Transverse semi-axis (center to vertex). */
  a: number
  /** Conjugate semi-axis (sets the asymptote slope). */
  b: number
  orientation: HyperbolaOrientation
}

export const DEFAULT_HYPERBOLA: HyperbolaState = {
  centerX: 0,
  centerY: 0,
  a: 2,
  b: 3,
  orientation: 'horizontal',
}

const MIN_AXIS = 1
const MAX_AXIS = 4
const CENTER_X_BOUND = 4
const CENTER_Y_BOUND = 3
const MEASURED_DECIMALS = 1

export { MIN_AXIS as HYPERBOLA_MIN_AXIS }
export { MAX_AXIS as HYPERBOLA_MAX_AXIS }
export { CENTER_X_BOUND as HYPERBOLA_CENTER_X_BOUND }
export { CENTER_Y_BOUND as HYPERBOLA_CENTER_Y_BOUND }

export type Point = { x: number; y: number }

export function roundMeasured(value: number): number {
  const factor = 10 ** MEASURED_DECIMALS
  return Math.round(value * factor) / factor
}

export function roundAxis(value: number): number {
  return roundMeasured(value)
}

export function formatMeasuredValue(value: number): string {
  const rounded = roundMeasured(value)
  if (Math.abs(rounded) < 1e-6) return '0'
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(MEASURED_DECIMALS).replace(/\.?0+$/, '')
}

export function distanceToPoint(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

export type HyperbolaDerived = {
  c: number
  vertex1: Point
  vertex2: Point
  focus1: Point
  focus2: Point
  /** Asymptote slope magnitude (lines pass through the center at ±slope). */
  asymptoteSlope: number
}

export function deriveHyperbola(state: HyperbolaState): HyperbolaDerived {
  const { centerX, centerY, a, b, orientation } = state
  const c = Math.sqrt(a * a + b * b)

  if (orientation === 'horizontal') {
    return {
      c,
      vertex1: { x: centerX - a, y: centerY },
      vertex2: { x: centerX + a, y: centerY },
      focus1: { x: centerX - c, y: centerY },
      focus2: { x: centerX + c, y: centerY },
      asymptoteSlope: b / a,
    }
  }

  return {
    c,
    vertex1: { x: centerX, y: centerY - a },
    vertex2: { x: centerX, y: centerY + a },
    focus1: { x: centerX, y: centerY - c },
    focus2: { x: centerX, y: centerY + c },
    asymptoteSlope: a / b,
  }
}

function shiftSquare(variable: 'x' | 'y', value: number): string {
  const v = roundMeasured(value)
  if (Math.abs(v) < 1e-6) return `${variable}²`
  const sign = v > 0 ? '−' : '+'
  return `(${variable} ${sign} ${formatMeasuredValue(Math.abs(v))})²`
}

export function formatHyperbolaEquation(
  h: number,
  k: number,
  a: number,
  b: number,
  orientation: HyperbolaOrientation,
): string {
  const xTerm = shiftSquare('x', h)
  const yTerm = shiftSquare('y', k)
  const aSq = formatMeasuredValue(roundMeasured(a) * roundMeasured(a))
  const bSq = formatMeasuredValue(roundMeasured(b) * roundMeasured(b))

  if (orientation === 'horizontal') {
    return `${xTerm}/${aSq} − ${yTerm}/${bSq} = 1`
  }
  return `${yTerm}/${aSq} − ${xTerm}/${bSq} = 1`
}

/** One point on the "positive" branch at parameter t (used for the definition demo). */
export function pointOnHyperbolaBranch(state: HyperbolaState, t: number): Point {
  const { centerX, centerY, a, b, orientation } = state
  if (orientation === 'horizontal') {
    return { x: centerX + a * Math.cosh(t), y: centerY + b * Math.sinh(t) }
  }
  return { x: centerX + b * Math.sinh(t), y: centerY + a * Math.cosh(t) }
}

/** Both branches as arrays of math-space points (caller maps to screen space). */
export function hyperbolaBranchPaths(state: HyperbolaState): { branch1: Point[]; branch2: Point[] } {
  const { centerX, centerY, a, b, orientation } = state
  const steps = 60
  const tMax = 2.8
  const branch1: Point[] = []
  const branch2: Point[] = []

  for (let i = 0; i <= steps; i++) {
    const t = -tMax + (2 * tMax * i) / steps
    const cosh = Math.cosh(t)
    const sinh = Math.sinh(t)
    if (orientation === 'horizontal') {
      branch1.push({ x: centerX + a * cosh, y: centerY + b * sinh })
      branch2.push({ x: centerX - a * cosh, y: centerY + b * sinh })
    } else {
      branch1.push({ x: centerX + b * sinh, y: centerY + a * cosh })
      branch2.push({ x: centerX + b * sinh, y: centerY - a * cosh })
    }
  }

  return { branch1, branch2 }
}

export function clampHyperbolaState(state: HyperbolaState): HyperbolaState {
  const centerX = Math.max(-CENTER_X_BOUND, Math.min(CENTER_X_BOUND, state.centerX))
  const centerY = Math.max(-CENTER_Y_BOUND, Math.min(CENTER_Y_BOUND, state.centerY))
  const a = Math.max(MIN_AXIS, Math.min(MAX_AXIS, state.a))
  const b = Math.max(MIN_AXIS, Math.min(MAX_AXIS, state.b))

  return { centerX, centerY, a, b, orientation: state.orientation }
}

export function matchesHyperbolaChallengeTarget(
  state: HyperbolaState,
  target: {
    kind: 'axes'
    centerX: number
    centerY: number
    a: number
    b: number
    orientation: HyperbolaOrientation
    tolerance?: number
  },
): boolean {
  const tolerance = target.tolerance ?? 0.35
  return (
    state.orientation === target.orientation &&
    Math.abs(state.centerX - target.centerX) <= tolerance &&
    Math.abs(state.centerY - target.centerY) <= tolerance &&
    Math.abs(state.a - target.a) <= tolerance &&
    Math.abs(state.b - target.b) <= tolerance
  )
}

export type HyperbolaMasteryTarget = {
  id: string
  label: string
  center?: { x: number; y: number }
  a?: number
  b?: number
  orientation?: HyperbolaOrientation
}

export function matchesHyperbolaMasteryTarget(
  state: HyperbolaState,
  target: HyperbolaMasteryTarget,
  tolerance = 0.4,
): boolean {
  const center = target.center ?? { x: 0, y: 0 }

  if (target.orientation && state.orientation !== target.orientation) return false
  if (Math.abs(state.centerX - center.x) > tolerance) return false
  if (Math.abs(state.centerY - center.y) > tolerance) return false
  if (target.a != null && Math.abs(state.a - target.a) > tolerance) return false
  if (target.b != null && Math.abs(state.b - target.b) > tolerance) return false

  return true
}
