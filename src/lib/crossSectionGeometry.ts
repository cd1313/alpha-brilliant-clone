import {
  CONE_HEIGHT,
  CONE_SLOPE_ANGLE,
  CONE_WIDTH,
  acuteTiltFromHorizontal,
  classifyConic,
  intersectPlaneWithEdge,
  normalizePlaneAngle360,
  type PlaneState,
} from './coneGeometry'
import type { ConicType } from '../types/lesson'

const DISPLAY_SCALE = 52 / CONE_WIDTH
const MIN_RADIUS = 4

type Point = { x: number; y: number }

function collectIntersections(offset: number, angleDeg: number): Point[] {
  const points: Point[] = []
  for (const nappe of ['upper', 'lower'] as const) {
    for (const edgeSign of [1, -1] as const) {
      const point = intersectPlaneWithEdge(offset, angleDeg, edgeSign, nappe)
      if (point) points.push(point)
    }
  }
  return points
}

function coneRadiusAtOffset(offset: number): number {
  return (CONE_WIDTH * Math.min(Math.abs(offset), CONE_HEIGHT)) / CONE_HEIGHT
}

function ellipseRadii(offset: number, angleDeg: number): { rx: number; ry: number } {
  const nappe = offset < 0 ? 'upper' : 'lower'
  const right = intersectPlaneWithEdge(offset, angleDeg, 1, nappe)
  const left = intersectPlaneWithEdge(offset, angleDeg, -1, nappe)

  if (right && left) {
    const rx = Math.max(((right.x - left.x) / 2) * DISPLAY_SCALE, MIN_RADIUS)
    const theta = (acuteTiltFromHorizontal(angleDeg) * Math.PI) / 180
    const ry = Math.max(rx * Math.cos(theta), MIN_RADIUS * 0.6)
    return { rx, ry }
  }

  const fallback = coneRadiusAtOffset(offset) * DISPLAY_SCALE
  const theta = (acuteTiltFromHorizontal(angleDeg) * Math.PI) / 180
  return {
    rx: Math.max(fallback, MIN_RADIUS),
    ry: Math.max(fallback * Math.cos(theta), MIN_RADIUS * 0.6),
  }
}

function parabolaExtent(offset: number, angleDeg: number): number {
  const points = collectIntersections(offset, angleDeg)
  if (points.length === 0) {
    return Math.max(coneRadiusAtOffset(offset) * DISPLAY_SCALE, MIN_RADIUS * 2)
  }

  const maxX = Math.max(...points.map((p) => Math.abs(p.x)))
  const maxY = Math.max(...points.map((p) => Math.abs(p.y)))
  return Math.max(maxX, maxY * 0.6) * DISPLAY_SCALE * 1.1
}

function hyperbolaParams(offset: number, angleDeg: number): { gap: number; branch: number } {
  const tilt = acuteTiltFromHorizontal(angleDeg)
  const steepness = Math.max(tilt - CONE_SLOPE_ANGLE, 1)
  const gap = Math.max((20 - Math.abs(offset)) * 0.35 + steepness * 0.4, MIN_RADIUS)
  const points = collectIntersections(offset, angleDeg)
  const branch =
    points.length > 0
      ? Math.max(...points.map((p) => Math.hypot(p.x, p.y))) * DISPLAY_SCALE * 0.55
      : 30 + steepness

  return { gap, branch: Math.max(branch, 18) }
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`
}

function circlePath(cx: number, cy: number, r: number): string {
  return ellipsePath(cx, cy, r, r)
}

function parabolaPath(cx: number, cy: number, width: number): string {
  const w = Math.max(width, MIN_RADIUS * 2)
  return `M ${cx - w} ${cy + w * 0.55} Q ${cx} ${cy - w * 0.85} ${cx + w} ${cy + w * 0.55}`
}

function hyperbolaPath(cx: number, cy: number, gap: number, branch: number): string {
  const g = Math.max(gap, MIN_RADIUS)
  const b = Math.max(branch, 16)
  return [
    `M ${cx - g} ${cy - b} Q ${cx - g - b * 0.55} ${cy} ${cx - g - b} ${cy + b * 0.75}`,
    `M ${cx + g} ${cy - b} Q ${cx + g + b * 0.55} ${cy} ${cx + g + b} ${cy + b * 0.75}`,
  ].join(' ')
}

function nonePath(cx: number, cy: number, offset: number): string {
  const half = Math.max(12, 30 - Math.abs(offset) * 0.15)
  return `M ${cx - half} ${cy} L ${cx + half} ${cy}`
}

export function computeCrossSectionPath(
  plane: PlaneState,
  cx: number,
  cy: number,
): { path: string; type: ConicType } {
  const angle = normalizePlaneAngle360(plane.angle)
  const offset = plane.offset
  const type = classifyConic(angle, offset)

  switch (type) {
    case 'circle': {
      const r = Math.max(coneRadiusAtOffset(offset) * DISPLAY_SCALE, MIN_RADIUS)
      return { path: circlePath(cx, cy, r), type }
    }
    case 'ellipse': {
      const { rx, ry } = ellipseRadii(offset, angle)
      return { path: ellipsePath(cx, cy, rx, ry), type }
    }
    case 'parabola': {
      const width = parabolaExtent(offset, angle)
      return { path: parabolaPath(cx, cy, width), type }
    }
    case 'hyperbola': {
      const { gap, branch } = hyperbolaParams(offset, angle)
      return { path: hyperbolaPath(cx, cy, gap, branch), type }
    }
    default:
      return { path: nonePath(cx, cy, offset), type }
  }
}
