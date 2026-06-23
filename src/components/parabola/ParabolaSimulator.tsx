import { useCallback, useId, useRef, useState } from 'react'
import {
  clampParabolaState,
  deriveParabola,
  distanceToHorizontalLine,
  distanceToPoint,
  formatParabolaEquation,
  formatMeasuredValue,
  moveVertex,
  PARABOLA_MIN_P,
  parabolaPath,
  pointOnParabola,
  type ParabolaState,
} from '../../lib/parabolaGeometry'

type ParabolaSimulatorProps = {
  parabola: ParabolaState
  onParabolaChange: (next: ParabolaState) => void
  interactive?: boolean
  showDistanceDemo?: boolean
  highlightVertex?: boolean
  showParameterP?: boolean
  showEquation?: boolean
  labelToggles?: boolean
  vertexDraggable?: boolean
  hideLabels?: boolean
  focusVerticalOnly?: boolean
}

const WIDTH = 520
const HEIGHT = 400
const SCALE = 36
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = HEIGHT / 2

type DragTarget = 'focus' | 'directrix' | 'vertex' | null

function toSvg(x: number, y: number) {
  return { x: ORIGIN_X + x * SCALE, y: ORIGIN_Y - y * SCALE }
}

function fromSvg(svgX: number, svgY: number) {
  return {
    x: (svgX - ORIGIN_X) / SCALE,
    y: (ORIGIN_Y - svgY) / SCALE,
  }
}

