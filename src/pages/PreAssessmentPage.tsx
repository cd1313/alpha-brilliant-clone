import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import courseData from '../content/course.json'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import {
  REVIEW_SKILLS,
  getReviewSkill,
  type ReviewSkill,
  type ReviewTopic,
} from '../lib/reviewSkills'
import { generateReviewItem, type GeneratedItem } from '../lib/reviewGenerator'
import { ReviewSession } from '../components/review/ReviewSession'
import type { AttemptResult } from '../lib/feedback'
import type { Course, CourseSection } from '../types/lesson'

const course = courseData as Course
const MAX_REFLECTIONS = 2
const PRECHECK_LENGTH = 5

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function findSkill(topic: ReviewTopic, kind: ReviewSkill['kind']): ReviewSkill | undefined {
  return REVIEW_SKILLS.find((s) => s.conic === topic && s.kind === kind)
}

/**
 * The unit's topics that the learner has NOT learned yet. A pre-assessment previews
 * upcoming content, so topics whose lesson is already completed are excluded.
 */
function unseenTopics(section: CourseSection, completedLessons: string[]): ReviewTopic[] {
  const sectionLessonIds = new Set(section.lessons.map((l) => l.id))
  const seen = new Set<ReviewTopic>()
  const topics: ReviewTopic[] = []
  for (const skill of REVIEW_SKILLS) {
    if (!sectionLessonIds.has(skill.lessonId)) continue
    if (completedLessons.includes(skill.lessonId)) continue
    if (seen.has(skill.conic)) continue
    seen.add(skill.conic)
    topics.push(skill.conic)
  }
  return topics
}

/**
 * Build a fresh, randomized 5-question pre-assessment for a unit. Questions are spread
 * across the unseen topics, cycling (and repeating, with newly generated problems) when a
 * unit has fewer than 5 topics so every pre-check is the same length. A couple of slots are
 * concept (reflection) questions; the rest are interactive graphing challenges. Every
 * problem is generated anew, so questions differ each run.
 */
function buildItems(topics: ReviewTopic[]): GeneratedItem[] {
  if (topics.length === 0) return []

  // 1-2 reflection slots, always leaving room for at least a few challenges.
  const reflectionCount = Math.min(MAX_REFLECTIONS, 1 + Math.floor(Math.random() * MAX_REFLECTIONS))
  const topicOrder = shuffle(topics)

  const items: GeneratedItem[] = []
  for (let i = 0; i < PRECHECK_LENGTH; i++) {
    const topic = topicOrder[i % topicOrder.length]
    const kind = i < reflectionCount ? 'reflection' : 'challenge'
    const skill = findSkill(topic, kind) ?? findSkill(topic, 'challenge')
    if (skill) items.push(generateReviewItem(skill))
  }
  return shuffle(items)
}

export function PreAssessmentPage() {
  const navigate = useNavigate()
  const { sectionId } = useParams<{ sectionId: string }>()
  const { user, loading: authLoading } = useAuth()
  const { userProgress, loading, markPreAssessmentDone } = useProgress(user?.uid)

  const section = course.sections.find((s) => s.id === sectionId)
  const topics = useMemo(
    () => (section ? unseenTopics(section, userProgress.completedLessons) : []),
    [section, userProgress.completedLessons],
  )

  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro')
  const [items, setItems] = useState<GeneratedItem[]>([])
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)
  // Each item is single-attempt (allowRetry=false), so the first recorded result per
  // topic is final. Keyed by the topic's challenge skill so the course map's
  // prior-knowledge badge (which reads `<topic>-challenge`) lights up either way.
  const resultsRef = useRef<Record<string, boolean>>({})

  const start = () => {
    resultsRef.current = {}
    setItems(buildItems(topics))
    setPhase('quiz')
  }

  const accumulate = useCallback((skillId: string, attempt: AttemptResult) => {
    const topic = getReviewSkill(skillId)?.conic
    const key = topic ? `${topic}-challenge` : skillId
    if (!(key in resultsRef.current)) {
      resultsRef.current[key] = attempt.correct
    }
  }, [])

  const handleFinish = useCallback(
    (correctCount: number, total: number) => {
      if (!sectionId) return
      // markPreAssessmentDone updates local state + the localStorage guard
      // synchronously before its network writes, so navigating away can't loop us back.
      void markPreAssessmentDone(sectionId, resultsRef.current)
      setResult({ score: correctCount, total })
      setPhase('result')
    },
    [sectionId, markPreAssessmentDone],
  )

  if (authLoading || !user || loading) {
    return (
      <div className="page-loading">
        <p>Loading your progress...</p>
      </div>
    )
  }

  if (!section) {
    return (
      <div className="page pre-assessment-page">
        <div className="pre-assessment-result">
          <h1>Unit not found</h1>
          <div className="pre-assessment-result-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              Back to Course Map
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Nothing new to preview (e.g. the learner already finished this unit's lessons):
  // record completion so the course map won't route here again, then move on.
  if (topics.length === 0) {
    return (
      <div className="page pre-assessment-page">
        <div className="pre-assessment-result">
          <h1>Nothing new to preview</h1>
          <p>You've already started {section.title}. Jump back in whenever you're ready.</p>
          <div className="pre-assessment-result-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void markPreAssessmentDone(section.id, {})
                navigate('/')
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'quiz') {
    return (
      <div className="page lesson-page">
        <header className="lesson-page-header">
          <Link to="/" className="back-link">← Course Map</Link>
          <h1>{section.title} pre-check</h1>
          <p className="lesson-page-subtitle">
            You haven't learned this yet — just give it your best guess. This is a preview, not a
            review, and nothing is graded. You can leave anytime and pick it up later.
          </p>
        </header>

        <ReviewSession
          items={items}
          onRecordAttempt={accumulate}
          onRestart={start}
          onFinish={handleFinish}
          title="Pre-check complete"
          showTutor={false}
          allowRetry={false}
        />
      </div>
    )
  }

  if (phase === 'result' && result) {
    return (
      <div className="page pre-assessment-page">
        <div className="pre-assessment-result">
          <h1>Pre-check complete!</h1>
          <p className="pre-assessment-score">
            {result.score} / {result.total}
          </p>
          <p>
            This previews what's coming in {section.title} and personalizes your review — nothing is
            graded and no content is skipped. Your lessons start now.
          </p>
          <div className="pre-assessment-result-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              Start learning
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page pre-assessment-page">
      <div className="pre-assessment-intro">
        <h1>{section.title} pre-check</h1>
        <p>
          Before you start {section.title}, here's a quick preview of what's coming up. You haven't
          learned this material yet, so just give it your best guess — this primes your brain and
          personalizes your review. It's a pre-assessment, not a review: nothing is graded and no
          content is skipped.
        </p>
        <div className="pre-assessment-intro-actions">
          <button type="button" className="btn btn-primary" onClick={start}>
            Start pre-check
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
