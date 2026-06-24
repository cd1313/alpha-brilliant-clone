import { useCallback, useId, useRef, useState } from 'react'
import {
  deriveEllipse,
  distanceToPoint,
  clampEllipseState,
  dragEllipseFocus,
  formatEllipseEquation,
  formatMeasuredValue,
  pointOnEllipse,
  type EllipseState,
} from '../../lib/ellipseGeometry'

type EllipseSimulatorProps = {
  ellipse: EllipseState
  onEllipseChange: (next: EllipseState) => void
  interactive?: boolean
  /** Make the two foci draggable and show the constant-sum "string". */
  fociDraggable?: boolean
  highlightCenter?: boolean
  showAxes?: boolean
  showEquation?: boolean
  showSemiAxes?: boolean
  showFociDistance?: boolean
  hideLabels?: boolean
  centerDraggable?: boolean
  targetPoint?: { x: number; y: number }
}

const WIDTH = 520
const HEIGHT = 400
const SCALE = 36
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = HEIGHT / 2

type DragTarget = 'center' | 'a' | 'b' | 'focus' | 'demo' | null

function toSvg(x: number, y: number) {
  return { x: ORIGIN_X + x * SCALE, y: ORIGIN_Y - y * SCALE }
}

function fromSvg(svgX: number, svgY: number) {
  return {
    x: (svgX - ORIGIN_X) / SCALE,
    y: (ORIGIN_Y - svgY) / SCALE,
  }
}

