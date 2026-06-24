import { useCallback, useId, useRef, useState } from 'react'
import {
  DEFAULT_CIRCLE,
  distanceToPoint,
  formatCircleEquation,
  formatMeasuredValue,
  moveCenter,
  pointOnCircle,
  setRadiusFromPoint,
  type CircleState,
} from '../../lib/circleGeometry'

type CircleSimulatorProps = {
  circle: CircleState
  onCircleChange: (next: CircleState) => void
  interactive?: boolean
  showRadiusDemo?: boolean
  highlightCenter?: boolean
  showRadius?: boolean
  showEquation?: boolean
  hideLabels?: boolean
  centerDraggable?: boolean
  targetPoint?: { x: number; y: number }
  ghost?: CircleState | null
}

const WIDTH = 520
const HEIGHT = 400
const SCALE = 36
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = HEIGHT / 2
const DEMO_ANGLE = Math.PI / 4

type DragTarget = 'center' | 'radius' | 'demo' | null

function toSvg(x: number, y: number) {
  return { x: ORIGIN_X + x * SCALE, y: ORIGIN_Y - y * SCALE }
}

function fromSvg(svgX: number, svgY: number) {
  return {
    x: (svgX - ORIGIN_X) / SCALE,
    y: (ORIGIN_Y - svgY) / SCALE,
  }
}

function circlePathStr(cx: number, cy: number, r: number): string {
  return (
    Array.from({ length: 65 }, (_, i) => {
      const theta = (2 * Math.PI * i) / 64
      const pt = toSvg(cx + r * Math.cos(theta), cy + r * Math.sin(theta))
      return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
    }).join(' ') + ' Z'
  )
}

