import type {
  TrigFunction,
  TrigGraphChallengeTarget,
  TrigGraphMasteryTarget,
} from '../types/lesson'

export type TrigGraphState = {
  fn: TrigFunction
  /** Vertical stretch |a|. Kept positive; reflections are taught via concept. */
  amplitude: number
  /** Horizontal stretch factor b in f(b(x − c)). */
  b: number
  /** Horizontal (phase) shift c. */
  phase: number
  /** Vertical (midline) shift d. */
  vertical: number
}

export type TrigGraphDerived = {
  period: number
  phaseShift: number
  midline: number
  max: number
  min: number
}

export const DEFAULT_TRIG_GRAPH: TrigGraphState = {
  fn: 'sin',
  amplitude: 1,
  b: 1,
  phase: 0,
  vertical: 0,
}

const MIN_AMPLITUDE = 0.5
const MAX_AMPLITUDE = 4
const MIN_B = 0.5
const MAX_B = 3
const PHASE_BOUND = Math.PI
const VERTICAL_BOUND = 3
const MEASURED_DECIMALS = 2

export function roundMeasured(value: number): number {
  const factor = 10 ** MEASURED_DECIMALS
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Period: 2π/b for sine & cosine, π/b for tangent. */
export function trigPeriod(state: TrigGraphState): number {
  const base = state.fn === 'tan' ? Math.PI : 2 * Math.PI
  return base / state.b
}

export function deriveTrigGraph(state: TrigGraphState): TrigGraphDerived {
  const period = trigPeriod(state)
  return {
    period,
    phaseShift: state.phase,
    midline: state.vertical,
    max: state.vertical + state.amplitude,
    min: state.vertical - state.amplitude,
  }
}

export function clampTrigGraphState(state: TrigGraphState): TrigGraphState {
  return {
    fn: state.fn,
    amplitude: clamp(state.amplitude, MIN_AMPLITUDE, MAX_AMPLITUDE),
    b: clamp(state.b, MIN_B, MAX_B),
    phase: clamp(state.phase, -PHASE_BOUND, PHASE_BOUND),
    vertical: clamp(state.vertical, -VERTICAL_BOUND, VERTICAL_BOUND),
  }
}

export function trigValue(state: TrigGraphState, x: number): number {
  const inner = state.b * (x - state.phase)
  let base: number
  if (state.fn === 'sin') base = Math.sin(inner)
  else if (state.fn === 'cos') base = Math.cos(inner)
  else base = Math.tan(inner)
  return state.amplitude * base + state.vertical
}

/** x at which the curve reaches its first maximum to the right of the phase anchor. */
export function amplitudeHandleX(state: TrigGraphState): number {
  if (state.fn === 'cos') return state.phase
  // sin and tan both equal d + a a quarter period after the anchor.
  return state.phase + trigPeriod(state) / 4
}

/**
 * Build an SVG-ish path string in math coordinates. Splits into multiple
 * sub-paths (extra `M` commands) at tangent asymptotes / out-of-range jumps.
 */
export function trigGraphPath(
  state: TrigGraphState,
  xMin: number,
  xMax: number,
  yBound: number,
  steps = 240,
): string {
  const commands: string[] = []
  let penDown = false
  let prevY: number | null = null

  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps
    const y = trigValue(state, x)

    const outOfRange = !Number.isFinite(y) || Math.abs(y) > yBound * 1.5
    // A large jump between samples flags an asymptote crossing (tangent).
    const bigJump = prevY !== null && Math.abs(y - prevY) > yBound

    if (outOfRange || bigJump) {
      penDown = false
      prevY = outOfRange ? null : y
      continue
    }

    commands.push(`${penDown ? 'L' : 'M'} ${x} ${y}`)
    penDown = true
    prevY = y
  }

  return commands.join(' ')
}

/** Tangent vertical asymptote x-positions within [xMin, xMax]. */
export function tangentAsymptotes(state: TrigGraphState, xMin: number, xMax: number): number[] {
  if (state.fn !== 'tan') return []
  const result: number[] = []
  // b(x − c) = π/2 + kπ  →  x = c + (π/2 + kπ)/b
  const kMin = Math.floor((state.b * (xMin - state.phase) - Math.PI / 2) / Math.PI) - 1
  const kMax = Math.ceil((state.b * (xMax - state.phase) - Math.PI / 2) / Math.PI) + 1
  for (let k = kMin; k <= kMax; k++) {
    const x = state.phase + (Math.PI / 2 + k * Math.PI) / state.b
    if (x >= xMin && x <= xMax) result.push(x)
  }
  return result
}

