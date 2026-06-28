import { useCallback, useId, useRef } from 'react'
import {
  deriveUnitCircle,
  DEFAULT_UNIT_CIRCLE,
  formatCoordinate,
  formatRadians,
  normalizeAngle,
  setAngleFromPoint,
  snapToSpecialAngle,
  type UnitCircleState,
} from '../../lib/unitCircleGeometry'

type UnitCircleSimulatorProps = {
  unitCircle: UnitCircleState
  onUnitCircleChange: (next: UnitCircleState) => void
  interactive?: boolean
  showCoordinates?: boolean
  showAngle?: boolean
  showReferenceAngle?: boolean
  showLegs?: boolean
  snapSpecial?: boolean
  hideLabels?: boolean
  /** Label the initial side (positive x-axis) and terminal side (the angle's ray). */
  showSideLabels?: boolean
  /** Label the four quadrants (I-IV) in the corners. */
  showQuadrantLabels?: boolean
  targetAngle?: number
  ghost?: UnitCircleState | null
}

const WIDTH = 420
const HEIGHT = 420
const SCALE = 150
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = HEIGHT / 2

function toSvg(x: number, y: number) {
  return { x: ORIGIN_X + x * SCALE, y: ORIGIN_Y - y * SCALE }
}

function fromSvg(svgX: number, svgY: number) {
  return {
    x: (svgX - ORIGIN_X) / SCALE,
    y: (ORIGIN_Y - svgY) / SCALE,
  }
}

function arcPath(angle: number, radius: number): string {
  const normalized = normalizeAngle(angle)
  const steps = Math.max(2, Math.round((normalized / (2 * Math.PI)) * 96))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (normalized * i) / steps
    const pt = toSvg(radius * Math.cos(t), radius * Math.sin(t))
    return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
  }).join(' ')
}