export function EllipseSimulator({
  ellipse,
  onEllipseChange,
  interactive = true,
  fociDraggable = false,
  highlightCenter = false,
  showAxes = false,
  showEquation = false,
  showSemiAxes = false,
  showFociDistance = false,
  hideLabels = false,
  centerDraggable = true,
  targetPoint,
}: EllipseSimulatorProps) {
  const gridPatternId = `ellipse-grid${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const dragTargetRef = useRef<DragTarget>(null)
  const [demoAngle, setDemoAngle] = useState((3 * Math.PI) / 4)

  const { centerX, centerY, a, b } = ellipse
  const derived = deriveEllipse(ellipse)
  const centerSvg = toSvg(centerX, centerY)
  const aHandleSvg = toSvg(centerX + a, centerY)
  const bHandleSvg = toSvg(centerX, centerY + b)
  const focus1Svg = toSvg(derived.focus1.x, derived.focus1.y)
  const focus2Svg = toSvg(derived.focus2.x, derived.focus2.y)

  // Labels for the foci-distance readout (c = sqrt(major^2 - minor^2)).
  const horizontalMajor = a >= b
  const majorLabel = horizontalMajor ? 'a' : 'b'
  const minorLabel = horizontalMajor ? 'b' : 'a'

  const pathSvg =
    Array.from({ length: 81 }, (_, i) => {
      const theta = (2 * Math.PI * i) / 80
      const pt = toSvg(centerX + a * Math.cos(theta), centerY + b * Math.sin(theta))
      return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
    }).join(' ') + ' Z'

  // A draggable point on the curve: the two focal radii always sum to 2 x the
  // major semi-axis, no matter where the point or the foci sit.
  const demoPoint = pointOnEllipse(centerX, centerY, a, b, demoAngle)
  const demoSvg = toSvg(demoPoint.x, demoPoint.y)
  const sumDistances =
    distanceToPoint(demoPoint.x, demoPoint.y, derived.focus1.x, derived.focus1.y) +
    distanceToPoint(demoPoint.x, demoPoint.y, derived.focus2.x, derived.focus2.y)

  const targetSvg = targetPoint ? toSvg(targetPoint.x, targetPoint.y) : null
  const targetLabelOnLeft = targetSvg !== null && targetSvg.x > WIDTH - 90

  const equation = formatEllipseEquation(centerX, centerY, a, b)
  const showFoci = fociDraggable || derived.orientation !== 'circle'

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

  const startADrag = (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    dragTargetRef.current = 'a'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startBDrag = (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    dragTargetRef.current = 'b'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startFocusDrag = (event: React.PointerEvent) => {
    if (!interactive || !fociDraggable) return
    event.preventDefault()
    dragTargetRef.current = 'focus'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startDemoDrag = (event: React.PointerEvent) => {
    if (!interactive || !fociDraggable) return
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
      onEllipseChange(clampEllipseState({ ...ellipse, centerX: math.x, centerY: math.y }))
      return
    }

    if (target === 'a') {
      onEllipseChange(clampEllipseState({ ...ellipse, a: Math.abs(math.x - centerX) }))
      return
    }

    if (target === 'b') {
      onEllipseChange(clampEllipseState({ ...ellipse, b: Math.abs(math.y - centerY) }))
      return
    }

    if (target === 'focus') {
      onEllipseChange(dragEllipseFocus(ellipse, math.x, math.y))
      return
    }

    if (target === 'demo') {
      setDemoAngle(Math.atan2((math.y - centerY) / b, (math.x - centerX) / a))
    }
  }

  const handlePointerUp = () => {
    dragTargetRef.current = null
  }

  const xTickMin = -Math.floor(ORIGIN_X / SCALE)
  const xTickMax = Math.floor((WIDTH - ORIGIN_X) / SCALE)
  const yTickMin = -Math.floor(ORIGIN_Y / SCALE)
  const yTickMax = Math.floor((HEIGHT - ORIGIN_Y) / SCALE)

  return (
    <div className="parabola-simulator-wrap">
      {(showAxes || showEquation || showFociDistance) && (
        <div className="parabola-readouts">
          {showAxes && (
            <p className="parabola-readout">
              <strong>a</strong> = {formatMeasuredValue(a)} · <strong>b</strong> ={' '}
              {formatMeasuredValue(b)}
            </p>
          )}
          {showFociDistance && (
            <p className="parabola-readout">
              c = √({majorLabel}² − {minorLabel}²) = <strong>{formatMeasuredValue(derived.c)}</strong>
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
        aria-label="Ellipse coordinate plane"
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
          <path d={pathSvg} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
        )}

        {showSemiAxes && (
          <>
            <line
              x1={centerSvg.x}
              y1={centerSvg.y}
              x2={aHandleSvg.x}
              y2={aHandleSvg.y}
              stroke="#f59e0b"
              strokeWidth="2.5"
            />
            <line
              x1={centerSvg.x}
              y1={centerSvg.y}
              x2={bHandleSvg.x}
              y2={bHandleSvg.y}
              stroke="#0d9488"
              strokeWidth="2.5"
            />
          </>
        )}

        {showFociDistance && (
          <>
            <line
              x1={centerSvg.x}
              y1={centerSvg.y}
              x2={focus2Svg.x}
              y2={focus2Svg.y}
              stroke="#10b981"
              strokeWidth="2.5"
            />
            {!hideLabels && (
              <text
                x={(centerSvg.x + focus2Svg.x) / 2}
                y={(centerSvg.y + focus2Svg.y) / 2 - 8}
                className="parabola-label"
                fill="#10b981"
              >
                c
              </text>
            )}
          </>
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

        {fociDraggable && (
          <>
            <line
              x1={demoSvg.x}
              y1={demoSvg.y}
              x2={focus1Svg.x}
              y2={focus1Svg.y}
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <line
              x1={demoSvg.x}
              y1={demoSvg.y}
              x2={focus2Svg.x}
              y2={focus2Svg.y}
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <circle
              cx={demoSvg.x}
              cy={demoSvg.y}
              r={9}
              fill="#2563eb"
              stroke="#fff"
              strokeWidth="2"
              className="parabola-handle"
              onPointerDown={startDemoDrag}
            />
            <text x={demoSvg.x + 12} y={demoSvg.y - 10} className="parabola-label">
              d₁ + d₂ = {formatMeasuredValue(sumDistances)}
            </text>
          </>
        )}

        {showFoci && (
          <>
            <circle
              cx={focus1Svg.x}
              cy={focus1Svg.y}
              r={fociDraggable ? 9 : 4}
              fill="#0f172a"
              stroke="#fff"
              strokeWidth={fociDraggable ? 2 : 0}
              className={fociDraggable ? 'parabola-handle' : ''}
              onPointerDown={startFocusDrag}
            />
            <circle
              cx={focus2Svg.x}
              cy={focus2Svg.y}
              r={fociDraggable ? 9 : 4}
              fill="#0f172a"
              stroke="#fff"
              strokeWidth={fociDraggable ? 2 : 0}
              className={fociDraggable ? 'parabola-handle' : ''}
              onPointerDown={startFocusDrag}
            />
            {!hideLabels && (
              <>
                <text x={focus1Svg.x - 6} y={focus1Svg.y - 8} textAnchor="end" className="parabola-label">
                  F₁
                </text>
                <text x={focus2Svg.x + 8} y={focus2Svg.y - 8} className="parabola-label">
                  F₂
                </text>
              </>
            )}
          </>
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

        {interactive && (
          <circle
            cx={aHandleSvg.x}
            cy={aHandleSvg.y}
            r={9}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startADrag}
          />
        )}

        {interactive && !fociDraggable && (
          <circle
            cx={bHandleSvg.x}
            cy={bHandleSvg.y}
            r={9}
            fill="#0d9488"
            stroke="#fff"
            strokeWidth="2"
            className="parabola-handle"
            onPointerDown={startBDrag}
          />
        )}

        {!hideLabels && (
          <text x={centerSvg.x + 12} y={centerSvg.y - 8} className="parabola-label">
            Center
          </text>
        )}
        {!hideLabels && interactive && (
          <>
            <text x={aHandleSvg.x + 12} y={aHandleSvg.y - 4} className="parabola-label">
              a
            </text>
            {!fociDraggable && (
              <text x={bHandleSvg.x + 12} y={bHandleSvg.y - 4} className="parabola-label">
                b
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  )
}
