import { useEffect, useRef, useState } from 'react'
import {
  isTutorEnabled,
  requestChatReply,
  requestSummary,
  type ChatTurn,
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

  const tutorEnabled = isTutorEnabled()

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
