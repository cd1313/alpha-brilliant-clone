export type ParabolaState = {
  focusX: number
  focusY: number
  directrixY: number
}

export type ParabolaDerived = {
  vertexX: number
  vertexY: number
  p: number
  opens: 'up' | 'down'
}

export const DEFAULT_PARABOLA: ParabolaState = {
  focusX: 0,
  focusY: 2,
  directrixY: -2,
}

const MIN_P = 0.1
const MAX_P = 5
/** Floor for path math only — avoids division by zero without hiding the curve. */
const RENDER_P_EPSILON = 1e-3
const MEASURED_DECIMALS = 1

export { MIN_P as PARABOLA_MIN_P }
export { MAX_P as PARABOLA_MAX_P }

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

export function deriveParabola(state: ParabolaState): ParabolaDerived {
  const vertexX = state.focusX
  const vertexY = (state.focusY + state.directrixY) / 2
  const p = Math.abs(state.focusY - vertexY)
  const opens = state.focusY > state.directrixY ? 'up' : 'down'

  return { vertexX, vertexY, p, opens }
}

export function formatParabolaEquation(h: number, k: number, p: number, opens: 'up' | 'down'): string {
  const hr = roundMeasured(h)
  const kr = roundMeasured(k)
  const pr = roundMeasured(p)
  const coeff = roundMeasured(4 * pr)

  const xTerm = Math.abs(hr) < 1e-6 ? 'x²' : `(x − ${formatMeasuredValue(hr)})²`
  const yCoeff = formatMeasuredValue(coeff)
  const yTerm = Math.abs(kr) < 1e-6 ? 'y' : `(y − ${formatMeasuredValue(kr)})`

  if (opens === 'up') {
    return `${xTerm} = ${yCoeff}${yTerm}`
  }

  return `${xTerm} = −${yCoeff}${yTerm}`
}

