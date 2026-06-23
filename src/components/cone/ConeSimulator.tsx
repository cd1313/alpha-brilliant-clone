import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CONE_HEIGHT,
  CONE_SLOPE_ANGLE,
  CONE_WIDTH,
  PLANE_OFFSET_MAX,
  PLANE_OFFSET_MIN,
  classifyConic,
  clampPlaneOffset,
  conicLabel,
  generatorAngles,
  normalizePlaneAngle360,
  type PlaneState,
} from '../../lib/conicClassifier'
import { computeCrossSectionPath } from '../../lib/crossSectionGeometry'
import type { ConicType } from '../../types/lesson'

type ConeSimulatorProps = {
  plane: PlaneState
  onPlaneChange: (plane: PlaneState) => void
  interactive?: boolean
  showLabels?: boolean
  hideShapeLabel?: boolean
  highlightConeEdge?: boolean
  glowConic?: ConicType | null
}

const WIDTH = 520
const HEIGHT = 320
const APEX_X = 160
const APEX_Y = 160

type DragMode = 'vertical' | 'rotate' | null

export function ConeSimulator({
  plane,
  onPlaneChange,
  interactive = true,
  showLabels = false,
  hideShapeLabel = false,
  highlightConeEdge = false,
  glowConic = null,
}: ConeSimulatorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragModeRef = useRef<DragMode>(null)
  const [showLabelToggles, setShowLabelToggles] = useState({
    cone: true,
    plane: true,
    crossSection: true,
  })

  const conic = classifyConic(plane.angle, plane.offset)
  const crossCx = 400
  const crossCy = 160
  const crossSection = computeCrossSectionPath(plane, crossCx, crossCy)
  const shouldGlow = glowConic && conic === glowConic
  const displayAngle = normalizePlaneAngle360(plane.angle)
  const angleRad = (displayAngle * Math.PI) / 180
  const parabolaHintNappe = plane.offset < 0 ? 'upper' : 'lower'
  const [paraA, paraB] = generatorAngles(parabolaHintNappe).map((a) => Math.round(a))
  const planeLength = 200
  const planeDx = Math.cos(angleRad) * planeLength
  const planeDy = Math.sin(angleRad) * planeLength
  const centerY = APEX_Y + plane.offset
  const rotateHandleX = APEX_X + Math.cos(angleRad) * 70
  const rotateHandleY = centerY - Math.sin(angleRad) * 70

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    }
  }, [])

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number, mode: DragMode) => {
      const point = clientToSvg(clientX, clientY)
      if (!point || !mode) return

      if (mode === 'vertical') {
        const offset = clampPlaneOffset(point.y - APEX_Y)
        onPlaneChange({ ...plane, offset })
        return
      }

      const dx = point.x - APEX_X
      const dy = centerY - point.y
      const degrees = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
      onPlaneChange({ ...plane, angle: degrees })
    },
    [centerY, clientToSvg, onPlaneChange, plane],
  )

  useEffect(() => {
    if (!interactive) return

    const onMove = (event: PointerEvent) => {
      if (!dragModeRef.current) return
      updateFromPointer(event.clientX, event.clientY, dragModeRef.current)
    }

    const onUp = () => {
      dragModeRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [interactive, updateFromPointer])

  const handleVerticalPointerDown = (event: React.PointerEvent<SVGCircleElement>) => {
    dragModeRef.current = 'vertical'
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(event.clientX, event.clientY, 'vertical')
  }

  const handleRotatePointerDown = (event: React.PointerEvent<SVGCircleElement>) => {
    dragModeRef.current = 'rotate'
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(event.clientX, event.clientY, 'rotate')
  }

  const upperLeftX = APEX_X - CONE_WIDTH
  const upperLeftY = APEX_Y - CONE_HEIGHT
  const upperRightX = APEX_X + CONE_WIDTH
  const upperRightY = APEX_Y - CONE_HEIGHT
  const lowerLeftX = APEX_X - CONE_WIDTH
  const lowerLeftY = APEX_Y + CONE_HEIGHT
  const lowerRightX = APEX_X + CONE_WIDTH
  const lowerRightY = APEX_Y + CONE_HEIGHT

  return (
    <div className="cone-simulator">
      {showLabels && (
        <div className="label-toggles">
          {(['cone', 'plane', 'crossSection'] as const).map((key) => (
            <label key={key} className="label-toggle">
              <input
                type="checkbox"
                checked={showLabelToggles[key]}
                onChange={() =>
                  setShowLabelToggles((prev) => ({ ...prev, [key]: !prev[key] }))
                }
              />
              {key === 'crossSection' ? 'Cross Section' : key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="cone-svg"
        role="img"
        aria-label="Double cone with intersecting plane"
      >
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="var(--surface)" rx="12" />

        <line
          x1={APEX_X}
          y1={APEX_Y - CONE_HEIGHT - 10}
          x2={APEX_X}
          y2={APEX_Y + CONE_HEIGHT + 10}
          stroke="var(--border)"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />

        <g className="cone-group">
          <polygon
            points={`${APEX_X},${APEX_Y} ${upperLeftX},${upperLeftY} ${upperRightX},${upperRightY}`}
            fill="rgba(99, 102, 241, 0.2)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          <polygon
            points={`${APEX_X},${APEX_Y} ${lowerLeftX},${lowerLeftY} ${lowerRightX},${lowerRightY}`}
            fill="rgba(99, 102, 241, 0.2)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          {highlightConeEdge && (
            <line
              x1={APEX_X}
              y1={APEX_Y}
              x2={upperRightX}
              y2={upperRightY}
              stroke="var(--accent-warm)"
              strokeWidth="4"
              strokeDasharray="6 4"
            />
          )}
          {showLabels && showLabelToggles.cone && (
            <text x={APEX_X - 50} y={APEX_Y - CONE_HEIGHT - 8} className="svg-label">
              Cone
            </text>
          )}
        </g>

        <line
          x1={APEX_X - planeDx}
          y1={centerY + planeDy}
          x2={APEX_X + planeDx}
          y2={centerY - planeDy}
          stroke="var(--accent-warm)"
          strokeWidth="3"
        />
        {showLabels && showLabelToggles.plane && (
          <text x={APEX_X + planeDx * 0.35 + 8} y={centerY - planeDy * 0.35} className="svg-label">
            Plane
          </text>
        )}

        <line x1="280" y1="20" x2="280" y2="300" stroke="var(--border)" strokeDasharray="4 4" />

        <g className="cross-section-group">
          <path
            d={crossSection.path}
            fill="none"
            stroke={shouldGlow ? 'var(--success)' : crossSection.type === 'none' ? 'var(--border)' : 'var(--secondary)'}
            strokeWidth={shouldGlow ? 5 : crossSection.type === 'none' ? 2 : 3}
            strokeDasharray={crossSection.type === 'none' ? '6 4' : undefined}
            className={shouldGlow ? 'cross-section-glow' : undefined}
          />
          {showLabels && showLabelToggles.crossSection && (
            <text x={crossCx - 45} y={crossCy + 70} className="svg-label">
              Cross Section
            </text>
          )}
        </g>

        {interactive && (
          <>
            <circle
              cx={APEX_X}
              cy={centerY}
              r="16"
              fill="var(--secondary)"
              stroke="white"
              strokeWidth="2"
              className="plane-handle plane-handle-vertical"
              onPointerDown={handleVerticalPointerDown}
            />
            <text x={APEX_X + 22} y={centerY + 4} className="svg-label">
              ↕
            </text>
            <circle
              cx={rotateHandleX}
              cy={rotateHandleY}
              r="12"
              fill="var(--primary)"
              stroke="white"
              strokeWidth="2"
              className="plane-handle plane-handle-rotate"
              onPointerDown={handleRotatePointerDown}
            />
            <text x="20" y="292" className="angle-readout">
              Angle: {Math.round(displayAngle)}° · Height: {Math.round(plane.offset)} · Cone slope: {Math.round(CONE_SLOPE_ANGLE)}°
            </text>
          </>
        )}

        {!hideShapeLabel && (
          <text x={crossCx} y="36" textAnchor="middle" className="shape-label">
            {conicLabel(conic)}
          </text>
        )}
      </svg>

      {interactive && (
        <div className="plane-controls">
          <div className="angle-slider-row">
            <label htmlFor="plane-angle-slider">Rotate plane (0–360°)</label>
            <input
              id="plane-angle-slider"
              type="range"
              min="0"
              max="359"
              step="1"
              value={Math.round(displayAngle)}
              onChange={(event) =>
                onPlaneChange({ ...plane, angle: Number(event.target.value) })
              }
            />
          </div>
          <div className="angle-slider-row">
            <label htmlFor="plane-offset-slider">Move up / down</label>
            <input
              id="plane-offset-slider"
              type="range"
              min={PLANE_OFFSET_MIN}
              max={PLANE_OFFSET_MAX}
              step="1"
              value={plane.offset}
              onChange={(event) =>
                onPlaneChange({ ...plane, offset: Number(event.target.value) })
              }
            />
          </div>
          <p className="control-hint">
            Drag blue to move, purple to rotate 360°. Parabola in {parabolaHintNappe} cone: ~{paraA}° or ~{paraB}°.
          </p>
        </div>
      )}
    </div>
  )
}
