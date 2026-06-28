import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import courseData from '../content/course.json'
import { getLesson } from '../lib/lessons'
import { allSectionLessonsComplete, getCourseLessons, getNextLessonId, isLessonUnlocked, sectionHasUnitTest } from '../lib/course'
import { availableReviewSkills, getPracticeSkill } from '../lib/reviewSkills'
import { dailyReviewRequired } from '../lib/reviewGate'
import { effectiveStreak } from '../lib/dates'
import { LessonIcon } from '../components/course/LessonIcon'
import { useAuth } from '../hooks/useAuth'
import { useAiEnabledControls } from '../hooks/useAiEnabled'
import { useProgress } from '../hooks/useProgress'
import { isPreCheckDone, preCheckRequired } from '../lib/preAssessment'
import type { Course } from '../types/lesson'

const course = courseData as Course
const allLessons = getCourseLessons(course)

// Pre-assessment topics map to a lesson's challenge skill so the course map can
// surface a "Prior knowledge" hint where the pre-check was answered correctly.
const lessonPriorSkill: Record<string, string> = {
  circles: 'circle-challenge',
  parabolas: 'parabola-challenge',
  ellipses: 'ellipse-challenge',
  hyperbolas: 'hyperbola-challenge',
  'trig-angles': 'unit-circle-challenge',
}

function unlockHint(lessonId: string): string | null {
  const entry = allLessons.find((l) => l.id === lessonId)
  if (!entry?.unlockAfter) return null
  const prerequisite = allLessons.find((l) => l.id === entry.unlockAfter)
  return prerequisite ? `Complete "${prerequisite.title}" to unlock` : null
}

