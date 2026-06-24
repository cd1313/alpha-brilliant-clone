import type { ConicType } from '../types/lesson'

export const CONE_HEIGHT = 120
export const CONE_WIDTH = 90

/** Angle of the drawn cone edge from horizontal — matches the SVG geometry. */
export const CONE_SLOPE_ANGLE =
  (Math.atan2(CONE_HEIGHT, CONE_WIDTH) * 180) / Math.PI

export const PLANE_OFFSET_MIN = -95
export const PLANE_OFFSET_MAX = 95

const CIRCLE_TOLERANCE = 6
/** How close (degrees) the plane must be to a cone-edge generator for a parabola. */
const PARABOLA_TOLERANCE = 9
const APEX_TOLERANCE = 14
const HYPERBOLA_MARGIN = 3

export type PlaneState = {
  angle: number
  offset: number
}

export type Nappe = 'upper' | 'lower'

export type Point = { x: number; y: number }

export type PlaneCutAnalysis = {
  angle: number
  offset: number
  cutsUpper: boolean
  cutsLower: boolean
  intersectionCount: number
}

/** Keep angle in [0, 360) for storage and display. */
export function normalizePlaneAngle360(angle: number): number {
  return ((angle % 360) + 360) % 360
}

/**
 * Acute tilt from horizontal — useful for display, not sufficient alone for classification.
 */
export function acuteTiltFromHorizontal(angle: number): number {
  let tilt = normalizePlaneAngle360(angle)
  if (tilt > 180) tilt = 360 - tilt
  if (tilt > 90) tilt = 180 - tilt
  return tilt
}

/** @deprecated Use normalizePlaneAngle360 or acuteTiltFromHorizontal */
export function normalizePlaneAngle(angle: number): number {
  return acuteTiltFromHorizontal(angle)
}

export function clampPlaneOffset(offset: number): number {
  return Math.max(PLANE_OFFSET_MIN, Math.min(PLANE_OFFSET_MAX, offset))
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizePlaneAngle360(a) - normalizePlaneAngle360(b))
  return Math.min(diff, 360 - diff)
}

/**
 * Distance between two undirected line orientations. A plane at angle θ is the
 * same line as θ + 180, so a generator at e.g. 127° is parallel to a plane at
 * 307°. Folding by 180 makes both directions count as parallel.
 */
function generatorLineDistance(a: number, b: number): number {
  const diff = angularDistance(a, b)
  return Math.min(diff, 180 - diff)
}

/** Generator directions visible in the side view for each nappe. */
export function generatorAngles(nappe: Nappe): [number, number] {
  const slope = CONE_SLOPE_ANGLE
  if (nappe === 'upper') {
    return [slope, 180 - slope]
  }
  return [360 - slope, 180 + slope]
}

export function isParallelToGenerator(angleDeg: number, nappe: Nappe): boolean {
  const angle = normalizePlaneAngle360(angleDeg)
  return generatorAngles(nappe).some(
    (generator) => generatorLineDistance(angle, generator) <= PARABOLA_TOLERANCE,
  )
}

export function distanceToNearestGenerator(angleDeg: number, nappe: Nappe): number {
  const angle = normalizePlaneAngle360(angleDeg)
  return Math.min(...generatorAngles(nappe).map((g) => generatorLineDistance(angle, g)))
}

function planeDirection(angleDeg: number): Point {
  const theta = (angleDeg * Math.PI) / 180
  return { x: Math.cos(theta), y: -Math.sin(theta) }
}

function intersectRayWithEdge(
  offset: number,
  angleDeg: number,
  edge: Point,
): { s: number; t: number } | null {
  const planeOrigin = { x: 0, y: offset }
  const direction = planeDirection(angleDeg)
  const det = direction.x * edge.y - direction.y * edge.x

  if (Math.abs(det) < 1e-6) return null

  const toOrigin = { x: -planeOrigin.x, y: -planeOrigin.y }
  const t = (toOrigin.x * edge.y - toOrigin.y * edge.x) / det
  const s = (direction.x * toOrigin.y - direction.y * toOrigin.x) / det

  return { s, t }
}

