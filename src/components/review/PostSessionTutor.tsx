import { useEffect, useMemo, useRef, useState } from 'react'
import {
  isTutorEnabled,
  requestChatReply,
  requestSocraticOpen,
  requestSocraticReply,
  requestSummary,
  type ChatTurn,
  type SocraticTurn,
  type TutorPerformance,
  type TutorSummary,
} from '../../lib/ai/tutorClient'

type PostSessionTutorProps = {
  performance: TutorPerformance
  concepts?: string[]
}

/** Grounded fallback so the screen is useful even with AI off/erroring. */
function deterministicSummary(perf: TutorPerformance): TutorSummary {
  const struggled = perf.skills.filter((s) => s.attempts > 0 && s.misses > 0)

  if (struggled.length === 0) {
    return {
      summary: `Nice work on ${perf.topic}! You didn't miss anything tracked this time — keep it up.`,
      suggestions: [],
    }
  }

  const components = Array.from(new Set(struggled.flatMap((s) => s.weakComponents)))
  const summary =
    `On ${perf.topic} you had a few misses` +
    (components.length ? ` around ${components.join(', ')}` : '') +
    `. Reviewing those ideas should help them click.`
  const suggestions = struggled
    .map(
      (s) =>
        `Revisit ${s.label}` +
        (s.weakComponents.length ? ` (focus on ${s.weakComponents.join(', ')})` : '') +
        '.',
    )
    .slice(0, 4)

  return { summary, suggestions }
}

/** Drop any leading model-only turns so the history always starts with a user message. */
function toApiHistory(messages: ChatTurn[]): ChatTurn[] {
  const firstUser = messages.findIndex((m) => m.role === 'user')
  return firstUser === -1 ? [] : messages.slice(firstUser)
}

