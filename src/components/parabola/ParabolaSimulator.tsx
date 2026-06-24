import { useCallback, useId, useRef, useState } from 'react'
import {
  adjustParabolaWithVertexAtOrigin,
  clampParabolaState,
  DEFAULT_PARABOLA,
  deriveParabola,
  distanceToHorizontalLine,
  distanceToPoint,
  formatParabolaEquation,
  formatMeasuredValue,
  moveVertex,
  PARABOLA_MIN_P,
  parabolaPath,
  parabolaVisibleXHalf,
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
  vertexAtOrigin?: boolean
  targetPoint?: { x: number; y: number }
  ghost?: ParabolaState | null
}

const WIDTH = 520
const HEIGHT = 400
const SCALE = 36
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = HEIGHT / 2

type DragTarget = 'focus' | 'directrix' | 'vertex' | 'demo' | null

function toSvg(x: number, y: number) {
  return { x: ORIGIN_X + x * SCALE, y: ORIGIN_Y - y * SCALE }
}

function fromSvg(svgX: number, svgY: number) {
  return {
    x: (svgX - ORIGIN_X) / SCALE,
    y: (ORIGIN_Y - svgY) / SCALE,
  }
}

function parabolaPathToSvg(state: ParabolaState): string {
  const { vertexX, vertexY, p, opens } = deriveParabola(state)
  return parabolaPath(vertexX, vertexY, p, opens)
    .replace(/([ML])\s*([-\d.]+)\s+([-\d.]+)/g, (_, cmd, x, y) => {
      const pt = toSvg(Number(x), Number(y))
      return `${cmd} ${pt.x} ${pt.y}`
    })
    .trim()
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
  vertexAtOrigin = false,
  targetPoint,
  ghost,
}: ParabolaSimulatorProps) {
  const gridPatternId = `parabola-grid${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const dragTargetRef = useRef<DragTarget>(null)
  const [labels, setLabels] = useState({
    focus: true,
    directrix: true,
    vertex: true,
  })
  const [demoXOverride, setDemoXOverride] = useState<number | null>(null)
  const demoPointDraggable = interactive && showDistanceDemo

  const derived = deriveParabola(parabola)
  const { vertexX, vertexY, p, opens } = derived
  const focusSvg = toSvg(parabola.focusX, parabola.focusY)
  const vertexSvg = toSvg(vertexX, vertexY)
  const directrixLeft = toSvg(-7, parabola.directrixY)
  const directrixRight = toSvg(7, parabola.directrixY)
  const pathSvg = parabolaPathToSvg(parabola)
  const ghostPathSvg = ghost ? parabolaPathToSvg(ghost) : null

  const targetSvg = targetPoint ? toSvg(targetPoint.x, targetPoint.y) : null
  const targetLabelOnLeft = targetSvg !== null && targetSvg.x > WIDTH - 90
  const demoXHalf = parabolaVisibleXHalf(p)
  const baseDemoX = vertexX + Math.min(2.5, p + 0.5)
  const demoX =
    demoXOverride === null
      ? baseDemoX
      : Math.max(vertexX - demoXHalf, Math.min(vertexX + demoXHalf, demoXOverride))
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

  const startDemoDrag = (event: React.PointerEvent) => {
    if (!demoPointDraggable) return
    event.preventDefault()
    dragTargetRef.current = 'demo'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const target = dragTargetRef.current
    if (!target) return

    const point = clientToSvg(event.clientX, event.clientY)
    if (!point) return

    const math = fromSvg(point.x, point.y)

    if (target === 'focus') {
      let focusY = math.y
      if (!vertexAtOrigin) {
        // Let the focus cross the directrix (flipping the parabola) instead of
        // sticking to it; snap across a small band so p never collapses to zero.
        const minGap = PARABOLA_MIN_P * 2
        const dir = parabola.directrixY
        if (Math.abs(focusY - dir) < minGap) {
          focusY = focusY >= dir ? dir + minGap : dir - minGap
        }
      }
      const next = {
        ...parabola,
        focusX: focusVerticalOnly || vertexAtOrigin ? 0 : math.x,
        focusY,
      }
      onParabolaChange(
        vertexAtOrigin
          ? adjustParabolaWithVertexAtOrigin(next, 'focus')
          : clampParabolaState(next),
      )
      return
    }

    if (target === 'directrix') {
      let directrixY = math.y
      if (!vertexAtOrigin) {
        // Mirror the focus behavior: allow the directrix to cross the focus.
        const minGap = PARABOLA_MIN_P * 2
        const f = parabola.focusY
        if (Math.abs(directrixY - f) < minGap) {
          directrixY = directrixY >= f ? f + minGap : f - minGap
        }
      }
      const next = {
        ...parabola,
        directrixY,
      }
      onParabolaChange(
        vertexAtOrigin
          ? adjustParabolaWithVertexAtOrigin(next, 'directrix')
          : clampParabolaState(next),
      )
      return
    }

    if (target === 'vertex') {
      onParabolaChange(moveVertex(parabola, math.x, math.y))
      return
    }

    if (target === 'demo') {
      setDemoXOverride(math.x)
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

        {targetSvg && (
          <g>
            <circle
              cx={targetSvg.x}
              cy={targetSvg.y}
              r={8}
              fill="#fff"
              stroke="#9333ea"
              strokeWidth="3"
            />
            <circle cx={targetSvg.x} cy={targetSvg.y} r={2.5} fill="#9333ea" />
            <text
              x={targetLabelOnLeft ? targetSvg.x - 12 : targetSvg.x + 12}
              y={targetSvg.y - 8}
              textAnchor={targetLabelOnLeft ? 'end' : 'start'}
              className="parabola-label"
              fill="#9333ea"
            >
              ({targetPoint!.x}, {targetPoint!.y})
            </text>
          </g>
        )}

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
            <circle
              cx={demoSvg.x}
              cy={demoSvg.y}
              r={demoPointDraggable ? 9 : 5}
              fill="#0f172a"
              stroke="#fff"
              strokeWidth={demoPointDraggable ? 2 : 0}
              className={demoPointDraggable ? 'parabola-handle' : ''}
              onPointerDown={startDemoDrag}
            />
            <text x={demoSvg.x + 12} y={demoSvg.y - 10} className="parabola-label">
              <tspan fill="#10b981">d₁ = {formatMeasuredValue(distFocus)}</tspan>
              <tspan>, </tspan>
              <tspan fill="#8b5cf6">d₂ = {formatMeasuredValue(distDirectrix)}</tspan>
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

        {ghostPathSvg && (
          <path
            d={ghostPathSvg}
            fill="none"
            stroke="#9333ea"
            strokeWidth="2.5"
            strokeDasharray="6 5"
            opacity="0.5"
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

      {interactive && (
        <div className="simulator-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onParabolaChange(DEFAULT_PARABOLA)}
          >
            ↺ Reset
          </button>
        </div>
      )}
    </div>
  )
}
