export type FeedbackPart = { label: string; ok: boolean }

/** One graded attempt, with the coarse components the learner missed (for struggle tracking). */
export type AttemptResult = { correct: boolean; weakComponents?: string[] }

/**
 * A single qualitative discrepancy between the student's input and the target,
 * e.g. { component: 'radius', direction: 'too small' }. The `direction` is always a
 * plain-English word/phrase and NEVER contains the exact target value, so it is safe
 * to send to the AI hint model without leaking the answer.
 */
export type HintDetail = { component: string; direction: string }

/** Labels of the components that were not yet correct. */
export function weakComponentsOf(parts: FeedbackPart[]): string[] {
  return parts.filter((p) => !p.ok).map((p) => p.label)
}

/**
 * Qualitative direction for a scalar value (radius, a, b, width, etc.) compared to its
 * target. Returns only a word like "too small"/"too large" — never the numeric target.
 */
export function scalarDirection(current: number, target: number): string {
  return current < target ? 'too small' : 'too large'
}

/**
 * Qualitative direction for one axis of a position compared to its target. Returns only
 * a phrase like "too far left" — never the numeric target coordinate.
 */
export function axisDirection(current: number, target: number, axis: 'x' | 'y'): string {
  if (axis === 'x') return current < target ? 'too far left' : 'too far right'
  return current < target ? 'too far down' : 'too far up'
}

function joinList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/**
 * Build an adaptive "incorrect" message that names which parts of an answer are
 * already right versus still off, so feedback targets exactly what's wrong.
 * Falls back to `fallback` when nothing is identifiably wrong.
 */
export function adaptiveMismatchMessage(parts: FeedbackPart[], fallback: string): string {
  const wrong = parts.filter((p) => !p.ok).map((p) => p.label)
  const right = parts.filter((p) => p.ok).map((p) => p.label)

  if (wrong.length === 0) return fallback

  if (right.length === 0) {
    return `Not quite — keep working on the ${joinList(wrong)}.`
  }

  const rightVerb = right.length === 1 ? 'is' : 'are'
  const wrongVerb = wrong.length === 1 ? "isn't" : "aren't"
  return `Close! Your ${joinList(right)} ${rightVerb} right, but the ${joinList(wrong)} ${wrongVerb} there yet.`
}
