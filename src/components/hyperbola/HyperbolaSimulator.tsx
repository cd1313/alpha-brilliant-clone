import { useCallback, useId, useRef, useState } from 'react'
import {
  clampHyperbolaState,
  deriveHyperbola,
  distanceToPoint,
  formatHyperbolaEquation,
  formatMeasuredValue,
  hyperbolaBranchPaths,
  pointOnHyperbolaBranch,
  type HyperbolaState,
  type Point,
} from '../../lib/hyperbolaGeometry'

type HyperbolaSimulatorProps = {
  hyperbola: HyperbolaState
  onHyperbolaChange: (next: HyperbolaState) => void
  interactive?: boolean
  showDifferenceDemo?: boolean
  highlightVertices?: boolean
  showAsymptotes?: boolean
  showBox?: boolean
  showAxes?: boolean
  showEquation?: boolean
  hideLabels?: boolean
  centerDraggable?: boolean
  allowOrientationToggle?: boolean
}

const WIDTH = 520
const HEIGHT = 400
const SCALE = 36
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = HEIGHT / 2

type DragTarget = 'center' | 'a' | 'b' | 'demo' | null

function toSvg(x: number, y: number) {
  return { x: ORIGIN_X + x * SCALE, y: ORIGIN_Y - y * SCALE }
}

function fromSvg(svgX: number, svgY: number) {
  return {
    x: (svgX - ORIGIN_X) / SCALE,
    y: (ORIGIN_Y - svgY) / SCALE,
  }
}

function pointsToPath(points: Point[]): string {
  return points
    .map((p, i) => {
      const pt = toSvg(p.x, p.y)
      return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
    })
    .join(' ')
}

