import { Link } from 'react-router-dom'
import courseData from '../content/course.json'
import { getLesson } from '../lib/lessons'
import { allSectionLessonsComplete, getCourseLessons, getNextLessonId, isLessonUnlocked, sectionHasUnitTest } from '../lib/course'
import { availableReviewSkills, getPracticeSkill } from '../lib/reviewSkills'
import { dailyReviewRequired } from '../lib/reviewGate'
import { LessonIcon } from '../components/course/LessonIcon'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import type { Course } from '../types/lesson'

const course = courseData as Course
const allLessons = getCourseLessons(course)

function unlockHint(lessonId: string): string | null {
  const entry = allLessons.find((l) => l.id === lessonId)
  if (!entry?.unlockAfter) return null
  const prerequisite = allLessons.find((l) => l.id === entry.unlockAfter)
  return prerequisite ? `Complete "${prerequisite.title}" to unlock` : null
}

export function CourseMapPage() {
  const { user, logOut } = useAuth()
  const { userProgress, loading, error } = useProgress(user?.uid)
  const nextLessonId = getNextLessonId(course, userProgress.completedLessons, userProgress.passedUnitTests)

  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading your progress...</p>
      </div>
    )
  }

  const completedIds = userProgress.completedLessons
  const gated = dailyReviewRequired(userProgress)
  const nextIsResume = !!nextLessonId && userProgress.currentLesson?.lessonId === nextLessonId
  const blockNextLesson = gated && !!nextLessonId && !nextIsResume
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
        </div>
      </header>

      <section className="course-dashboard" aria-label="Your progress">
        <div className="dashboard-card">
          <span className="dashboard-label">Streak</span>
          <span className="dashboard-value">
            🔥 {userProgress.streak}
            <span className="dashboard-unit"> day{userProgress.streak === 1 ? '' : 's'}</span>
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
              Finish one Smart Review or Practice session to unlock your next new lesson.
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
          {blockNextLesson ? (
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

      {course.sections.map((section) => (
        <section
          key={section.id}
          className={`course-section ${section.comingSoon ? 'coming-soon' : ''}`}
        >
          <div className="course-section-header">
            <h2 className="course-section-title">{section.title}</h2>
            {section.comingSoon && <span className="course-section-badge">Coming soon</span>}
          </div>

          <div className="lesson-path">
            {section.lessons.map((lesson, index) => {
              const completed = userProgress.completedLessons.includes(lesson.id)
              const unlocked = isLessonUnlocked(lesson, userProgress.completedLessons, userProgress.passedUnitTests, course)
              const inProgress =
                userProgress.currentLesson?.lessonId === lesson.id && !completed
              const isLast = index === section.lessons.length - 1
              const locked = !unlocked
              const hint = locked ? unlockHint(lesson.id) : null

              return (
                <div key={lesson.id} className="lesson-path-item">
                  <div
                    className={`lesson-node ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${inProgress ? 'in-progress' : ''} ${lesson.id === nextLessonId && !completed ? 'recommended' : ''}`}
                  >
                    <span className="lesson-order">{lesson.order}</span>
                    <div className="lesson-node-body">
                      <h3>{lesson.title}</h3>
                      {lesson.comingSoon && <p className="lesson-status">Coming soon</p>}
                      {!lesson.comingSoon && locked && hint && (
                        <p className="lesson-status">{hint}</p>
                      )}
                      {!lesson.comingSoon && locked && !hint && (
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
      ))}
    </div>
  )
}