export function ParabolaSimulator({
  parabola,
  onParabolaChange,
  interactive = true,
  showDistanceDemo = false,
  highlightVertex = false,
  showParameterP = false,
  showEquation = false,
  labelToggles = false,
  vertexDraggable = false,
  hideLabels = false,
  focusVerticalOnly = false,
}: ParabolaSimulatorProps) {
  const gridPatternId = `parabola-grid${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const dragTargetRef = useRef<DragTarget>(null)
  const [labels, setLabels] = useState({
    focus: true,
    directrix: true,
    vertex: true,
  })

  const derived = deriveParabola(parabola)
  const { vertexX, vertexY, p, opens } = derived
  const focusSvg = toSvg(parabola.focusX, parabola.focusY)
  const vertexSvg = toSvg(vertexX, vertexY)
  const directrixLeft = toSvg(-7, parabola.directrixY)
  const directrixRight = toSvg(7, parabola.directrixY)
  const pathMath = parabolaPath(vertexX, vertexY, p, opens)
  const pathSvg = pathMath
    .replace(/([ML])\s*([-\d.]+)\s+([-\d.]+)/g, (_, cmd, x, y) => {
      const pt = toSvg(Number(x), Number(y))
      return `${cmd} ${pt.x} ${pt.y}`
    })
    .trim()

  const demoX = vertexX + Math.min(2.5, p + 0.5)
  const demoPoint = pointOnParabola(vertexX, vertexY, p, opens, demoX)
  const demoSvg = toSvg(demoPoint.x, demoPoint.y)
  const distFocus = distanceToPoint(
    demoPoint.x,
    demoPoint.y,
    parabola.focusX,
    parabola.focusY,
  )
  const distDirectrix = distanceToHorizontalLine(
    demoPoint.x,
    demoPoint.y,
    parabola.directrixY,
  )

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    }
  }, [])

  const startFocusDrag = (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    dragTargetRef.current = 'focus'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startDirectrixDrag = (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    dragTargetRef.current = 'directrix'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startVertexDrag = (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    dragTargetRef.current = 'vertex'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const target = dragTargetRef.current
    if (!target) return

    const point = clientToSvg(event.clientX, event.clientY)
    if (!point) return

    const math = fromSvg(point.x, point.y)

    if (target === 'focus') {
      onParabolaChange(
        clampParabolaState({
          ...parabola,
          focusX: focusVerticalOnly ? parabola.focusX : math.x,
          focusY: math.y,
        }),
      )
      return
    }

    if (target === 'directrix') {
      onParabolaChange(
        clampParabolaState({
          ...parabola,
          directrixY: math.y,
        }),
      )
      return
    }

    if (target === 'vertex') {
      onParabolaChange(moveVertex(parabola, math.x, math.y))
    }
  }

  const handlePointerUp = () => {
    dragTargetRef.current = null
  }

  const equation = formatParabolaEquation(vertexX, vertexY, p, opens)
  const showFocusLabel = !hideLabels && (!labelToggles || labels.focus)
  const showDirectrixLabel = !hideLabels && (!labelToggles || labels.directrix)
  const showVertexLabel = !hideLabels && (!labelToggles || labels.vertex)

  const xTickMin = -Math.floor(ORIGIN_X / SCALE)
  const xTickMax = Math.floor((WIDTH - ORIGIN_X) / SCALE)
  const yTickMin = -Math.floor(ORIGIN_Y / SCALE)
  const yTickMax = Math.floor((HEIGHT - ORIGIN_Y) / SCALE)

  return (
    <div className="parabola-simulator-wrap">
      {(showParameterP || showEquation) && (
        <div className="parabola-readouts">
          {showParameterP && (
            <p className="parabola-readout">
              <strong>p</strong> = {formatMeasuredValue(p)} (vertex to focus)
            </p>
          )}
          {showEquation && (
            <p className="parabola-equation" aria-live="polite">
              {equation}
            </p>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="parabola-simulator"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Parabola coordinate plane"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <pattern
            id={gridPatternId}
            width={SCALE}
            height={SCALE}
            patternUnits="userSpaceOnUse"
            x={ORIGIN_X % SCALE}
            y={ORIGIN_Y % SCALE}
          >
            <path
              d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill={`url(#${gridPatternId})`} />

        <line
          x1={0}
          y1={ORIGIN_Y}
          x2={WIDTH}
          y2={ORIGIN_Y}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <line
          x1={ORIGIN_X}
          y1={0}
          x2={ORIGIN_X}
          y2={HEIGHT}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {Array.from({ length: xTickMax - xTickMin + 1 }, (_, i) => xTickMin + i)
          .filter((x) => x !== 0)
          .map((x) => {
            const tick = toSvg(x, 0)
            return (
              <text
                key={`xt-${x}`}
                x={tick.x}
                y={ORIGIN_Y + 14}
                textAnchor="middle"
                className="parabola-axis-label"
              >
                {x}
              </text>
            )
          })}

        {Array.from({ length: yTickMax - yTickMin + 1 }, (_, i) => yTickMin + i)
          .filter((y) => y !== 0)
          .map((y) => {
            const tick = toSvg(0, y)
            return (
              <text
                key={`yt-${y}`}
                x={ORIGIN_X - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="parabola-axis-label"
              >
                {y}
              </text>
            )
          })}

        {pathSvg && (
          <path
            d={pathSvg}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}

        <line
          x1={directrixLeft.x}
          y1={directrixLeft.y}
          x2={directrixRight.x}
          y2={directrixRight.y}
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="8 6"
        />

        {showDistanceDemo && p >= PARABOLA_MIN_P && (
          <>
            <line
              x1={demoSvg.x}
              y1={demoSvg.y}
              x2={focusSvg.x}
              y2={focusSvg.y}
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <line
              x1={demoSvg.x}
              y1={demoSvg.y}
              x2={demoSvg.x}
              y2={toSvg(demoPoint.x, parabola.directrixY).y}
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <circle cx={demoSvg.x} cy={demoSvg.y} r={5} fill="#0f172a" />
            <text x={demoSvg.x + 10} y={demoSvg.y - 8} className="parabola-label">
              d₁ = {formatMeasuredValue(distFocus)}, d₂ = {formatMeasuredValue(distDirectrix)}
            </text>
          </>
        )}

        {(highlightVertex || showVertexLabel) && (
          <circle
            cx={vertexSvg.x}
            cy={vertexSvg.y}
            r={highlightVertex ? 8 : 5}
            fill={highlightVertex ? '#ef4444' : '#64748b'}
            stroke="#fff"
            strokeWidth="2"
          />
        )}

        <circle
          cx={focusSvg.x}
          cy={focusSvg.y}
          r={interactive ? 10 : 7}
          fill="#dc2626"
          stroke="#fff"
          strokeWidth="2"
          className={interactive ? 'parabola-handle' : ''}
          onPointerDown={startFocusDrag}
        />

        {interactive && (
          <circle
            cx={directrixRight.x}
            cy={directrixRight.y}
            r={8}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startDirectrixDrag}
          />
        )}

        {vertexDraggable && interactive && (
          <circle
            cx={vertexSvg.x}
            cy={vertexSvg.y}
            r={12}
            fill="transparent"
            stroke="#2563eb"
            strokeWidth="2"
            strokeDasharray="4 3"
            className="parabola-handle"
            onPointerDown={startVertexDrag}
          />
        )}

        {showFocusLabel && (
          <text x={focusSvg.x + 12} y={focusSvg.y - 8} className="parabola-label">
            Focus
          </text>
        )}
        {showDirectrixLabel && (
          <text x={directrixRight.x - 70} y={directrixRight.y - 8} className="parabola-label">
            Directrix
          </text>
        )}
        {showVertexLabel && (
          <text x={vertexSvg.x + 10} y={vertexSvg.y + 18} className="parabola-label">
            Vertex
          </text>
        )}
      </svg>

      {labelToggles && (
        <div className="label-toggles">
          {(['focus', 'directrix', 'vertex'] as const).map((key) => (
            <label key={key} className="toggle-label">
              <input
                type="checkbox"
                checked={labels[key]}
                onChange={() => setLabels((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