export function HyperbolaSimulator({
  hyperbola,
  onHyperbolaChange,
  interactive = true,
  showDifferenceDemo = false,
  highlightVertices = false,
  showAsymptotes = false,
  showBox = false,
  showAxes = false,
  showEquation = false,
  hideLabels = false,
  centerDraggable = true,
  allowOrientationToggle = false,
}: HyperbolaSimulatorProps) {
  const gridPatternId = `hyperbola-grid${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const dragTargetRef = useRef<DragTarget>(null)
  const [demoT, setDemoT] = useState(0.8)

  const { centerX, centerY, a, b, orientation } = hyperbola
  const derived = deriveHyperbola(hyperbola)
  const centerSvg = toSvg(centerX, centerY)
  const aHandleSvg =
    orientation === 'horizontal'
      ? toSvg(centerX + a, centerY)
      : toSvg(centerX, centerY + a)
  const bHandleSvg =
    orientation === 'horizontal'
      ? toSvg(centerX, centerY + b)
      : toSvg(centerX + b, centerY)
  const vertex1Svg = toSvg(derived.vertex1.x, derived.vertex1.y)
  const focus1Svg = toSvg(derived.focus1.x, derived.focus1.y)
  const focus2Svg = toSvg(derived.focus2.x, derived.focus2.y)

  const { branch1, branch2 } = hyperbolaBranchPaths(hyperbola)
  const branch1Path = pointsToPath(branch1)
  const branch2Path = pointsToPath(branch2)

  const slope = derived.asymptoteSlope
  const asymSpan = 8
  const asym1 = [
    toSvg(centerX - asymSpan, centerY - slope * asymSpan),
    toSvg(centerX + asymSpan, centerY + slope * asymSpan),
  ]
  const asym2 = [
    toSvg(centerX - asymSpan, centerY + slope * asymSpan),
    toSvg(centerX + asymSpan, centerY - slope * asymSpan),
  ]

  const boxHalfX = orientation === 'horizontal' ? a : b
  const boxHalfY = orientation === 'horizontal' ? b : a
  const boxTopLeft = toSvg(centerX - boxHalfX, centerY + boxHalfY)

  const demoPoint = pointOnHyperbolaBranch(hyperbola, demoT)
  const demoSvg = toSvg(demoPoint.x, demoPoint.y)
  const demoPointDraggable = interactive && showDifferenceDemo
  const diffDistances = Math.abs(
    distanceToPoint(demoPoint.x, demoPoint.y, derived.focus1.x, derived.focus1.y) -
      distanceToPoint(demoPoint.x, demoPoint.y, derived.focus2.x, derived.focus2.y),
  )

  const equation = formatHyperbolaEquation(centerX, centerY, a, b, orientation)

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
      onHyperbolaChange(clampHyperbolaState({ ...hyperbola, centerX: math.x, centerY: math.y }))
      return
    }

    if (target === 'a') {
      const next =
        orientation === 'horizontal'
          ? Math.abs(math.x - centerX)
          : Math.abs(math.y - centerY)
      onHyperbolaChange(clampHyperbolaState({ ...hyperbola, a: next }))
      return
    }

    if (target === 'b') {
      const next =
        orientation === 'horizontal'
          ? Math.abs(math.y - centerY)
          : Math.abs(math.x - centerX)
      onHyperbolaChange(clampHyperbolaState({ ...hyperbola, b: next }))
      return
    }

    if (target === 'demo') {
      const raw =
        orientation === 'horizontal' ? (math.y - centerY) / b : (math.x - centerX) / b
      setDemoT(Math.asinh(raw))
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
      {(showAxes || showEquation) && (
        <div className="parabola-readouts">
          {showAxes && (
            <p className="parabola-readout">
              <strong>a</strong> = {formatMeasuredValue(a)} · <strong>b</strong> ={' '}
              {formatMeasuredValue(b)}
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
        aria-label="Hyperbola coordinate plane"
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
            <path d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
          <clipPath id={`${gridPatternId}-clip`}>
            <rect width={WIDTH} height={HEIGHT} />
          </clipPath>
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

        <g clipPath={`url(#${gridPatternId}-clip)`}>
          {showBox && (
            <rect
              x={boxTopLeft.x}
              y={boxTopLeft.y}
              width={2 * boxHalfX * SCALE}
              height={2 * boxHalfY * SCALE}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="6 5"
            />
          )}

          {showAsymptotes && (
            <>
              <line
                x1={asym1[0].x}
                y1={asym1[0].y}
                x2={asym1[1].x}
                y2={asym1[1].y}
                stroke="#a855f7"
                strokeWidth="1.5"
                strokeDasharray="7 5"
              />
              <line
                x1={asym2[0].x}
                y1={asym2[0].y}
                x2={asym2[1].x}
                y2={asym2[1].y}
                stroke="#a855f7"
                strokeWidth="1.5"
                strokeDasharray="7 5"
              />
            </>
          )}

          <path d={branch1Path} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          <path d={branch2Path} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
        </g>

        <circle cx={focus1Svg.x} cy={focus1Svg.y} r={4} fill="#0f172a" />
        <circle cx={focus2Svg.x} cy={focus2Svg.y} r={4} fill="#0f172a" />
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

        {showDifferenceDemo && (
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
              r={demoPointDraggable ? 9 : 5}
              fill="#0f172a"
              stroke="#fff"
              strokeWidth={demoPointDraggable ? 2 : 0}
              className={demoPointDraggable ? 'parabola-handle' : ''}
              onPointerDown={startDemoDrag}
            />
            <text x={demoSvg.x + 12} y={demoSvg.y - 10} className="parabola-label">
              |d₁ − d₂| = {formatMeasuredValue(diffDistances)}
            </text>
          </>
        )}

        <circle
          cx={vertex1Svg.x}
          cy={vertex1Svg.y}
          r={highlightVertices ? 6 : 4}
          fill="#ef4444"
          stroke="#fff"
          strokeWidth="2"
        />

        {interactive && centerDraggable && (
          <circle
            cx={centerSvg.x}
            cy={centerSvg.y}
            r={6}
            fill="#dc2626"
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

        {interactive && (
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
              a (vertex)
            </text>
            <text x={bHandleSvg.x + 12} y={bHandleSvg.y - 4} className="parabola-label">
              b
            </text>
          </>
        )}
      </svg>

      {interactive && allowOrientationToggle && (
        <div className="label-toggles">
          <button
            type="button"
            className={`btn btn-sm ${orientation === 'horizontal' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onHyperbolaChange({ ...hyperbola, orientation: 'horizontal' })}
          >
            Opens left/right
          </button>
          <button
            type="button"
            className={`btn btn-sm ${orientation === 'vertical' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onHyperbolaChange({ ...hyperbola, orientation: 'vertical' })}
          >
            Opens up/down
          </button>
        </div>
      )}
    </div>
  )
}
