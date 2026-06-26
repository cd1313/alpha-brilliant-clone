import { useCallback, useId, useRef } from 'react'
import {
  amplitudeHandleX,
  DEFAULT_TRIG_GRAPH,
  deriveTrigGraph,
  formatTrigEquation,
  roundMeasured,
  setAmplitudeFromPoint,
  setPeriodFromPoint,
  setPhaseFromPoint,
  setVerticalFromPoint,
  tangentAsymptotes,
  trigGraphPath,
  type TrigGraphState,
} from '../../lib/trigGraphGeometry'
import type { TrigFunction } from '../../types/lesson'

type TrigGraphSimulatorProps = {
  graph: TrigGraphState
  onGraphChange: (next: TrigGraphState) => void
  interactive?: boolean
  allowFunctionToggle?: boolean
  showEquation?: boolean
  showMidline?: boolean
  showPeriod?: boolean
  showAmplitude?: boolean
  horizontalOnly?: boolean
  hideLabels?: boolean
  ghost?: TrigGraphState | null
}

const WIDTH = 560
const HEIGHT = 380
const SCALE_X = 42
const SCALE_Y = 42
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = HEIGHT / 2

const X_MIN = -ORIGIN_X / SCALE_X
const X_MAX = (WIDTH - ORIGIN_X) / SCALE_X
const Y_BOUND = ORIGIN_Y / SCALE_Y

type DragTarget = 'phase' | 'period' | 'amplitude' | 'vertical' | null

function toSvg(x: number, y: number) {
  return { x: ORIGIN_X + x * SCALE_X, y: ORIGIN_Y - y * SCALE_Y }
}

function fromSvg(svgX: number, svgY: number) {
  return {
    x: (svgX - ORIGIN_X) / SCALE_X,
    y: (ORIGIN_Y - svgY) / SCALE_Y,
  }
}

function pathToSvg(state: TrigGraphState): string {
  return trigGraphPath(state, X_MIN, X_MAX, Y_BOUND)
    .replace(/([ML])\s*([-\d.]+)\s+([-\d.]+)/g, (_, cmd, x, y) => {
      const pt = toSvg(Number(x), Number(y))
      return `${cmd} ${pt.x} ${pt.y}`
    })
    .trim()
}

function piHalfLabel(k: number): string {
  if (k === 0) return '0'
  const sign = k < 0 ? '−' : ''
  const ak = Math.abs(k)
  if (ak % 2 === 0) {
    const n = ak / 2
    return `${sign}${n === 1 ? 'π' : `${n}π`}`
  }
  return `${sign}${ak === 1 ? 'π' : `${ak}π`}/2`
}