function formatNum(value: number): string {
  const rounded = roundMeasured(value)
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(MEASURED_DECIMALS).replace(/\.?0+$/, '')
}

/** Format a coefficient that scales π (the b factor or phase) as a clean fraction. */
function formatPiFraction(value: number): string {
  if (Math.abs(value) < 1e-9) return '0'
  const sign = value < 0 ? '−' : ''
  const ratio = Math.abs(value) / Math.PI
  const denominators = [1, 2, 3, 4, 6]
  for (const d of denominators) {
    const numerator = ratio * d
    const rounded = Math.round(numerator)
    if (Math.abs(numerator - rounded) < 1e-6 && rounded !== 0) {
      if (d === 1) return `${sign}${rounded === 1 ? 'π' : `${rounded}π`}`
      return `${sign}${rounded === 1 ? 'π' : `${rounded}π`}/${d}`
    }
  }
  return `${sign}${formatNum(Math.abs(value))}`
}

export function formatTrigEquation(state: TrigGraphState): string {
  const a = roundMeasured(state.amplitude)
  const b = roundMeasured(state.b)
  const c = roundMeasured(state.phase)
  const d = roundMeasured(state.vertical)

  const aStr = Math.abs(a - 1) < 1e-6 ? '' : formatNum(a)

  const bStr = Math.abs(b - 1) < 1e-6 ? '' : formatNum(b)
  let innerArg = 'x'
  if (Math.abs(c) > 1e-6) {
    innerArg = `(x ${c > 0 ? '−' : '+'} ${formatPiFraction(Math.abs(c))})`
  }
  const inner = bStr ? `${bStr}${innerArg}` : innerArg

  let body = `${aStr}${state.fn}(${inner})`
  if (Math.abs(d) > 1e-6) {
    body += ` ${d > 0 ? '+' : '−'} ${formatNum(Math.abs(d))}`
  }
  return `y = ${body}`
}

// --- drag mutators ----------------------------------------------------------

export function setAmplitudeFromPoint(state: TrigGraphState, pointY: number): TrigGraphState {
  return clampTrigGraphState({ ...state, amplitude: pointY - state.vertical })
}

export function setVerticalFromPoint(state: TrigGraphState, pointY: number): TrigGraphState {
  return clampTrigGraphState({ ...state, vertical: pointY })
}

export function setPhaseFromPoint(state: TrigGraphState, pointX: number): TrigGraphState {
  return clampTrigGraphState({ ...state, phase: pointX })
}

export function setPeriodFromPoint(state: TrigGraphState, pointX: number): TrigGraphState {
  const span = pointX - state.phase
  if (span <= 0.1) return state
  const base = state.fn === 'tan' ? Math.PI : 2 * Math.PI
  return clampTrigGraphState({ ...state, b: base / span })
}

// --- grading ----------------------------------------------------------------

/** Smallest difference between two phases modulo the period (curves repeat). */
function phaseDistance(state: TrigGraphState, targetPhase: number): number {
  const period = trigPeriod(state)
  let diff = (state.phase - targetPhase) % period
  if (diff > period / 2) diff -= period
  if (diff < -period / 2) diff += period
  return Math.abs(diff)
}

export function matchesTrigGraphChallengeTarget(
  state: TrigGraphState,
  target: TrigGraphChallengeTarget,
): boolean {
  const tol = target.tolerance ?? 0.25
  if (target.fn && state.fn !== target.fn) return false
  if (Math.abs(state.amplitude - target.amplitude) > tol) return false
  if (Math.abs(state.b - target.b) > Math.max(tol, 0.2)) return false
  if (Math.abs(state.vertical - target.vertical) > tol) return false
  if (phaseDistance(state, target.phase) > Math.max(tol, 0.3)) return false
  return true
}

export function matchesTrigGraphMasteryTarget(
  state: TrigGraphState,
  target: TrigGraphMasteryTarget,
  tolerance = 0.3,
): boolean {
  if (target.fn && state.fn !== target.fn) return false
  if (target.amplitude !== undefined && Math.abs(state.amplitude - target.amplitude) > tolerance) {
    return false
  }
  if (target.b !== undefined && Math.abs(state.b - target.b) > Math.max(tolerance, 0.2)) {
    return false
  }
  if (target.vertical !== undefined && Math.abs(state.vertical - target.vertical) > tolerance) {
    return false
  }
  if (target.phase !== undefined && phaseDistance(state, target.phase) > Math.max(tolerance, 0.3)) {
    return false
  }
  return true
}
