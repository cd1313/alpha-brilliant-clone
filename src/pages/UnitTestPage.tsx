import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import courseData from '../content/course.json'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import { allSectionLessonsComplete } from '../lib/course'
import { REVIEW_SKILLS } from '../lib/reviewSkills'
import { generateReviewItem, type GeneratedItem } from '../lib/reviewGenerator'
import { ReviewSession } from '../components/review/ReviewSession'
import type { Course, CourseSection } from '../types/lesson'

const course = courseData as Course

const UNIT_TEST_LENGTH = 10
const UNIT_TEST_MAX_REFLECTIONS = 2
const PASS_THRESHOLD = 9

export function UnitTestPage() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const { user } = useAuth()
  const { userProgress, loading, recordSkillAttempt, markUnitTestPassed } =
    useProgress(user?.uid)

  const [items, setItems] = useState<GeneratedItem[] | null>(null)
  const [building, setBuilding] = useState(true)
  const startedRef = useRef(false)
  const [result, setResult] = useState<{ passed: boolean; score: number; total: number } | null>(null)

  const section: CourseSection | undefined = course.sections.find((s) => s.id === sectionId)

  const allComplete = section
    ? allSectionLessonsComplete(section, userProgress.completedLessons)
    : false
  const alreadyPassed = sectionId ? userProgress.passedUnitTests.includes(sectionId) : false

  // Topics belong to this section when their prerequisite lesson is one of the
  // section's lessons. This scopes the unit test to the section's own skills.
  const sectionLessonIds = new Set((section?.lessons ?? []).map((l) => l.id))
  const sectionSkills = REVIEW_SKILLS.filter((s) => sectionLessonIds.has(s.lessonId))

  // Which topics from this section are available (lesson completed)?
  const availableTopics = [
    ...new Set(
      sectionSkills
        .filter((s) => userProgress.completedLessons.includes(s.lessonId))
        .map((s) => s.conic),
    ),
  ]

  const buildSession = useCallback(() => {
    if (availableTopics.length === 0) return
    setBuilding(true)
    setItems(null)

    // Distribute 10 items: max 2 reflections, rest challenges, spread across all topics.
    const challengeSkills = sectionSkills.filter(
      (s) => s.kind === 'challenge' && availableTopics.includes(s.conic),
    )
    const reflectionSkills = sectionSkills.filter(
      (s) => s.kind === 'reflection' && availableTopics.includes(s.conic),
    )

    const generated: GeneratedItem[] = []

    // Add 2 reflection items (one from any two available conics)
    const reflectionPicks = [...reflectionSkills].sort(() => Math.random() - 0.5).slice(0, UNIT_TEST_MAX_REFLECTIONS)
    for (const skill of reflectionPicks) {
      generated.push(generateReviewItem(skill))
    }

    // Fill the rest with challenge items, cycling through available conics
    const challengeCount = UNIT_TEST_LENGTH - generated.length
    for (let i = 0; i < challengeCount; i++) {
      const skill = challengeSkills[i % challengeSkills.length]
      generated.push(generateReviewItem(skill))
    }

    // Shuffle the full list
    generated.sort(() => Math.random() - 0.5)

    setItems(generated)
    setBuilding(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTopics.join(','), sectionId])

  useEffect(() => {
    if (loading || !user || !allComplete || startedRef.current) return
    startedRef.current = true
    buildSession()
  }, [loading, user, allComplete, buildSession])

  const handleFinish = useCallback(
    (correctCount: number, total: number) => {
      if (!sectionId) return
      const passed = correctCount >= PASS_THRESHOLD
      if (passed) markUnitTestPassed(sectionId)
      setResult({ passed, score: correctCount, total })
    },
    [sectionId, markUnitTestPassed],
  )

  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading your progress...</p>
      </div>
    )
  }

  if (!section) {
    return (
      <div className="page lesson-page">
        <div className="page-card">
          <p>Unit test not found.</p>
          <Link to="/" className="btn btn-primary">Back to Course Map</Link>
        </div>
      </div>
    )
  }

  if (!allComplete) {
    return (
      <div className="page lesson-page">
        <div className="page-card">
          <p>Complete all lessons in {section.title} before taking the unit test.</p>
          <Link to="/" className="btn btn-primary">Back to Course Map</Link>
        </div>
      </div>
    )
  }

  // Only show the "already passed" screen on a fresh revisit — never right after the learner
  // just finished a passing run (in which case `result` is set and the celebratory screen wins).
  if (alreadyPassed && !result) {
    return (
      <div className="page lesson-page">
        <div className="page-card">
          <h2>Unit Test Passed ✓</h2>
          <p>You've already passed the {section.title} unit test.</p>
          <Link to="/" className="btn btn-primary">Back to Course Map</Link>
        </div>
      </div>
    )
  }

  if (building || !items) {
    return (
      <div className="page-loading">
        <p>Building your unit test...</p>
      </div>
    )
  }

  if (result) {
    const { passed, score, total } = result
    return (
      <div className="page lesson-page">
        <header className="lesson-page-header">
          <h1>{section.title} Unit Test</h1>
        </header>
        <div className={`page-card unit-test-result ${passed ? 'unit-test-pass' : 'unit-test-fail'}`}>
          <div className="unit-test-result-icon">{passed ? '🎉' : '📚'}</div>
          <h2>{passed ? 'You passed!' : 'Not quite yet'}</h2>
          <p className="unit-test-score">
            {score} / {total} correct
          </p>
          {passed ? (
            <p className="unit-test-result-message">
              Great work — you've demonstrated mastery of {section.title}. The next section is now unlocked.
            </p>
          ) : (
            <p className="unit-test-result-message">
              You need {PASS_THRESHOLD}/{total} to pass. Review the material and try again whenever you're ready.
            </p>
          )}
          <div className="step-actions">
            {passed ? (
              <Link to="/" className="btn btn-primary">Continue to Course Map</Link>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => {
                  startedRef.current = true
                  setResult(null)
                  buildSession()
                }}>Retake Test</button>
                <Link to="/review" className="btn btn-secondary">Smart Review</Link>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page lesson-page">
      <header className="lesson-page-header">
        <Link to="/" className="back-link">← Course Map</Link>
        <h1>{section.title} Unit Test</h1>
        <p className="lesson-page-subtitle">
          Score {PASS_THRESHOLD}/{UNIT_TEST_LENGTH} or higher to pass. No hints — one attempt per question.
        </p>
      </header>

      <ReviewSession
        items={items}
        onRecordAttempt={recordSkillAttempt}
        onRestart={buildSession}
        onFinish={handleFinish}
        title="Unit test complete"
        restartLabel="Retake test"
        showTutor={false}
        allowRetry={false}
      />
    </div>
  )
}