export function CircleSimulator({
  circle,
  onCircleChange,
  interactive = true,
  showRadiusDemo = false,
  highlightCenter = false,
  showRadius = false,
  showEquation = false,
  hideLabels = false,
  centerDraggable = true,
  targetPoint,
  ghost,
}: CircleSimulatorProps) {
  const gridPatternId = `circle-grid${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const dragTargetRef = useRef<DragTarget>(null)
  const [demoAngle, setDemoAngle] = useState((3 * Math.PI) / 4)

  const { centerX, centerY, radius } = circle
  const centerSvg = toSvg(centerX, centerY)
  const radiusPoint = pointOnCircle(centerX, centerY, radius, DEMO_ANGLE)
  const radiusSvg = toSvg(radiusPoint.x, radiusPoint.y)
  const demoPoint = pointOnCircle(centerX, centerY, radius, demoAngle)
  const demoSvg = toSvg(demoPoint.x, demoPoint.y)
  const demoPointDraggable = interactive && showRadiusDemo
  const pathSvg = circlePathStr(centerX, centerY, radius)
  const ghostPath = ghost ? circlePathStr(ghost.centerX, ghost.centerY, ghost.radius) : null

  const demoDist = distanceToPoint(demoPoint.x, demoPoint.y, centerX, centerY)
  const targetSvg = targetPoint ? toSvg(targetPoint.x, targetPoint.y) : null
  const targetLabelOnLeft = targetSvg !== null && targetSvg.x > WIDTH - 90

  // Angle of the demo point measured counterclockwise from the positive x-axis.
  const TWO_PI = Math.PI * 2
  const angleNorm = ((demoAngle % TWO_PI) + TWO_PI) % TWO_PI
  const angleDeg = Math.round(angleNorm * (180 / Math.PI))
  const angleRad = (angleNorm / Math.PI).toFixed(2)
  const arcR = Math.min(radius * 0.4, 1.4)
  const refRaySvg = toSvg(centerX + radius, centerY)
  const arcSteps = Math.max(2, Math.round((angleNorm / TWO_PI) * 64))
  const arcPath = Array.from({ length: arcSteps + 1 }, (_, i) => {
    const t = (angleNorm * i) / arcSteps
    const pt = toSvg(centerX + arcR * Math.cos(t), centerY + arcR * Math.sin(t))
    return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
  }).join(' ')
  const angleLabelSvg = toSvg(
    centerX + (arcR + 0.7) * Math.cos(angleNorm / 2),
    centerY + (arcR + 0.7) * Math.sin(angleNorm / 2),
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

  const startCenterDrag = (event: React.PointerEvent) => {
    if (!interactive || !centerDraggable) return
    event.preventDefault()
    dragTargetRef.current = 'center'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startRadiusDrag = (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    dragTargetRef.current = 'radius'
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

    if (target === 'center') {
      onCircleChange(moveCenter(circle, math.x, math.y))
      return
    }

    if (target === 'demo') {
      setDemoAngle(Math.atan2(math.y - centerY, math.x - centerX))
      return
    }

    onCircleChange(setRadiusFromPoint(circle, math.x, math.y))
  }

  const handlePointerUp = () => {
    dragTargetRef.current = null
  }

  const equation = formatCircleEquation(centerX, centerY, radius)
  const xTickMin = -Math.floor(ORIGIN_X / SCALE)
  const xTickMax = Math.floor((WIDTH - ORIGIN_X) / SCALE)
  const yTickMin = -Math.floor(ORIGIN_Y / SCALE)
  const yTickMax = Math.floor((HEIGHT - ORIGIN_Y) / SCALE)

  return (
    <div className="parabola-simulator-wrap">
      {(showRadius || showEquation) && (
        <div className="parabola-readouts">
          {showRadius && (
            <p className="parabola-readout">
              <strong>r</strong> = {formatMeasuredValue(radius)} (center to circle)
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
        aria-label="Circle coordinate plane"
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

        <line x1={0} y1={ORIGIN_Y} x2={WIDTH} y2={ORIGIN_Y} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={ORIGIN_X} y1={0} x2={ORIGIN_X} y2={HEIGHT} stroke="#94a3b8" strokeWidth="1.5" />

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

        {showRadiusDemo && demoPointDraggable && (
          <g pointerEvents="none">
            <line
              x1={centerSvg.x}
              y1={centerSvg.y}
              x2={refRaySvg.x}
              y2={refRaySvg.y}
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="3 4"
            />
            <path d={arcPath} fill="none" stroke="#7c3aed" strokeWidth="2.5" />
            <text
              x={angleLabelSvg.x}
              y={angleLabelSvg.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="parabola-label"
              fill="#7c3aed"
            >
              {angleDeg}° · {angleRad}π rad
            </text>
          </g>
        )}

        {showRadiusDemo && (
          <>
            <line
              x1={centerSvg.x}
              y1={centerSvg.y}
              x2={demoSvg.x}
              y2={demoSvg.y}
              stroke="#10b981"
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
              r = {formatMeasuredValue(demoDist)}
            </text>
          </>
        )}

        {interactive && !showRadiusDemo && (
          <line
            x1={centerSvg.x}
            y1={centerSvg.y}
            x2={radiusSvg.x}
            y2={radiusSvg.y}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            pointerEvents="none"
          />
        )}

        {ghostPath && (
          <path
            d={ghostPath}
            fill="none"
            stroke="#9333ea"
            strokeWidth="2.5"
            strokeDasharray="6 5"
            opacity="0.5"
            pointerEvents="none"
          />
        )}

        {interactive && centerDraggable && (
          <circle
            cx={centerSvg.x}
            cy={centerSvg.y}
            r={highlightCenter ? 8 : 6}
            fill={highlightCenter ? '#ef4444' : '#dc2626'}
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startCenterDrag}
          />
        )}

        {!(interactive && centerDraggable) && !hideLabels && (
          <circle
            cx={centerSvg.x}
            cy={centerSvg.y}
            r={highlightCenter ? 6 : 4}
            fill={highlightCenter ? '#ef4444' : '#dc2626'}
            stroke="#fff"
            strokeWidth="2"
            pointerEvents="none"
          />
        )}

        {interactive && (
          <circle
            cx={radiusSvg.x}
            cy={radiusSvg.y}
            r={10}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startRadiusDrag}
          />
        )}

        {!hideLabels && (
          <text x={centerSvg.x + 12} y={centerSvg.y - 8} className="parabola-label">
            Center
          </text>
        )}
        {!hideLabels && interactive && (
          <text x={radiusSvg.x + 12} y={radiusSvg.y - 4} className="parabola-label">
            Radius
          </text>
        )}
      </svg>

      {interactive && (
        <div className="simulator-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onCircleChange(DEFAULT_CIRCLE)}
          >
            ↺ Reset
          </button>
        </div>
      )}
    </div>
  )
}