export function CourseMapPage() {
  const { user, logOut, loading: authLoading } = useAuth()
  const { aiEnabled, setAiEnabled } = useAiEnabledControls()
  const { userProgress, skillStats, loading, error, loadSkillStats } = useProgress(user?.uid)
  const nextLessonId = getNextLessonId(course, userProgress.completedLessons, userProgress.passedUnitTests)
  const statsLoadedRef = useRef(false)

  useEffect(() => {
    if (!user || statsLoadedRef.current) return
    statsLoadedRef.current = true
    void loadSkillStats()
  }, [user, loadSkillStats])

  // Wait for BOTH auth and the user's progress to resolve before deciding anything.
  // This component runs its own useAuth instance, so on first mount `user` is briefly
  // null (uid undefined); wait for both auth and progress to resolve before rendering.
  if (authLoading || !user || loading) {
    return (
      <div className="page-loading">
        <p>Loading your progress...</p>
      </div>
    )
  }

  // The start-of-unit pre-assessment is optional. Rather than force-redirecting the learner
  // into it (which interrupted them right after passing a unit test), we surface it as an
  // opt-in "Pre-check" node on the course map so they can take it now or skip it for later.

  const completedIds = userProgress.completedLessons

  const hasPriorKnowledge = (lessonId: string): boolean => {
    const skillId = lessonPriorSkill[lessonId]
    if (!skillId || completedIds.includes(lessonId)) return false
    const stat = skillStats[skillId]
    return !!stat && stat.attempts > 0 && stat.misses === 0
  }
  const gated = dailyReviewRequired(userProgress)
  const nextIsResume = !!nextLessonId && userProgress.currentLesson?.lessonId === nextLessonId
  const blockNextLesson = gated && !!nextLessonId && !nextIsResume

  // The unit's pre-check must be done before its lessons can be started. When the next
  // lesson sits in a unit whose pre-check is still pending, the CTA routes there first.
  const nextSection = nextLessonId
    ? course.sections.find((s) => s.lessons.some((l) => l.id === nextLessonId))
    : undefined
  const nextNeedsPreCheck = !!nextSection && preCheckRequired(nextSection, userProgress, user.uid)
  const countCompleted = (lessons: { id: string }[]) =>
    lessons.filter((l) => completedIds.includes(l.id)).length
  const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0)

  // Course total includes every lesson (even not-yet-active ones); completed
  // only ever counts available lessons.
  const realSections = course.sections.filter((s) => !s.comingSoon)
  const courseDone = countCompleted(allLessons)

  // "Current unit" = the section holding the next lesson, else the last available one.
  const currentSection =
    realSections.find((s) => s.lessons.some((l) => l.id === nextLessonId)) ??
    realSections[realSections.length - 1]
  const unitLessons = currentSection
    ? currentSection.lessons.filter((l) => !l.comingSoon)
    : []
  const unitDone = countCompleted(unitLessons)

  return (
    <div className="page course-map-page">
      <header className="page-header">
        <div>
          <h1>{course.title}</h1>
          <p className="subtitle">Work through each section to build mastery</p>
        </div>
        <div className="header-actions">
          {availableReviewSkills(completedIds).length > 0 && (
            <>
              <Link to="/review" className="btn btn-secondary">
                Smart Review
              </Link>
              <Link to="/insights" className="btn btn-secondary">
                Weakness Map
              </Link>
            </>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => void logOut()}>
            Sign Out
          </button>
          <button
            type="button"
            className={`ai-toggle${aiEnabled ? ' ai-toggle-on' : ''}`}
            aria-pressed={aiEnabled}
            aria-label={aiEnabled ? 'AI features on — click to disable' : 'AI features off — click to enable'}
            onClick={() => setAiEnabled(!aiEnabled)}
          >
            <span className="ai-toggle-track">
              <span className="ai-toggle-thumb" />
            </span>
            <span className="ai-toggle-label">✦ AI</span>
          </button>
        </div>
      </header>

      <section className="course-dashboard" aria-label="Your progress">
        <div className="dashboard-card">
          <span className="dashboard-label">Streak</span>
          <span className="dashboard-value">
            🔥 {effectiveStreak(userProgress.streak, userProgress.lastActiveDate)}
            <span className="dashboard-unit"> day{effectiveStreak(userProgress.streak, userProgress.lastActiveDate) === 1 ? '' : 's'}</span>
          </span>
        </div>
        <div className="dashboard-card">
          <span className="dashboard-label">{currentSection?.title ?? 'Current unit'}</span>
          <span className="dashboard-value">
            {unitDone}
            <span className="dashboard-unit"> / {unitLessons.length} lessons</span>
          </span>
          <div className="dashboard-bar">
            <div
              className="dashboard-bar-fill"
              style={{ width: `${pct(unitDone, unitLessons.length)}%` }}
            />
          </div>
        </div>
        <div className="dashboard-card">
          <span className="dashboard-label">{course.title}</span>
          <span className="dashboard-value">
            {courseDone}
            <span className="dashboard-unit"> / {allLessons.length} lessons</span>
          </span>
          <div className="dashboard-bar">
            <div
              className="dashboard-bar-fill"
              style={{ width: `${pct(courseDone, allLessons.length)}%` }}
            />
          </div>
        </div>
      </section>

      {error && <p className="error-banner">{error}</p>}

      {gated && (
        <div className="daily-review-banner">
          <div className="daily-review-text">
            <span className="daily-review-label">Daily review</span>
            <span className="daily-review-desc">
              Score at least 80% on a Smart Review or Practice session to unlock your next new
              lesson.
            </span>
          </div>
          <Link to="/review" className="btn btn-primary">
            Smart Review
          </Link>
        </div>
      )}

      {nextLessonId && (
        <div className="course-cta">
          <div className="course-cta-text">
            <span className="course-cta-label">
              {userProgress.completedLessons.length === 0 ? 'Get started' : 'Up next'}
            </span>
            <span className="course-cta-title">
              {getLesson(nextLessonId)?.title ?? nextLessonId}
            </span>
          </div>
          {nextNeedsPreCheck && nextSection ? (
            <Link to={`/pre-assessment/${nextSection.id}`} className="btn course-cta-btn">
              Start pre-check
            </Link>
          ) : blockNextLesson ? (
            <Link to="/review" className="btn course-cta-btn">
              Review to unlock
            </Link>
          ) : (
            <Link to={`/lesson/${nextLessonId}`} className="btn course-cta-btn">
              {nextIsResume ? 'Resume' : 'Start'}
            </Link>
          )}
        </div>
      )}

      {course.sections.map((section) => {
        const sectionPreCheckPending =
          !section.comingSoon && preCheckRequired(section, userProgress, user.uid)
        return (
        <section
          key={section.id}
          className={`course-section ${section.comingSoon ? 'coming-soon' : ''}`}
        >
          <div className="course-section-header">
            <h2 className="course-section-title">{section.title}</h2>
            {section.comingSoon && <span className="course-section-badge">Coming soon</span>}
          </div>

          <div className="lesson-path">
            {/* Pre-assessment node — start-of-unit preview for sections with topics */}
            {!section.comingSoon && sectionHasUnitTest(section) && (() => {
              const done = isPreCheckDone(userProgress, section.id, user.uid)
              const firstLesson = section.lessons.find((l) => !l.comingSoon)
              const unlocked = firstLesson
                ? isLessonUnlocked(firstLesson, userProgress.completedLessons, userProgress.passedUnitTests, course)
                : false

              return (
                <>
                  <div className="lesson-path-item">
                    <div
                      className={`lesson-node pre-assessment-node ${done ? 'completed' : ''} ${!unlocked ? 'locked' : ''} ${!done && unlocked ? 'recommended' : ''}`}
                    >
                      <span className="lesson-order">◎</span>
                      <div className="lesson-node-body">
                        <h3>Pre-check</h3>
                        {done && <p className="lesson-status">Done ✓</p>}
                        {!done && !unlocked && (
                          <p className="lesson-status">Unlocks with this unit</p>
                        )}
                        {!done && unlocked && (
                          <div className="lesson-node-actions">
                            <Link
                              to={`/pre-assessment/${section.id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Start
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="lesson-connector" aria-hidden="true" />
                </>
              )
            })()}

            {section.lessons.map((lesson, index) => {
              const completed = userProgress.completedLessons.includes(lesson.id)
              const unlocked = isLessonUnlocked(lesson, userProgress.completedLessons, userProgress.passedUnitTests, course)
              const inProgress =
                userProgress.currentLesson?.lessonId === lesson.id && !completed
              const isLast = index === section.lessons.length - 1
              // A lesson the learner could otherwise start is held back until the unit's
              // pre-check is done; lessons gated by an earlier prerequisite keep their own hint.
              const blockedByPreCheck = unlocked && sectionPreCheckPending
              const locked = !unlocked || sectionPreCheckPending
              const hint = !unlocked ? unlockHint(lesson.id) : null

              return (
                <div key={lesson.id} className="lesson-path-item">
                  <div
                    className={`lesson-node ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${inProgress ? 'in-progress' : ''} ${lesson.id === nextLessonId && !completed ? 'recommended' : ''}`}
                  >
                    <span className="lesson-order">{lesson.order}</span>
                    <div className="lesson-node-body">
                      <h3>{lesson.title}</h3>
                      {hasPriorKnowledge(lesson.id) && (
                        <span className="lesson-prior-badge">✓ Prior knowledge</span>
                      )}
                      {lesson.comingSoon && <p className="lesson-status">Coming soon</p>}
                      {!lesson.comingSoon && blockedByPreCheck && (
                        <p className="lesson-status">Complete the unit pre-check to unlock</p>
                      )}
                      {!lesson.comingSoon && locked && !blockedByPreCheck && hint && (
                        <p className="lesson-status">{hint}</p>
                      )}
                      {!lesson.comingSoon && locked && !blockedByPreCheck && !hint && (
                        <p className="lesson-status">Locked</p>
                      )}
                      {completed && <p className="lesson-status">Completed ✓</p>}
                      {inProgress && <p className="lesson-status">In progress — resume</p>}
                      {!locked && !completed && !inProgress && gated && (
                        <p className="lesson-status">Do today's review to unlock</p>
                      )}
                      {!locked && (
                        <div className="lesson-node-actions">
                          {!completed && !inProgress && gated ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled
                              title="Finish today's Smart Review or Practice first"
                            >
                              Start
                            </button>
                          ) : (
                            <Link to={`/lesson/${lesson.id}`} className="btn btn-primary btn-sm">
                              {completed ? 'Review' : inProgress ? 'Resume' : 'Start'}
                            </Link>
                          )}
                          {completed && getPracticeSkill(lesson.id) && (
                            <Link
                              to={`/lesson/${lesson.id}/practice`}
                              className="btn btn-secondary btn-sm"
                            >
                              Practice
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="lesson-node-graphic" aria-hidden="true">
                      <LessonIcon lessonId={lesson.id} />
                    </span>
                  </div>
                  {!isLast && <div className="lesson-connector" aria-hidden="true" />}
                </div>
              )
            })}

            {/* Unit test node — only for sections with practice skills */}
            {!section.comingSoon && sectionHasUnitTest(section) && (() => {
              const sectionComplete = allSectionLessonsComplete(section, userProgress.completedLessons)
              const passed = userProgress.passedUnitTests.includes(section.id)
              const available = sectionComplete && !passed

              return (
                <>
                  <div className="lesson-connector" aria-hidden="true" />
                  <div className="lesson-path-item">
                    <div
                      className={`lesson-node unit-test-node ${passed ? 'completed' : ''} ${!sectionComplete ? 'locked' : ''} ${available ? 'recommended' : ''}`}
                    >
                      <span className="lesson-order">★</span>
                      <div className="lesson-node-body">
                        <h3>Unit Test</h3>
                        {!sectionComplete && (
                          <p className="lesson-status">Complete all lessons first</p>
                        )}
                        {passed && <p className="lesson-status">Passed ✓</p>}
                        {available && (
                          <div className="lesson-node-actions">
                            <Link
                              to={`/unit-test/${section.id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Take Test
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </section>
        )
      })}
    </div>
  )
}
