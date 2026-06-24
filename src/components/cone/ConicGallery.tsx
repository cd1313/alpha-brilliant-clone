import type { ReactNode } from 'react'

type ConicCard = {
  name: string
  color: string
  /** SVG markup drawn inside a 100×80 viewBox. */
  shape: ReactNode
}

const CARDS: ConicCard[] = [
  {
    name: 'Circle',
    color: 'var(--primary)',
    shape: <circle cx="50" cy="40" r="26" />,
  },
  {
    name: 'Ellipse',
    color: 'var(--secondary)',
    shape: <ellipse cx="50" cy="40" rx="34" ry="21" />,
  },
  {
    name: 'Parabola',
    color: 'var(--accent-warm-text)',
    shape: <path d="M 18 12 Q 50 84 82 12" />,
  },
  {
    name: 'Hyperbola',
    color: 'var(--c-deep)',
    shape: (
      <>
        <path d="M 42 10 Q 16 40 42 70" />
        <path d="M 58 10 Q 84 40 58 70" />
      </>
    ),
  },
]

export function ConicGallery() {
  return (
    <div className="conic-gallery" role="img" aria-label="The four conic sections: circle, ellipse, parabola, and hyperbola">
      {CARDS.map((card) => (
        <figure key={card.name} className="conic-gallery-card">
          <svg viewBox="0 0 100 80" className="conic-gallery-svg" aria-hidden="true">
            <g
              fill="none"
              stroke={card.color}
              strokeWidth={3}
              strokeLinecap="round"
            >
              {card.shape}
            </g>
          </svg>
          <figcaption className="conic-gallery-name" style={{ color: card.color }}>
            {card.name}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
