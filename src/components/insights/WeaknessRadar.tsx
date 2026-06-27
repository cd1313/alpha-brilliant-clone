import { topicLabel } from '../../lib/learnerProfile'
import type { TopicProfile } from '../../lib/learnerProfile'

type WeaknessRadarProps = {
  topics: TopicProfile[]
}

const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 68
const RINGS = [0.25, 0.5, 0.75, 1]

type Axis = {
  label: string
  value: number
}

function toAxes(topics: TopicProfile[]): Axis[] {
  return topics.map((t) => ({ label: topicLabel(t.topic), value: t.mastery ?? 0 }))
}

function pointOnAxis(index: number, count: number, fraction: number): [number, number] {
  const angle = -Math.PI / 2 + (index / count) * 2 * Math.PI
  return [CENTER + RADIUS * fraction * Math.cos(angle), CENTER + RADIUS * fraction * Math.sin(angle)]
}

function polygonPoints(axes: Axis[], fraction: number | 'value'): string {
  return axes
    .map((axis, i) => {
      const f = fraction === 'value' ? axis.value : fraction
      const [x, y] = pointOnAxis(i, axes.length, f)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Fallback for 1-2 attempted topics, where a polygon would be degenerate. */
function MasteryBars({ topics }: WeaknessRadarProps) {
  return (
    <div className="weakness-bars" role="img" aria-label="Topic mastery">
      {topics.map((t) => {
        const pct = Math.round((t.mastery ?? 0) * 100)
        return (
          <div key={t.topic} className="weakness-bar-row">
            <span className="weakness-bar-label">{topicLabel(t.topic)}</span>
            <div className="weakness-bar-track">
              <div className="weakness-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="weakness-bar-value">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

export function WeaknessRadar({ topics }: WeaknessRadarProps) {
  if (topics.length === 0) return null
  if (topics.length < 3) return <MasteryBars topics={topics} />

  const axes = toAxes(topics)
  const label = `Mastery radar across ${axes.map((a) => a.label).join(', ')}`

  return (
    <svg
      className="weakness-radar"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
    >
      {RINGS.map((ring) => (
        <polygon key={ring} className="weakness-radar-ring" points={polygonPoints(axes, ring)} />
      ))}

      {axes.map((axis, i) => {
        const [x, y] = pointOnAxis(i, axes.length, 1)
        return <line key={`spoke-${axis.label}`} className="weakness-radar-spoke" x1={CENTER} y1={CENTER} x2={x} y2={y} />
      })}

      <polygon className="weakness-radar-area" points={polygonPoints(axes, 'value')} />

      {axes.map((axis, i) => {
        const [x, y] = pointOnAxis(i, axes.length, axis.value)
        return <circle key={`pt-${axis.label}`} className="weakness-radar-point" cx={x} cy={y} r={3.5} />
      })}

      {axes.map((axis, i) => {
        const [x, y] = pointOnAxis(i, axes.length, 1.16)
        const anchor = x < CENTER - 4 ? 'end' : x > CENTER + 4 ? 'start' : 'middle'
        return (
          <text key={`label-${axis.label}`} className="weakness-radar-label" x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
            {axis.label}
          </text>
        )
      })}
    </svg>
  )
}
