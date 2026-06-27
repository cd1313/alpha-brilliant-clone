import type {
  Quadrant,
  UnitCircleChallengeTarget,
  UnitCircleMasteryTarget,
} from '../types/lesson'

export type UnitCircleState = {
  /** Terminal-side angle in radians, measured counterclockwise from +x. */
  angle: number
}

export type UnitCircleDerived = {
  cos: number
  sin: number
  degrees: number
  /** Normalized angle in [0, 2π). */
  normalized: number
  quadrant: Quadrant | null
  /** Reference angle in radians, always in [0, π/2]. */
  referenceAngle: number
}

export const DEFAULT_UNIT_CIRCLE: UnitCircleState = {
  angle: Math.PI / 6,
}

const TWO_PI = Math.PI * 2
const MEASURED_DECIMALS = 2

/** Common special angles (radians) to snap to: multiples of π/6 and π/4. */
const SPECIAL_ANGLES: number[] = (() => {
  const set = new Set<number>()
  for (let i = 0; i < 12; i++) set.add((i * Math.PI) / 6)
  for (let i = 0; i < 8; i++) set.add((i * Math.PI) / 4)
  return [...set].sort((a, b) => a - b)
})()

export function roundMeasured(value: number): number {
  const factor = 10 ** MEASURED_DECIMALS
  return Math.round(value * factor) / factor
}

/** Normalize any angle into [0, 2π). */
export function normalizeAngle(angle: number): number {
  const mod = angle % TWO_PI
  return mod < 0 ? mod + TWO_PI : mod
}

export function deriveUnitCircle(state: UnitCircleState): UnitCircleDerived {
  const normalized = normalizeAngle(state.angle)
  const cos = Math.cos(normalized)
  const sin = Math.sin(normalized)
  const degrees = (normalized * 180) / Math.PI

  let quadrant: Quadrant | null = null
  const onAxis = Math.abs(cos) < 1e-9 || Math.abs(sin) < 1e-9
  if (!onAxis) {
    if (cos > 0 && sin > 0) quadrant = 1
    else if (cos < 0 && sin > 0) quadrant = 2
    else if (cos < 0 && sin < 0) quadrant = 3
    else quadrant = 4
  }

  // Reference angle: acute angle to the x-axis.
  let referenceAngle = normalized
  if (normalized > Math.PI / 2 && normalized <= Math.PI) referenceAngle = Math.PI - normalized
  else if (normalized > Math.PI && normalized <= (3 * Math.PI) / 2) referenceAngle = normalized - Math.PI
  else if (normalized > (3 * Math.PI) / 2) referenceAngle = TWO_PI - normalized

  return { cos, sin, degrees, normalized, quadrant, referenceAngle }
}

export function clampAngle(angle: number): number {
  return normalizeAngle(angle)
}

/** Snap an angle to the nearest special angle when within `threshold` radians. */
export function snapToSpecialAngle(angle: number, threshold = 0.16): number {
  const normalized = normalizeAngle(angle)
  let best = normalized
  let bestDist = Infinity
  for (const special of SPECIAL_ANGLES) {
    // Account for wraparound near 2π ≈ 0.
    const dist = Math.min(
      Math.abs(normalized - special),
      Math.abs(normalized - special - TWO_PI),
      Math.abs(normalized - special + TWO_PI),
    )
    if (dist < bestDist) {
      bestDist = dist
      best = special
    }
  }
  return bestDist <= threshold ? normalizeAngle(best) : normalized
}

/** Format a multiple-of-π angle as a clean fraction string, e.g. "5π/6". */
export function formatRadians(angle: number): string {
  const normalized = normalizeAngle(angle)
  if (Math.abs(normalized) < 1e-9) return '0'

  const ratio = normalized / Math.PI // angle = ratio·π
  const denominators = [1, 2, 3, 4, 6]
  for (const d of denominators) {
    const numerator = ratio * d
    const rounded = Math.round(numerator)
    if (Math.abs(numerator - rounded) < 1e-6 && rounded !== 0) {
      const num = rounded
      if (d === 1) return num === 1 ? 'π' : `${num}π`
      return num === 1 ? `π/${d}` : `${num}π/${d}`
    }
  }
  return `${roundMeasured(normalized)} rad`
}

export function formatCoordinate(value: number): string {
  const rounded = roundMeasured(value)
  if (Math.abs(rounded) < 1e-6) return '0'
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(MEASURED_DECIMALS).replace(/\.?0+$/, '')
}

export function setAngleFromPoint(x: number, y: number): UnitCircleState {
  return { angle: normalizeAngle(Math.atan2(y, x)) }
}

/** Shortest angular distance between two angles (radians, in [0, π]). */
function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % TWO_PI
  return diff > Math.PI ? TWO_PI - diff : diff
}

export function matchesAngleTarget(
  state: UnitCircleState,
  angle: number,
  tolerance = 0.12,
): boolean {
  return angularDistance(state.angle, angle) <= tolerance
}

export function matchesCoordinateTarget(
  state: UnitCircleState,
  cos: number,
  sin: number,
  tolerance = 0.08,
): boolean {
  const derived = deriveUnitCircle(state)
  return Math.abs(derived.cos - cos) <= tolerance && Math.abs(derived.sin - sin) <= tolerance
}

export function matchesQuadrantTarget(state: UnitCircleState, quadrant: Quadrant): boolean {
  return deriveUnitCircle(state).quadrant === quadrant
}

export function matchesUnitCircleChallengeTarget(
  state: UnitCircleState,
  target: UnitCircleChallengeTarget,
): boolean {
  switch (target.kind) {
    case 'angle':
      return matchesAngleTarget(state, target.angle, target.tolerance)
    case 'coordinate':
      return matchesCoordinateTarget(state, target.cos, target.sin, target.tolerance)
    case 'quadrant':
      return matchesQuadrantTarget(state, target.quadrant)
  }
}

export function matchesUnitCircleMasteryTarget(
  state: UnitCircleState,
  target: UnitCircleMasteryTarget,
  tolerance = 0.14,
): boolean {
  if (target.angle !== undefined && !matchesAngleTarget(state, target.angle, tolerance)) {
    return false
  }
  if (target.quadrant !== undefined && !matchesQuadrantTarget(state, target.quadrant)) {
    return false
  }
  return true
}
