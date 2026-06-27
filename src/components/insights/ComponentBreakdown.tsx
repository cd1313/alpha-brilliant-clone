import { Link } from 'react-router-dom'
import { componentLabel, lessonForTopic } from '../../lib/learnerProfile'
import type { TopicProfile } from '../../lib/learnerProfile'
import type { ReviewTopic } from '../../lib/reviewSkills'

type ComponentBreakdownProps = {
  topics: TopicProfile[]
  limit?: number
}

type WeakRow = {
  topic: ReviewTopic
  component: string
  severity: number
}

function destinationFor(topic: ReviewTopic): string {
  const lessonId = lessonForTopic(topic)
  return lessonId ? `/lesson/${lessonId}` : '/review'
}

function rankWeakComponents(topics: TopicProfile[], limit: number): WeakRow[] {
  const rows: WeakRow[] = []
  for (const t of topics) {
    const severity = 1 - (t.mastery ?? 0)
    for (const component of t.weakComponents) {
      rows.push({ topic: t.topic, component, severity })
    }
  }
  return rows.sort((a, b) => b.severity - a.severity).slice(0, limit)
}

export function ComponentBreakdown({ topics, limit = 6 }: ComponentBreakdownProps) {
  const rows = rankWeakComponents(topics, limit)
  if (rows.length === 0) {
    return (
      <p className="insights-empty-note">
        No specific trouble spots tracked yet — keep practicing and they'll show up here.
      </p>
    )
  }

  return (
    <ul className="component-breakdown">
      {rows.map((row) => {
        const pct = Math.round(row.severity * 100)
        return (
          <li key={`${row.topic}-${row.component}`} className="component-row">
            <Link to={destinationFor(row.topic)} className="component-link">
              <span className="component-label">{componentLabel(row.topic, row.component)}</span>
              <span className="component-bar-track">
                <span className="component-bar-fill" style={{ width: `${Math.max(pct, 6)}%` }} />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