export function TrigGraphSimulator({
  graph,
  onGraphChange,
  interactive = true,
  allowFunctionToggle = false,
  showEquation = false,
  showMidline = false,
  showPeriod = false,
  showAmplitude = false,
  horizontalOnly = false,
  hideLabels = false,
  ghost,
}: TrigGraphSimulatorProps) {
  const gridPatternId = `trig-grid${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const dragTargetRef = useRef<DragTarget>(null)

  const derived = deriveTrigGraph(graph)
  const pathSvg = pathToSvg(graph)
  const ghostPathSvg = ghost ? pathToSvg(ghost) : null

  const midlineLeft = toSvg(X_MIN, graph.vertical)
  const midlineRight = toSvg(X_MAX, graph.vertical)

  const phasePoint = toSvg(graph.phase, graph.vertical)
  const periodPoint = toSvg(graph.phase + derived.period, graph.vertical)
  const ampX = amplitudeHandleX(graph)
  const ampPoint = toSvg(ampX, graph.vertical + graph.amplitude)
  const vertPoint = toSvg(X_MIN + 0.45, graph.vertical)

  const asymptotes = tangentAsymptotes(graph, X_MIN, X_MAX)

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    }
  }, [])

  const startDrag = (target: DragTarget) => (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    dragTargetRef.current = target
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const target = dragTargetRef.current
    if (!target) return
    const svgPoint = clientToSvg(event.clientX, event.clientY)
    if (!svgPoint) return
    const math = fromSvg(svgPoint.x, svgPoint.y)

    if (target === 'phase') onGraphChange(setPhaseFromPoint(graph, math.x))
    else if (target === 'period') onGraphChange(setPeriodFromPoint(graph, math.x))
    else if (target === 'amplitude') onGraphChange(setAmplitudeFromPoint(graph, math.y))
    else if (target === 'vertical') onGraphChange(setVerticalFromPoint(graph, math.y))
  }

  const handlePointerUp = () => {
    dragTargetRef.current = null
  }

  const setFn = (fn: TrigFunction) => onGraphChange({ ...graph, fn })

  const xTicks = Array.from(
    { length: Math.floor(X_MAX / (Math.PI / 2)) - Math.ceil(X_MIN / (Math.PI / 2)) + 1 },
    (_, i) => Math.ceil(X_MIN / (Math.PI / 2)) + i,
  )
  const yTicks = Array.from({ length: 2 * Math.floor(Y_BOUND) + 1 }, (_, i) => i - Math.floor(Y_BOUND))

  return (
    <div className="parabola-simulator-wrap trig-graph-wrap">
      {(showEquation || showPeriod || showAmplitude) && (
        <div className="parabola-readouts">
          {showAmplitude && (
            <p className="parabola-readout">
              <strong>amplitude</strong> = {roundMeasured(graph.amplitude)} ·{' '}
              <strong>period</strong> = {roundMeasured(derived.period)}
            </p>
          )}
          {showPeriod && !showAmplitude && (
            <p className="parabola-readout">
              <strong>period</strong> = {roundMeasured(derived.period)}
            </p>
          )}
          {showEquation && (
            <p className="parabola-equation" aria-live="polite">
              {formatTrigEquation(graph)}
            </p>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="parabola-simulator trig-graph-simulator"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Trigonometric function graph"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <pattern
            id={gridPatternId}
            width={SCALE_X}
            height={SCALE_Y}
            patternUnits="userSpaceOnUse"
            x={ORIGIN_X % SCALE_X}
            y={ORIGIN_Y % SCALE_Y}
          >
            <path d={`M ${SCALE_X} 0 L 0 0 0 ${SCALE_Y}`} fill="none" stroke="#eef2f7" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill={`url(#${gridPatternId})`} />

        <line x1={0} y1={ORIGIN_Y} x2={WIDTH} y2={ORIGIN_Y} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={ORIGIN_X} y1={0} x2={ORIGIN_X} y2={HEIGHT} stroke="#94a3b8" strokeWidth="1.5" />

        {xTicks
          .filter((k) => k !== 0)
          .map((k) => {
            const x = (k * Math.PI) / 2
            const tick = toSvg(x, 0)
            return (
              <text key={`xt-${k}`} x={tick.x} y={ORIGIN_Y + 14} textAnchor="middle" className="parabola-axis-label">
                {piHalfLabel(k)}
              </text>
            )
          })}

        {yTicks
          .filter((y) => y !== 0)
          .map((y) => {
            const tick = toSvg(0, y)
            return (
              <text key={`yt-${y}`} x={ORIGIN_X - 10} y={tick.y + 4} textAnchor="end" className="parabola-axis-label">
                {y}
              </text>
            )
          })}

        {/* tangent asymptotes */}
        {asymptotes.map((x) => {
          const top = toSvg(x, Y_BOUND)
          const bottom = toSvg(x, -Y_BOUND)
          return (
            <line
              key={`asym-${x.toFixed(2)}`}
              x1={top.x}
              y1={top.y}
              x2={bottom.x}
              y2={bottom.y}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              className="trig-asymptote"
              pointerEvents="none"
            />
          )
        })}

        {/* midline */}
        {showMidline && (
          <line
            x1={midlineLeft.x}
            y1={midlineLeft.y}
            x2={midlineRight.x}
            y2={midlineRight.y}
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="6 5"
            pointerEvents="none"
          />
        )}

        {ghostPathSvg && (
          <path d={ghostPathSvg} fill="none" stroke="#9333ea" strokeWidth="2.5" strokeDasharray="6 5" opacity="0.5" pointerEvents="none" />
        )}

        {pathSvg && <path d={pathSvg} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

        {/* vertical-shift handle */}
        {interactive && !horizontalOnly && (
          <circle
            cx={vertPoint.x}
            cy={vertPoint.y}
            r={9}
            fill="#10b981"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startDrag('vertical')}
          />
        )}

        {/* phase handle */}
        {interactive && (
          <circle
            cx={phasePoint.x}
            cy={phasePoint.y}
            r={9}
            fill="#dc2626"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startDrag('phase')}
          />
        )}

        {/* period handle */}
        {interactive && (
          <circle
            cx={periodPoint.x}
            cy={periodPoint.y}
            r={9}
            fill="#0ea5e9"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startDrag('period')}
          />
        )}

        {/* amplitude handle */}
        {interactive && !horizontalOnly && (
          <circle
            cx={ampPoint.x}
            cy={ampPoint.y}
            r={9}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startDrag('amplitude')}
          />
        )}

        {!hideLabels && interactive && (
          <>
            <text x={phasePoint.x + 10} y={phasePoint.y + 18} className="parabola-label" fill="#dc2626">
              phase
            </text>
            <text x={periodPoint.x + 10} y={periodPoint.y - 8} className="parabola-label" fill="#0ea5e9">
              period
            </text>
            {!horizontalOnly && (
              <text x={ampPoint.x + 10} y={ampPoint.y - 8} className="parabola-label" fill="#f59e0b">
                amplitude
              </text>
            )}
          </>
        )}
      </svg>

      {(allowFunctionToggle || interactive) && (
        <div className="simulator-actions">
          {allowFunctionToggle && (
            <div className="trig-fn-toggle">
              {(['sin', 'cos'] as const).map((fn) => (
                <button
                  key={fn}
                  type="button"
                  className={`btn btn-sm ${graph.fn === fn ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFn(fn)}
                >
                  {fn}
                </button>
              ))}
            </div>
          )}
          {interactive && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onGraphChange({ ...DEFAULT_TRIG_GRAPH, fn: graph.fn })}
            >
              ↺ Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