export function UnitCircleSimulator({
  unitCircle,
  onUnitCircleChange,
  interactive = true,
  showCoordinates = false,
  showAngle = false,
  showReferenceAngle = false,
  showLegs = false,
  snapSpecial = false,
  hideLabels = false,
  showSideLabels = false,
  showQuadrantLabels = false,
  targetAngle,
  ghost,
}: UnitCircleSimulatorProps) {
  const gridPatternId = `uc-grid${useId().replace(/:/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef(false)

  const derived = deriveUnitCircle(unitCircle)
  const { cos, sin, referenceAngle, normalized } = derived
  const center = toSvg(0, 0)
  const point = toSvg(cos, sin)
  const refRay = toSvg(1, 0)
  const angleLabel = toSvg(0.32 * Math.cos(normalized / 2), 0.32 * Math.sin(normalized / 2))
  // Side labels: the initial side sits along +x; the terminal-side label rides the angle's
  // ray, nudged perpendicular (-sin, cos) so it clears the radius line as the angle changes.
  const initialSideLabel = toSvg(0.62, 0)
  const terminalSideLabel = toSvg(0.55 * cos - 0.18 * sin, 0.55 * sin + 0.18 * cos)
  // Quadrant numerals sit in the corners (outside the circle) so they never collide with
  // the rays, arc, or terminal point as the angle is dragged around.
  const quadrantLabels = [
    { roman: 'I', pos: toSvg(1.18, 1.18) },
    { roman: 'II', pos: toSvg(-1.18, 1.18) },
    { roman: 'III', pos: toSvg(-1.18, -1.18) },
    { roman: 'IV', pos: toSvg(1.18, -1.18) },
  ]

  const ghostPoint = ghost ? toSvg(Math.cos(ghost.angle), Math.sin(ghost.angle)) : null

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    }
  }, [])

  const startDrag = (event: React.PointerEvent) => {
    if (!interactive) return
    event.preventDefault()
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return
    const svgPoint = clientToSvg(event.clientX, event.clientY)
    if (!svgPoint) return
    const math = fromSvg(svgPoint.x, svgPoint.y)
    const next = setAngleFromPoint(math.x, math.y)
    onUnitCircleChange(snapSpecial ? { angle: snapToSpecialAngle(next.angle) } : next)
  }

  const handlePointerUp = () => {
    draggingRef.current = false
  }

  const targetSvg = targetAngle !== undefined ? toSvg(Math.cos(targetAngle), Math.sin(targetAngle)) : null

  return (
    <div className="parabola-simulator-wrap unit-circle-wrap">
      {(showCoordinates || showAngle || showReferenceAngle) && (
        <div className="parabola-readouts">
          {showAngle && (
            <p className="parabola-readout">
              <strong>θ</strong> = {formatRadians(unitCircle.angle)} ({Math.round(derived.degrees)}°)
            </p>
          )}
          {showCoordinates && (
            <p className="parabola-equation" aria-live="polite">
              (cos θ, sin θ) = ({formatCoordinate(cos)}, {formatCoordinate(sin)})
            </p>
          )}
          {showReferenceAngle && (
            <p className="parabola-readout">
              reference angle = {formatRadians(referenceAngle)}
            </p>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="parabola-simulator unit-circle-simulator"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Unit circle"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <pattern
            id={gridPatternId}
            width={SCALE / 2}
            height={SCALE / 2}
            patternUnits="userSpaceOnUse"
            x={ORIGIN_X % (SCALE / 2)}
            y={ORIGIN_Y % (SCALE / 2)}
          >
            <path d={`M ${SCALE / 2} 0 L 0 0 0 ${SCALE / 2}`} fill="none" stroke="#eef2f7" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill={`url(#${gridPatternId})`} />

        <line x1={0} y1={ORIGIN_Y} x2={WIDTH} y2={ORIGIN_Y} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={ORIGIN_X} y1={0} x2={ORIGIN_X} y2={HEIGHT} stroke="#94a3b8" strokeWidth="1.5" />

        <circle cx={center.x} cy={center.y} r={SCALE} fill="none" stroke="#2563eb" strokeWidth="2.5" />

        {/* axis unit ticks */}
        {!hideLabels && (
          <>
            <text x={toSvg(1, 0).x - 4} y={toSvg(1, 0).y - 8} className="parabola-axis-label">1</text>
            <text x={toSvg(-1, 0).x - 4} y={toSvg(-1, 0).y - 8} className="parabola-axis-label">−1</text>
            <text x={toSvg(0, 1).x + 8} y={toSvg(0, 1).y + 4} className="parabola-axis-label">1</text>
            <text x={toSvg(0, -1).x + 8} y={toSvg(0, -1).y + 4} className="parabola-axis-label">−1</text>
          </>
        )}

        {showQuadrantLabels && !hideLabels && (
          <g pointerEvents="none">
            {quadrantLabels.map(({ roman, pos }) => (
              <text
                key={roman}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="unit-circle-quadrant-label"
              >
                {roman}
              </text>
            ))}
          </g>
        )}

        {/* swept angle arc */}
        <line
          x1={center.x}
          y1={center.y}
          x2={refRay.x}
          y2={refRay.y}
          stroke="#cbd5e1"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          pointerEvents="none"
        />
        <path d={arcPath(unitCircle.angle, 0.28)} fill="none" stroke="#7c3aed" strokeWidth="2.5" className="unit-circle-arc" />
        {showAngle && !hideLabels && (
          <text x={angleLabel.x} y={angleLabel.y} textAnchor="middle" dominantBaseline="middle" className="parabola-label" fill="#7c3aed">
            θ
          </text>
        )}

        {/* sine / cosine legs */}
        {showLegs && (
          <g pointerEvents="none">
            <line x1={center.x} y1={center.y} x2={point.x} y2={center.y} stroke="#dc2626" strokeWidth="2.5" />
            <line x1={point.x} y1={center.y} x2={point.x} y2={point.y} stroke="#10b981" strokeWidth="2.5" />
            {!hideLabels && (
              <>
                <text x={(center.x + point.x) / 2} y={center.y + 16} textAnchor="middle" className="parabola-label" fill="#dc2626">
                  cos θ
                </text>
                <text x={point.x + 8} y={(center.y + point.y) / 2} className="parabola-label" fill="#10b981">
                  sin θ
                </text>
              </>
            )}
          </g>
        )}

        {/* radius to terminal point */}
        <line x1={center.x} y1={center.y} x2={point.x} y2={point.y} stroke="#1e293b" strokeWidth="2" pointerEvents="none" />

        {showSideLabels && !hideLabels && (
          <g pointerEvents="none">
            <text
              x={initialSideLabel.x}
              y={initialSideLabel.y + 18}
              textAnchor="middle"
              className="parabola-label"
              fill="#64748b"
            >
              Initial side
            </text>
            <text
              x={terminalSideLabel.x}
              y={terminalSideLabel.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="parabola-label"
              fill="#1e293b"
            >
              Terminal side
            </text>
          </g>
        )}

        {targetSvg && (
          <circle cx={targetSvg.x} cy={targetSvg.y} r={9} fill="#fff" stroke="#9333ea" strokeWidth="3" pointerEvents="none" />
        )}

        {ghostPoint && (
          <circle cx={ghostPoint.x} cy={ghostPoint.y} r={8} fill="none" stroke="#9333ea" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.6" pointerEvents="none" />
        )}

        <circle
          cx={point.x}
          cy={point.y}
          r={interactive ? 11 : 6}
          fill="#f59e0b"
          stroke="#fff"
          strokeWidth="2"
          className={interactive ? 'parabola-handle' : ''}
          onPointerDown={startDrag}
        />

        {!hideLabels && (
          <text x={point.x + 14} y={point.y - 10} className="parabola-label">
            ({formatCoordinate(cos)}, {formatCoordinate(sin)})
          </text>
        )}
      </svg>

      {interactive && (
        <div className="simulator-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onUnitCircleChange(DEFAULT_UNIT_CIRCLE)}
          >
            ↺ Reset
          </button>
        </div>
      )}
    </div>
  )
}
