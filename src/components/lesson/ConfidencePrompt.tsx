type Confidence = 'sure' | 'unsure' | 'guessing'

type ConfidencePromptProps = {
  onSelect: (confidence: Confidence) => void
}

const OPTIONS: { value: Confidence; label: string }[] = [
  { value: 'guessing', label: 'Guessing' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'sure', label: 'Sure' },
]

export function ConfidencePrompt({ onSelect }: ConfidencePromptProps) {
  return (
    <div className="confidence-prompt">
      <span className="confidence-prompt-label">How confident were you?</span>
      <div className="confidence-prompt-buttons">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="confidence-btn"
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