export function PostSessionTutor({ performance, concepts }: PostSessionTutorProps) {
  const [summary, setSummary] = useState<TutorSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [socraticActive, setSocraticActive] = useState(false)
  const [socraticDismissed, setSocraticDismissed] = useState(false)
  const [socraticComplete, setSocraticComplete] = useState(false)
  const [socraticQuestion, setSocraticQuestion] = useState<string | null>(null)
  const [socraticAnswer, setSocraticAnswer] = useState('')
  const [socraticLoading, setSocraticLoading] = useState(false)
  const [socraticHistory, setSocraticHistory] = useState<SocraticTurn[]>([])
  const [socraticExchanges, setSocraticExchanges] = useState(0)
  const [socraticPast, setSocraticPast] = useState<{ student: string; tutor: string }[]>([])

  const tutorEnabled = isTutorEnabled()
  const weakComponents = useMemo(
    () => Array.from(new Set(performance.skills.flatMap((s) => s.weakComponents))),
    [performance.skills],
  )
  // Offer the check-in after any session with tracked attempts (lessons, review, practice),
  // not just ones that recorded weak components. With no weak components the backend asks a
  // general, on-topic question instead. Stays hidden on zero-attempt screens (intro/cone
  // lessons, or the empty placeholder before fallback stats load).
  const totalAttempts = useMemo(
    () => performance.skills.reduce((n, s) => n + s.attempts, 0),
    [performance.skills],
  )
  const showSocraticButton =
    tutorEnabled &&
    totalAttempts > 0 &&
    !loadingSummary &&
    !socraticActive &&
    !socraticDismissed &&
    !socraticComplete

  // Generate the summary once when the screen opens. loadingSummary starts true, so we
  // only flip it off after the async work completes (no synchronous setState here).
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      console.log('[tutor] enabled=', tutorEnabled, 'topic=', performance.topic)
      const ai = tutorEnabled ? await requestSummary(performance) : null
      console.log('[tutor] summary result=', ai ? 'ok' : 'null (AI off or failed)')
      if (cancelled) return

      setSummary(ai ?? deterministicSummary(performance))
      const available = !!ai
      setAiAvailable(available)
      setMessages([
        {
          role: 'model',
          text: available
            ? `Any questions about ${performance.topic}? Ask me anything about it.`
            : `Chat is temporarily unavailable. Check back after a moment.`,
        },
      ])
      setLoadingSummary(false)
    }

    void run()
    return () => {
      cancelled = true
    }
    // Build once per screen; performance is fixed for a completed session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const send = async () => {
    const text = input.trim()
    if (!text || chatLoading || !aiAvailable) return

    const history = toApiHistory(messages)
    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setChatLoading(true)

    const reply = await requestChatReply({ topic: performance.topic, concepts, history, message: text })
    setChatLoading(false)
    setMessages((prev) => [
      ...prev,
      {
        role: 'model',
        text: reply ?? "Sorry — I couldn't respond right now. Please try again in a moment.",
      },
    ])
  }

  const startSocratic = async () => {
    setSocraticLoading(true)
    const question = await requestSocraticOpen({
      topic: performance.topic,
      weakComponents,
    })
    setSocraticLoading(false)
    if (!question) {
      setSocraticDismissed(true)
      return
    }
    setSocraticActive(true)
    setSocraticQuestion(question)
    setSocraticHistory([{ role: 'tutor', text: question }])
  }

  const submitSocratic = async () => {
    const answer = socraticAnswer.trim()
    if (!answer || socraticLoading || !socraticQuestion) return

    setSocraticLoading(true)
    const result = await requestSocraticReply({
      topic: performance.topic,
      weakComponents,
      history: socraticHistory,
      answer,
    })
    setSocraticLoading(false)

    if (!result) {
      setSocraticActive(false)
      setSocraticDismissed(true)
      return
    }

    const nextHistory: SocraticTurn[] = [
      ...socraticHistory,
      { role: 'student', text: answer },
      { role: 'tutor', text: result.question },
    ]
    const exchangeCount = socraticExchanges + 1

    setSocraticHistory(nextHistory)
    setSocraticPast((prev) => [...prev, { student: answer, tutor: result.question }])
    setSocraticExchanges(exchangeCount)
    setSocraticAnswer('')

    if (exchangeCount >= 4 || (result.affirmed && exchangeCount >= 3)) {
      setSocraticComplete(true)
      setSocraticQuestion(null)
    } else {
      setSocraticQuestion(result.question)
    }
  }

  return (
    <div className="tutor-panel">
      <div className="tutor-header">
        <span className="tutor-eyebrow">AI Tutor</span>
        <h2 className="tutor-heading">How you did</h2>
      </div>

      {loadingSummary ? (
        <p className="tutor-loading">
          <span className="tutor-spinner" aria-hidden="true" />
          Reviewing your session…
        </p>
      ) : (
        summary && (
          <>
            <p className="tutor-summary">{summary.summary}</p>
            {summary.suggestions.length > 0 && (
              <div className="tutor-section">
                <span className="tutor-label">Study next</span>
                <ul className="tutor-suggestions">
                  {summary.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      )}

      {showSocraticButton && (
        <div className="tutor-socratic-start">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={socraticLoading}
            onClick={() => void startSocratic()}
          >
            {socraticLoading ? 'Loading…' : 'Test your understanding'}
          </button>
        </div>
      )}

      {socraticActive && (
        <div className="tutor-socratic">
          <h3 className="tutor-socratic-heading">Test your understanding</h3>

          {socraticPast.length > 0 && (
            <div className="tutor-socratic-history">
              {socraticPast.map((ex, i) => (
                <div key={i} className="tutor-socratic-exchange">
                  <div className="tutor-socratic-exchange-student">{ex.student}</div>
                  <div className="tutor-socratic-exchange-tutor">{ex.tutor}</div>
                </div>
              ))}
            </div>
          )}

          {socraticQuestion && (
            <>
              <p className="tutor-socratic-question">{socraticQuestion}</p>
              <textarea
                className="tutor-socratic-textarea"
                value={socraticAnswer}
                onChange={(e) => setSocraticAnswer(e.target.value)}
                placeholder="Type your answer…"
                aria-label="Your answer to the tutor's question"
                disabled={socraticLoading}
              />
              <div className="tutor-socratic-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={socraticLoading || !socraticAnswer.trim()}
                  onClick={() => void submitSocratic()}
                >
                  {socraticLoading ? 'Checking…' : 'Submit'}
                </button>
              </div>
            </>
          )}

          {socraticComplete && (
            <p className="tutor-socratic-closing">
              Great work — check out the chat below if you have more questions.
            </p>
          )}
        </div>
      )}

      {tutorEnabled && !loadingSummary && (
        <div className="tutor-chat">
          <span className="tutor-label">Ask the tutor</span>
          <div className="tutor-messages">
            {messages.map((m, i) => (
              <div key={i} className={`tutor-message tutor-message-${m.role}`}>
                {m.text}
              </div>
            ))}
            {chatLoading && (
              <div
                className="tutor-message tutor-message-model tutor-typing"
                aria-label="Tutor is typing"
              >
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {aiAvailable && (
            <form
              className="tutor-input-row"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <input
                className="tutor-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${performance.topic}…`}
                aria-label="Ask the tutor a question"
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm tutor-send"
                disabled={chatLoading || !input.trim()}
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
