import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import {
  attemptedTopics,
  buildWeaknessProfile,
  profileLine,
  topicLabel,
} from '../lib/learnerProfile'
import type { TopicProfile } from '../lib/learnerProfile'
import { isTutorEnabled } from '../lib/ai/tutorClient'
import { requestInsights, type WeaknessInsights } from '../lib/ai/insightsClient'
import { WeaknessRadar } from '../components/insights/WeaknessRadar'
import { ComponentBreakdown } from '../components/insights/ComponentBreakdown'

/** Grounded interpretation so the overlay is useful even with AI off/erroring. */
function deterministicInsights(attempted: TopicProfile[]): WeaknessInsights {
  const ranked = [...attempted].sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
  const weakest = ranked[0]
  const strongest = ranked[ranked.length - 1]

  const parts: string[] = []
  if (strongest && (strongest.mastery ?? 0) > 0) {
    parts.push(`You're strongest on ${topicLabel(strongest.topic)}.`)
  }
  if (weakest && weakest !== strongest) {
    parts.push(`${topicLabel(weakest.topic)} needs the most attention right now.`)
  }
  const narrative = parts.join(' ') || 'Keep practicing to fill in your weakness map.'

  const plan = ranked
    .filter((t) => (t.mastery ?? 1) < 0.9)
    .slice(0, 3)
    .map((t) => ({
      action: t.weakComponents.length
        ? `Review ${t.weakComponents.join(', ')}`
        : 'Practice a few more problems',
      topic: topicLabel(t.topic),
    }))

  return { narrative, plan }
}

export function InsightsPage() {
  const { user } = useAuth()
  const { skillStats, loading, loadSkillStats } = useProgress(user?.uid)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [insights, setInsights] = useState<WeaknessInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const loadedRef = useRef(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!user || loadedRef.current) return
    loadedRef.current = true
    void loadSkillStats().finally(() => setStatsLoaded(true))
  }, [user, loadSkillStats])

  const profile = useMemo(() => buildWeaknessProfile(skillStats), [skillStats])
  const attempted = useMemo(() => attemptedTopics(profile), [profile])

  useEffect(() => {
    if (!statsLoaded || attempted.length === 0 || fetchedRef.current) return
    fetchedRef.current = true
    if (!isTutorEnabled()) return
    let cancelled = false
    setAiLoading(true)
    void requestInsights(attempted).then((res) => {
      if (cancelled) return
      setInsights(res)
      setAiLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [statsLoaded, attempted])

  const overlay = insights ?? deterministicInsights(attempted)

  const content = () => {
    if (loading || !statsLoaded) {
      return (
        <div className="page-loading">
          <p>Loading your progress...</p>
        </div>
      )
    }

    if (attempted.length === 0) {
      return (
        <div className="page-card insights-empty">
          <h2>No data yet</h2>
          <p>Complete some lessons to see your weakness map.</p>
          <Link to="/" className="btn btn-primary">
            Back to Course Map
          </Link>
        </div>
      )
    }

    return (
      <>
        <section className="insights-card" aria-label="Mastery by topic">
          <h2 className="insights-section-title">Mastery by topic</h2>
          <WeaknessRadar topics={attempted} />
        </section>

        <section className="insights-card" aria-label="Where to focus">
          <h2 className="insights-section-title">Where to focus</h2>
          <ComponentBreakdown topics={attempted} />
        </section>

        <section className="insights-card tutor-panel" aria-label="Coach interpretation">
          <div className="tutor-header">
            <span className="tutor-eyebrow">AI Insights</span>
            <h2 className="tutor-heading">What this means</h2>
          </div>

          {aiLoading ? (
            <p className="tutor-loading">
              <span className="tutor-spinner" aria-hidden="true" />
              Interpreting your results…
            </p>
          ) : (
            <>
              <p className="tutor-summary">{overlay.narrative}</p>
              {overlay.plan.length > 0 && (
                <div className="tutor-section">
                  <span className="tutor-label">Study plan</span>
                  <ul className="tutor-suggestions">
                    {overlay.plan.map((item, i) => (
                      <li key={i}>
                        <strong>{item.topic}:</strong> {item.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="tutor-section">
                <span className="tutor-label">By the numbers</span>
                <ul className="insights-numbers">
                  {attempted.map((t) => (
                    <li key={t.topic}>{profileLine(t)}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </>
    )
  }

  return (
    <div className="page insights-page">
      <header className="lesson-page-header">
        <Link to="/" className="back-link">
          ← Course Map
        </Link>
        <h1>Weakness Map</h1>
        <p className="lesson-page-subtitle">
          Where you're strong, where to focus next — measured from your own attempts
        </p>
      </header>

      {content()}
    </div>
  )
}