export function parabolaPath(
  h: number,
  k: number,
  p: number,
  opens: 'up' | 'down',
  steps = 80,
): string {
  const renderP = Math.max(p, RENDER_P_EPSILON)
  const ySpan = 11
  const xHalf = Math.min(6, Math.max(0.35, Math.sqrt(4 * renderP * ySpan)))
  const xMin = h - xHalf
  const xMax = h + xHalf

  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps
    const xShift = x - h
    const y =
      opens === 'up'
        ? k + (xShift * xShift) / (4 * renderP)
        : k - (xShift * xShift) / (4 * renderP)

    if (Math.abs(y - k) > ySpan) continue
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`)
  }

  return points.join(' ')
}

export function parabolaVisibleXHalf(p: number): number {
  const renderP = Math.max(p, RENDER_P_EPSILON)
  const ySpan = 11
  return Math.min(6, Math.max(0.35, Math.sqrt(4 * renderP * ySpan)))
}

export function pointOnParabola(
  h: number,
  k: number,
  p: number,
  opens: 'up' | 'down',
  x: number,
): { x: number; y: number } {
  const xShift = x - h
  const y =
    opens === 'up'
      ? k + (xShift * xShift) / (4 * p)
      : k - (xShift * xShift) / (4 * p)
  return { x, y }
}

export function distanceToPoint(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

export function distanceToHorizontalLine(_px: number, py: number, lineY: number): number {
  return Math.abs(py - lineY)
}

export function clampParabolaState(state: ParabolaState): ParabolaState {
  const focusX = Math.max(-5, Math.min(5, state.focusX))
  const focusY = Math.max(-4, Math.min(8, state.focusY))
  let directrixY = Math.max(-6, Math.min(6, state.directrixY))

  const derived = deriveParabola({ focusX, focusY, directrixY })
  if (derived.p < MIN_P) {
    directrixY = focusY > directrixY ? focusY - MIN_P * 2 : focusY + MIN_P * 2
  }
  if (derived.p > MAX_P) {
    directrixY = focusY > directrixY ? focusY - MAX_P * 2 : focusY + MAX_P * 2
  }

  return { focusX, focusY, directrixY }
}

export function adjustParabolaWithVertexAtOrigin(
  state: ParabolaState,
  changed: 'focus' | 'directrix',
): ParabolaState {
  let focusY = changed === 'focus' ? state.focusY : -state.directrixY

  if (Math.abs(focusY) < MIN_P) {
    focusY = focusY >= 0 ? MIN_P : -MIN_P
  } else if (Math.abs(focusY) > MAX_P) {
    focusY = focusY >= 0 ? MAX_P : -MAX_P
  }

  focusY = Math.max(-4, Math.min(8, focusY))
  if (Math.abs(focusY) < MIN_P) {
    focusY = focusY >= 0 ? MIN_P : -MIN_P
  }

  return {
    focusX: 0,
    focusY,
    directrixY: -focusY,
  }
}

export function snapParabolaVertexAtOrigin(state: ParabolaState): ParabolaState {
  const { p, opens } = deriveParabola(state)
  const clampedP = Math.max(MIN_P, Math.min(MAX_P, p))

  if (opens === 'up') {
    return {
      focusX: 0,
      focusY: clampedP,
      directrixY: -clampedP,
    }
  }

  return {
    focusX: 0,
    focusY: -clampedP,
    directrixY: clampedP,
  }
}

export function isParabolaVertexAtOrigin(state: ParabolaState, tolerance = 0.001): boolean {
  const { vertexX, vertexY } = deriveParabola(state)
  return (
    Math.abs(vertexX) <= tolerance &&
    Math.abs(vertexY) <= tolerance &&
    Math.abs(state.focusX) <= tolerance &&
    Math.abs(state.focusY + state.directrixY) <= tolerance
  )
}

export function moveVertex(
  state: ParabolaState,
  vertexX: number,
  vertexY: number,
): ParabolaState {
  const { p } = deriveParabola(state)
  const opens = state.focusY > state.directrixY ? 'up' : 'down'

  if (opens === 'up') {
    return clampParabolaState({
      focusX: vertexX,
      focusY: vertexY + p,
      directrixY: vertexY - p,
    })
  }

  return clampParabolaState({
    focusX: vertexX,
    focusY: vertexY - p,
    directrixY: vertexY + p,
  })
}

export function matchesVertexTarget(
  state: ParabolaState,
  x: number,
  y: number,
  tolerance = 0.35,
): boolean {
  const { vertexX, vertexY } = deriveParabola(state)
  return Math.abs(vertexX - x) <= tolerance && Math.abs(vertexY - y) <= tolerance
}

export function matchesFocusTarget(
  state: ParabolaState,
  vertexX: number,
  vertexY: number,
  focusX: number,
  focusY: number,
  tolerance = 0.35,
): boolean {
  const derived = deriveParabola(state)
  return (
    Math.abs(derived.vertexX - vertexX) <= tolerance &&
    Math.abs(derived.vertexY - vertexY) <= tolerance &&
    Math.abs(state.focusX - focusX) <= tolerance &&
    Math.abs(state.focusY - focusY) <= tolerance
  )
}

export type ParabolaMasteryTarget = {
  label: string
  wide?: boolean
  narrow?: boolean
  vertex?: { x: number; y: number }
  opens?: 'up' | 'down' | 'either'
}

export function matchesParabolaMasteryTarget(
  state: ParabolaState,
  target: ParabolaMasteryTarget,
  tolerance = 0.4,
): boolean {
  const derived = deriveParabola(state)
  const opens = target.opens ?? (target.vertex ? 'either' : 'up')

  if (opens === 'up' && derived.opens !== 'up') return false
  if (opens === 'down' && derived.opens !== 'down') return false
  if (target.wide && derived.p < 2.5) return false
  if (target.narrow && derived.p > 1.25) return false

  if (target.vertex) {
    if (Math.abs(derived.vertexX - target.vertex.x) > tolerance) return false
    if (Math.abs(derived.vertexY - target.vertex.y) > tolerance) return false
  }

  return true
}

export function matchesNarrowParabolaTarget(
  state: ParabolaState,
  vertexX: number,
  vertexY: number,
  maxP = 1.25,
  tolerance = 0.35,
): boolean {
  const derived = deriveParabola(state)

  if (derived.opens !== 'up') return false
  if (derived.p > maxP) return false

  return (
    Math.abs(derived.vertexX - vertexX) <= tolerance &&
    Math.abs(derived.vertexY - vertexY) <= tolerance
  )
}

export function matchesParabolaChallengeTarget(
  state: ParabolaState,
  target: {
    kind: 'vertex'
    x: number
    y: number
    tolerance?: number
  } | {
    kind: 'focus'
    vertexX: number
    vertexY: number
    focusX: number
    focusY: number
    tolerance?: number
  } | {
    kind: 'narrow'
    vertexX: number
    vertexY: number
    maxP?: number
    tolerance?: number
  },
): boolean {
  if (target.kind === 'vertex') {
    return matchesVertexTarget(state, target.x, target.y, target.tolerance)
  }

  if (target.kind === 'narrow') {
    return matchesNarrowParabolaTarget(
      state,
      target.vertexX,
      target.vertexY,
      target.maxP,
      target.tolerance,
    )
  }

  return matchesFocusTarget(
    state,
    target.vertexX,
    target.vertexY,
    target.focusX,
    target.focusY,
    target.tolerance,
  )
}

export function roundP(p: number): number {
  return roundMeasured(p)
}
