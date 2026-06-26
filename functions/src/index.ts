import * as functions from 'firebase-functions/v1'
import OpenAI from 'openai'

// Keep cost bounded; these are small, infrequent requests.
const MAX_INSTANCES = 5
const MODEL = 'gpt-4o-mini'

type SkillPerformance = {
  label: string
  attempts: number
  misses: number
  weakComponents: string[]
}

type SummaryRequest = {
  kind: 'summary'
  topic: string
  source: 'lesson' | 'review' | 'practice'
  skills: SkillPerformance[]
}

type ChatTurn = { role: 'user' | 'model'; text: string }

type ChatRequest = {
  kind: 'chat'
  topic: string
  concepts?: string[]
  history: ChatTurn[]
  message: string
}

type TailorRequest = {
  kind: 'tailor'
  conic: string
  equation: string
  targetedComponent: string
  conceptNotes: string[]
  profileLine: string
}

type AiRequest = SummaryRequest | ChatRequest | TailorRequest

let client: OpenAI | null = null
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', `Missing or invalid "${field}".`)
  }
  return value
}

async function handleSummary(data: SummaryRequest) {
  const skills = Array.isArray(data.skills) ? data.skills.slice(0, 12) : []
  const completion = await openai().chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 500,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'tutor_summary',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            suggestions: { type: 'array', items: { type: 'string' } },
          },
          required: ['summary', 'suggestions'],
        },
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'You are a supportive precalculus tutor. Use only the performance data provided; do not invent numbers. ' +
          'Write in plain English — do NOT use LaTeX, markdown, or any special formatting symbols.',
      },
      {
        role: 'user',
        content:
          `A student just finished a ${data.source} on ${asString(data.topic, 'topic')}. ` +
          `Per-skill performance JSON (misses out of attempts, plus weakComponents like center, radius, foci, opening direction, a, b): ` +
          `${JSON.stringify(skills)}. ` +
          `Write a 2-3 sentence encouraging "summary" of how they did and what to focus on, ` +
          `then 2-4 short specific "suggestions" of concepts to study, referencing ${data.topic}. ` +
          `Use plain English only — no LaTeX, no markdown.`,
      },
    ],
  })
  const text = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(text) as { summary?: string; suggestions?: string[] }
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [],
  }
}

async function handleChat(data: ChatRequest) {
  const topic = asString(data.topic, 'topic')
  const conceptLine = data.concepts?.length ? ` Key concepts just covered: ${data.concepts.join(', ')}.` : ''
  const system =
    `You are a friendly precalculus teacher helping a student right after a lesson on ${topic}.` +
    conceptLine +
    ` Only answer questions about ${topic} and closely related precalculus and conic-section concepts.` +
    ` If the student asks about anything unrelated (other subjects, personal chat, current events, etc.), do NOT answer it —` +
    ` kindly tell them to stay on task and invite a question about ${topic}.` +
    ` Keep answers concise. Explain concepts rather than handing over exact numeric answers to practice problems.` +
    ` Write in plain English — do NOT use LaTeX, markdown, bullet points, or any special formatting symbols.` +
    ` Write equations in plain text, for example: (x-3)^2/9 + (y+1)^2/4 = 1.`

  const history = Array.isArray(data.history) ? data.history.slice(-12) : []
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...history.map((turn) => ({
      role: turn.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: String(turn.text ?? ''),
    })),
    { role: 'user', content: asString(data.message, 'message') },
  ]

  const completion = await openai().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    max_tokens: 350,
    messages,
  })
  return { reply: completion.choices[0]?.message?.content?.trim() ?? '' }
}

async function handleTailor(data: TailorRequest) {
  const equation = asString(data.equation, 'equation')
  const conic = asString(data.conic, 'conic')
  const component = asString(data.targetedComponent, 'targetedComponent')
  const notes = Array.isArray(data.conceptNotes) ? data.conceptNotes.join(' ') : ''

  const completion = await openai().chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 220,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'tailored_problem',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            hint: { type: 'string' },
          },
          required: ['hint'],
        },
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'You help students with conic section graphing problems by writing targeted hints. ' +
          'Do NOT write a word problem, story, or real-world scenario — the student needs a clean math problem. ' +
          'Write a single one-line "hint" that addresses the student\'s specific weak area without revealing the answer.',
      },
      {
        role: 'user',
        content:
          `Conic: ${conic}. Equation (do not restate it): ${equation}. ` +
          `Student's weak area to target with the hint: ${component}. ` +
          `Relevant concept notes: ${notes}. ` +
          `Profile: ${typeof data.profileLine === 'string' ? data.profileLine : ''}.`,
      },
    ],
  })
  const text = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(text) as { hint?: string }
  return {
    hint: typeof parsed.hint === 'string' ? parsed.hint : '',
  }
}

export const aiAssist = functions
  .runWith({ secrets: ['OPENAI_API_KEY'], maxInstances: MAX_INSTANCES })
  .https.onCall(async (data: AiRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in to use AI features.')
    }

    if (!data || typeof data !== 'object' || !('kind' in data)) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing request "kind".')
    }

    try {
      switch (data.kind) {
        case 'summary':
          return await handleSummary(data)
        case 'chat':
          return await handleChat(data)
        case 'tailor':
          return await handleTailor(data)
        default:
          throw new functions.https.HttpsError('invalid-argument', 'Unknown request "kind".')
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err
      console.error('[aiAssist] OpenAI request failed:', err)
      throw new functions.https.HttpsError('internal', 'AI request failed.')
    }
  })
