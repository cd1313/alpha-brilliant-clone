export type EllipseState = {
  centerX: number
  centerY: number
  /** Horizontal semi-axis. */
  a: number
  /** Vertical semi-axis. */
  b: number
}

export const DEFAULT_ELLIPSE: EllipseState = {
  centerX: 0,
  centerY: 0,
  a: 4,
  b: 3,
}

const MIN_AXIS = 1
const MAX_AXIS = 6
const CENTER_X_BOUND = 5
const CENTER_Y_BOUND = 4
const MEASURED_DECIMALS = 1

export { MIN_AXIS as ELLIPSE_MIN_AXIS }
export { MAX_AXIS as ELLIPSE_MAX_AXIS }
export { CENTER_X_BOUND as ELLIPSE_CENTER_X_BOUND }
export { CENTER_Y_BOUND as ELLIPSE_CENTER_Y_BOUND }

export function roundMeasured(value: number): number {
  const factor = 10 ** MEASURED_DECIMALS
  return Math.round(value * factor) / factor
}

export function formatMeasuredValue(value: number): string {
  const rounded = roundMeasured(value)
  if (Math.abs(rounded) < 1e-6) return '0'
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(MEASURED_DECIMALS).replace(/\.?0+$/, '')
}

export type EllipseDerived = {
  c: number
  orientation: 'horizontal' | 'vertical' | 'circle'
  focus1: { x: number; y: number }
  focus2: { x: number; y: number }
  /** Semi-major axis length (the larger of a and b). */
  majorSemi: number
}

export function deriveEllipse(state: EllipseState): EllipseDerived {
  const { centerX, centerY, a, b } = state

  if (Math.abs(a - b) < 1e-6) {
    return {
      c: 0,
      orientation: 'circle',
      focus1: { x: centerX, y: centerY },
      focus2: { x: centerX, y: centerY },
      majorSemi: a,
    }
  }

  if (a > b) {
    const c = Math.sqrt(a * a - b * b)
    return {
      c,
      orientation: 'horizontal',
      focus1: { x: centerX - c, y: centerY },
      focus2: { x: centerX + c, y: centerY },
      majorSemi: a,
    }
  }

  const c = Math.sqrt(b * b - a * a)
  return {
    c,
    orientation: 'vertical',
    focus1: { x: centerX, y: centerY - c },
    focus2: { x: centerX, y: centerY + c },
    majorSemi: b,
  }
}

function shiftTerm(variable: 'x' | 'y', value: number): string {
  const v = roundMeasured(value)
  if (Math.abs(v) < 1e-6) return `${variable}²`
  const sign = v > 0 ? '−' : '+'
  return `(${variable} ${sign} ${formatMeasuredValue(Math.abs(v))})²`
}

export function formatEllipseEquation(h: number, k: number, a: number, b: number): string {
  const aSq = formatMeasuredValue(roundMeasured(a) * roundMeasured(a))
  const bSq = formatMeasuredValue(roundMeasured(b) * roundMeasured(b))
  // Dividing by 1 is redundant, so drop the "/1" for a unit semi-axis.
  const term = (numerator: string, denom: string) =>
    denom === '1' ? numerator : `${numerator}/${denom}`
  return `${term(shiftTerm('x', h), aSq)} + ${term(shiftTerm('y', k), bSq)} = 1`
}

export function pointOnEllipse(
  cx: number,
  cy: number,
  a: number,
  b: number,
  angleRad: number,
): { x: number; y: number } {
  return {
    x: cx + a * Math.cos(angleRad),
    y: cy + b * Math.sin(angleRad),
  }
}

export function distanceToPoint(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

export function clampEllipseState(state: EllipseState): EllipseState {
  const centerX = Math.max(-CENTER_X_BOUND, Math.min(CENTER_X_BOUND, state.centerX))
  const centerY = Math.max(-CENTER_Y_BOUND, Math.min(CENTER_Y_BOUND, state.centerY))
  const a = Math.max(MIN_AXIS, Math.min(MAX_AXIS, state.a))
  const b = Math.max(MIN_AXIS, Math.min(MAX_AXIS, state.b))

  return { centerX, centerY, a, b }
}

/**
 * Move a focus (the "string and pins" model): keep the major semi-axis (half the
 * fixed string length) constant and recompute the minor axis from the new focus
 * distance c. Pulling the foci apart flattens the ellipse; bringing them together
 * rounds it toward a circle. Foci stay on the major axis, symmetric about center.
 */
export function dragEllipseFocus(
  state: EllipseState,
  pointerX: number,
  pointerY: number,
): EllipseState {
  const { centerX, centerY, a, b } = state
  const horizontalMajor = a >= b
  const major = horizontalMajor ? a : b

  const maxC = Math.sqrt(Math.max(0, major * major - MIN_AXIS * MIN_AXIS))
  const rawC = horizontalMajor ? Math.abs(pointerX - centerX) : Math.abs(pointerY - centerY)
  const c = Math.min(rawC, maxC)
  const minor = Math.sqrt(Math.max(MIN_AXIS * MIN_AXIS, major * major - c * c))

  return horizontalMajor
    ? clampEllipseState({ ...state, a: major, b: minor })
    : clampEllipseState({ ...state, b: major, a: minor })
}

export function matchesEllipseChallengeTarget(
  state: EllipseState,
  target: {
    kind: 'axes'
    centerX: number
    centerY: number
    a: number
    b: number
    tolerance?: number
  },
): boolean {
  const tolerance = target.tolerance ?? 0.35
  return (
    Math.abs(state.centerX - target.centerX) <= tolerance &&
    Math.abs(state.centerY - target.centerY) <= tolerance &&
    Math.abs(state.a - target.a) <= tolerance &&
    Math.abs(state.b - target.b) <= tolerance
  )
}

export type EllipseMasteryTarget = {
  id: string
  label: string
  center?: { x: number; y: number }
  a?: number
  b?: number
}

export function matchesEllipseMasteryTarget(
  state: EllipseState,
  target: EllipseMasteryTarget,
  tolerance = 0.4,
): boolean {
  const center = target.center ?? { x: 0, y: 0 }

  if (Math.abs(state.centerX - center.x) > tolerance) return false
  if (Math.abs(state.centerY - center.y) > tolerance) return false
  if (target.a != null && Math.abs(state.a - target.a) > tolerance) return false
  if (target.b != null && Math.abs(state.b - target.b) > tolerance) return false

  return true
}
