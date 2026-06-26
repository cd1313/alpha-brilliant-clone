export type CircleState = {
  centerX: number
  centerY: number
  radius: number
}

export const DEFAULT_CIRCLE: CircleState = {
  centerX: 0,
  centerY: 0,
  radius: 3,
}

const MIN_R = 0.5
const MAX_R = 9
const CENTER_X_BOUND = 6
const CENTER_Y_BOUND = 5
const MEASURED_DECIMALS = 1

export { MIN_R as CIRCLE_MIN_R }
export { MAX_R as CIRCLE_MAX_R }
export { CENTER_X_BOUND as CIRCLE_CENTER_X_BOUND }
export { CENTER_Y_BOUND as CIRCLE_CENTER_Y_BOUND }

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

export function formatCircleEquation(h: number, k: number, r: number): string {
  const hr = roundMeasured(h)
  const kr = roundMeasured(k)
  const rr = roundMeasured(r)
  const rSquared = roundMeasured(rr * rr)

  const xTerm =
    Math.abs(hr) < 1e-6 ? 'x²' : `(x ${hr > 0 ? '−' : '+'} ${formatMeasuredValue(Math.abs(hr))})²`
  const yTerm =
    Math.abs(kr) < 1e-6 ? 'y²' : `(y ${kr > 0 ? '−' : '+'} ${formatMeasuredValue(Math.abs(kr))})²`

  return `${xTerm} + ${yTerm} = ${formatMeasuredValue(rSquared)}`
}

export function circlePath(cx: number, cy: number, r: number, steps = 64): string {
  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const theta = (2 * Math.PI * i) / steps
    const x = cx + r * Math.cos(theta)
    const y = cy + r * Math.sin(theta)
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`)
  }
  return `${points.join(' ')} Z`
}

export function pointOnCircle(cx: number, cy: number, r: number, angleRad: number): {
  x: number
  y: number
} {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

export function distanceToPoint(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

export function clampCircleState(state: CircleState): CircleState {
  const centerX = Math.max(-CENTER_X_BOUND, Math.min(CENTER_X_BOUND, state.centerX))
  const centerY = Math.max(-CENTER_Y_BOUND, Math.min(CENTER_Y_BOUND, state.centerY))
  const radius = Math.max(MIN_R, Math.min(MAX_R, state.radius))

  return { centerX, centerY, radius }
}

export function moveCenter(state: CircleState, centerX: number, centerY: number): CircleState {
  return clampCircleState({ ...state, centerX, centerY })
}

export function setRadiusFromPoint(
  state: CircleState,
  pointX: number,
  pointY: number,
): CircleState {
  const radius = distanceToPoint(state.centerX, state.centerY, pointX, pointY)
  return clampCircleState({ ...state, radius })
}

export function matchesCenterTarget(
  state: CircleState,
  x: number,
  y: number,
  tolerance = 0.35,
): boolean {
  return (
    Math.abs(state.centerX - x) <= tolerance && Math.abs(state.centerY - y) <= tolerance
  )
}

export function matchesRadiusTarget(
  state: CircleState,
  centerX: number,
  centerY: number,
  radius: number,
  tolerance = 0.35,
): boolean {
  return (
    Math.abs(state.centerX - centerX) <= tolerance &&
    Math.abs(state.centerY - centerY) <= tolerance &&
    Math.abs(state.radius - radius) <= tolerance
  )
}

export function matchesSmallCircleTarget(
  state: CircleState,
  centerX: number,
  centerY: number,
  maxR: number,
  tolerance = 0.35,
): boolean {
  return (
    Math.abs(state.centerX - centerX) <= tolerance &&
    Math.abs(state.centerY - centerY) <= tolerance &&
    state.radius <= maxR + tolerance
  )
}

export type CircleMasteryTarget = {
  id: string
  label: string
  large?: boolean
  small?: boolean
  center?: { x: number; y: number }
}

export function matchesCircleMasteryTarget(
  state: CircleState,
  target: CircleMasteryTarget,
  tolerance = 0.4,
): boolean {
  const center = target.center ?? { x: 0, y: 0 }

  if (Math.abs(state.centerX - center.x) > tolerance) return false
  if (Math.abs(state.centerY - center.y) > tolerance) return false
  if (target.large && state.radius < 6) return false
  if (target.small && state.radius > 2) return false

  return true
}

export function matchesCircleChallengeTarget(
  state: CircleState,
  target:
    | { kind: 'center'; x: number; y: number; tolerance?: number }
    | {
        kind: 'radius'
        centerX: number
        centerY: number
        radius: number
        tolerance?: number
      }
    | {
        kind: 'small'
        centerX: number
        centerY: number
        maxR?: number
        tolerance?: number
      },
): boolean {
  if (target.kind === 'center') {
    return matchesCenterTarget(state, target.x, target.y, target.tolerance)
  }

  if (target.kind === 'small') {
    return matchesSmallCircleTarget(
      state,
      target.centerX,
      target.centerY,
      target.maxR ?? 2,
      target.tolerance,
    )
  }

  return matchesRadiusTarget(
    state,
    target.centerX,
    target.centerY,
    target.radius,
    target.tolerance,
  )
}

export function roundR(r: number): number {
  return roundMeasured(r)
}