export function intersectPlaneWithEdge(
  offset: number,
  angleDeg: number,
  edgeSign: 1 | -1,
  nappe: Nappe,
): Point | null {
  const edgeY = nappe === 'upper' ? -CONE_HEIGHT : CONE_HEIGHT
  const edge = { x: edgeSign * CONE_WIDTH, y: edgeY }
  const hit = intersectRayWithEdge(offset, angleDeg, edge)

  if (!hit || hit.s <= 0.01 || hit.s > 1) return null

  return { x: edge.x * hit.s, y: edge.y * hit.s }
}

export function analyzePlaneCut(offset: number, angleDeg: number): PlaneCutAnalysis {
  const angle = normalizePlaneAngle360(angleDeg)
  const clampedOffset = clampPlaneOffset(offset)

  const hits = [
    intersectPlaneWithEdge(clampedOffset, angle, 1, 'upper'),
    intersectPlaneWithEdge(clampedOffset, angle, -1, 'upper'),
    intersectPlaneWithEdge(clampedOffset, angle, 1, 'lower'),
    intersectPlaneWithEdge(clampedOffset, angle, -1, 'lower'),
  ]

  return {
    angle,
    offset: clampedOffset,
    cutsUpper: hits[0] !== null || hits[1] !== null,
    cutsLower: hits[2] !== null || hits[3] !== null,
    intersectionCount: hits.filter((hit) => hit !== null).length,
  }
}

function intendedNappe(offset: number): Nappe | null {
  if (offset < 0) return 'upper'
  if (offset > 0) return 'lower'
  return null
}

function nappeFromCuts(cutsUpper: boolean, cutsLower: boolean): Nappe | null {
  if (cutsUpper && !cutsLower) return 'upper'
  if (cutsLower && !cutsUpper) return 'lower'
  return null
}

function activeNappe(
  offset: number,
  cutsUpper: boolean,
  cutsLower: boolean,
): Nappe | null {
  return intendedNappe(offset) ?? nappeFromCuts(cutsUpper, cutsLower)
}

export function classifyConic(angle: number, offset = 0): ConicType {
  const { offset: clampedOffset, cutsUpper, cutsLower, intersectionCount } =
    analyzePlaneCut(offset, angle)

  const fullAngle = normalizePlaneAngle360(angle)
  const tilt = acuteTiltFromHorizontal(angle)
  const nearApex = Math.abs(clampedOffset) <= APEX_TOLERANCE
  const cutsBoth = cutsUpper && cutsLower
  const nappe = activeNappe(clampedOffset, cutsUpper, cutsLower)

  // A true parabola is parallel to a cone generator — check this before hyperbola
  // so near-apex / 2D side-view quirks do not steal the label.
  if (nappe && isParallelToGenerator(fullAngle, nappe)) {
    if (tilt <= CIRCLE_TOLERANCE) {
      return nearApex ? 'none' : 'circle'
    }
    return 'parabola'
  }

  if (intersectionCount === 0) {
    if (nearApex && tilt > CIRCLE_TOLERANCE && tilt > CONE_SLOPE_ANGLE + HYPERBOLA_MARGIN) {
      return 'hyperbola'
    }
    return 'none'
  }

  if (cutsBoth) {
    if (tilt <= CIRCLE_TOLERANCE) return 'none'
    if (tilt > CONE_SLOPE_ANGLE + HYPERBOLA_MARGIN) return 'hyperbola'
    return 'none'
  }

  if (nearApex && tilt > CONE_SLOPE_ANGLE + HYPERBOLA_MARGIN) {
    return 'hyperbola'
  }

  if (!nappe) {
    return 'none'
  }

  if (tilt <= CIRCLE_TOLERANCE) {
    return 'circle'
  }

  if (tilt < CONE_SLOPE_ANGLE - PARABOLA_TOLERANCE) {
    return 'ellipse'
  }

  return 'none'
}

export function conicLabel(conic: ConicType): string {
  switch (conic) {
    case 'circle':
      return 'Circle'
    case 'ellipse':
      return 'Ellipse'
    case 'parabola':
      return 'Parabola'
    case 'hyperbola':
      return 'Hyperbola'
    default:
      return 'Not Quite There'
  }
}

export function matchesTarget(angle: number, offset: number, target: ConicType): boolean {
  return classifyConic(angle, offset) === target
}
