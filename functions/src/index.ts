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

type HintDetail = { component: string; direction: string }

type TailorRequest = {
  kind: 'tailor'
  conic: string
  prompt: string
  wrongComponents: string[]
  details?: HintDetail[]
}

type ReflectRequest = {
  kind: 'reflect'
  conic: string
  weakComponent?: string
}

type AiRequest = SummaryRequest | ChatRequest | TailorRequest | ReflectRequest

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

// Maps a topic slug (e.g. 'unit-circle', 'trig-graph', 'circle') to a human-readable
// name so generalized prompts read naturally. Unknown values are de-slugged as a
// safe fallback rather than failing.
function topicLabel(topic: string): string {
  const known: Record<string, string> = {
    circle: 'circle',
    parabola: 'parabola',
    ellipse: 'ellipse',
    hyperbola: 'hyperbola',
    'unit-circle': 'the unit circle (angles, radians, and sine/cosine as coordinates)',
    'trig-graph': 'trigonometric function graphs (amplitude, period, phase shift, and vertical shift)',
  }
  const key = topic.trim().toLowerCase()
  if (known[key]) return known[key]
  return key.replace(/[-_]+/g, ' ')
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
          `Per-skill performance JSON (misses out of attempts, plus weakComponents like center, radius, foci, opening direction, a, b, ` +
          `angle, reference angle, amplitude, period, phase shift, vertical shift): ` +
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
    ` Only answer questions about ${topic} and closely related precalculus graphing concepts (conic sections and trigonometric functions).` +
    ` If the student asks about anything unrelated (other subjects, personal chat, current events, etc.), do NOT answer it —` +
    ` kindly tell them to stay on task and invite a question about ${topic}.` +
    ` Keep answers concise. Explain concepts rather than handing over exact numeric answers to practice problems.` +
    ` Write in plain English — do NOT use LaTeX, markdown, bullet points, or any special formatting symbols.` +
    ` Write equations in plain text, for example: (x-3)^2/9 + (y+1)^2/4 = 1, or y = 2 sin(3(x - pi/4)) + 1.`

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
  const conic = asString(data.conic, 'conic')
  const prompt = asString(data.prompt, 'prompt')
  const wrongComponents = Array.isArray(data.wrongComponents) ? data.wrongComponents : []
  const details = Array.isArray(data.details) ? data.details : []
  // Directional descriptors are qualitative (e.g. "radius too small") and never contain the
  // exact target value, so they can be shown to the model without leaking the answer.
  const directionLine = details.length
    ? ` Here is how each wrong part is off (directional only, no exact values): ` +
      `${details.map((d) => `${d.component} ${d.direction}`).join('; ')}.`
    : ''

  const completion = await openai().chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 120,
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
          'You help students with precalculus graphing problems by writing targeted, one-line hints. ' +
          'Topics include conic sections (circles, parabolas, ellipses, hyperbolas) and trigonometric functions ' +
          '(the unit circle, angles and radians, sine/cosine/tangent graphs, amplitude, period, phase shift, and reciprocal functions). ' +
          'Do NOT give the answer or restate the equation, and never state the exact target value or coordinates. ' +
          'When directional descriptors are provided (e.g. "radius too small", "center too far left"), use them to nudge the student in the right direction without revealing the exact value. ' +
          'Focus only on the specific parts the student currently has wrong. ' +
          'Write in plain English only — no LaTeX, no markdown, no dollar signs, no special symbols. ' +
          'Write math inline as plain text, e.g. "p" not "$p$", "a^2 + b^2" not "\\sqrt{a^2+b^2}", "pi/2" not "\\frac{\\pi}{2}".',
      },
      {
        role: 'user',
        content:
          `Topic: ${topicLabel(conic)}. Problem: ${prompt}. ` +
          `The student currently has these parts wrong: ${wrongComponents.length ? wrongComponents.join(', ') : 'all parts'}.` +
          directionLine +
          ` Write one short hint that helps them fix exactly those parts.`,
      },
    ],
  })
  const text = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(text) as { hint?: string }
  return {
    hint: typeof parsed.hint === 'string' ? parsed.hint : '',
  }
}

async function handleReflect(data: ReflectRequest) {
  const conic = asString(data.conic, 'conic')
  const focusLine = data.weakComponent ? ` Focus on the topic: ${data.weakComponent}.` : ''

  const completion = await openai().chat.completions.create({
    model: MODEL,
    max_tokens: 250,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'reflect',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            stem: { type: 'string' },
            correct: { type: 'string' },
            distractors: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
            explanation: { type: 'string' },
          },
          required: ['stem', 'correct', 'distractors', 'explanation'],
        },
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'You write conceptual multiple-choice questions for a precalculus graphing app that covers ' +
          'conic sections (circles, parabolas, ellipses, hyperbolas) and trigonometric functions ' +
          '(the unit circle, angles and radians, sine/cosine/tangent graphs, amplitude, period, phase shift, and reciprocal functions). ' +
          'The question must test geometric/graphical intuition or definitions — NO arithmetic, ' +
          'no "compute the foci of this equation" or "evaluate sin at this angle." ' +
          'Output exactly one question with stem, a correct answer string, exactly 3 distractor strings, ' +
          'and a one-sentence explanation. Keep all strings concise and plain English — ' +
          'no LaTeX, no markdown; write any math inline as plain text (e.g. "pi/2", "a^2 + b^2").',
      },
      {
        role: 'user',
        content: `Write a conceptual question about ${topicLabel(conic)}.${focusLine}`,
      },
    ],
  })
  const text = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(text) as {
    stem?: string
    correct?: string
    distractors?: string[]
    explanation?: string
  }
  return {
    stem: typeof parsed.stem === 'string' ? parsed.stem : '',
    correct: typeof parsed.correct === 'string' ? parsed.correct : '',
    distractors: Array.isArray(parsed.distractors) ? parsed.distractors : [],
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
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
        case 'reflect':
          return await handleReflect(data)
        default:
          throw new functions.https.HttpsError('invalid-argument', 'Unknown request "kind".')
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err
      console.error('[aiAssist] OpenAI request failed:', err)
      throw new functions.https.HttpsError('internal', 'AI request failed.')
    }
  })
