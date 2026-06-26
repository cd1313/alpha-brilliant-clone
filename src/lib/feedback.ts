export type FeedbackPart = { label: string; ok: boolean }

/** One graded attempt, with the coarse components the learner missed (for struggle tracking). */
export type AttemptResult = { correct: boolean; weakComponents?: string[] }

/** Labels of the components that were not yet correct. */
export function weakComponentsOf(parts: FeedbackPart[]): string[] {
  return parts.filter((p) => !p.ok).map((p) => p.label)
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
