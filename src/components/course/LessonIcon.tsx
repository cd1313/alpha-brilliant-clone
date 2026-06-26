import type { ReactElement } from 'react'

type LessonIconProps = {
  lessonId: string
}

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Cone with a slicing plane — the Introduction lesson. */
function IntroductionIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 3 L5 19 L19 19 Z" />
      <path d="M4 13 L20 11" />
    </svg>
  )
}

/** Upward-opening parabola on a small axis. */
function ParabolaIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 5 C 8 20, 16 20, 20 5" />
      <path d="M3 18 H21" opacity="0.5" />
    </svg>
  )
}

/** Circle with a center dot. */
function CircleIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Ellipse with two foci. */
function EllipseIcon() {
  return (
    <svg {...svgProps}>
      <ellipse cx="12" cy="12" rx="9" ry="5.5" />
      <circle cx="7.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Two opposing hyperbola branches. */
function HyperbolaIcon() {
  return (
    <svg {...svgProps}>
      <path d="M8 4 C 11 9, 11 15, 8 20" />
      <path d="M16 4 C 13 9, 13 15, 16 20" />
    </svg>
  )
}

/** Two rays forming an angle with an arc. */
function TrigAnglesIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 19 H20" />
      <path d="M4 19 L19 7" />
      <path d="M11 19 A 7 7 0 0 0 9.3 14.4" opacity="0.7" />
    </svg>
  )
}

/** Unit circle with a radius to a point and right-triangle legs. */
function UnitCircleIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12 L17.7 6.3" />
      <path d="M12 12 H17.7 V6.3" opacity="0.5" />
    </svg>
  )
}

/** A sine wave. */
function SineCosineIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 12 C 6 4, 9 4, 12 12 C 15 20, 18 20, 21 12" />
    </svg>
  )
}

/** Tangent curve with dashed vertical asymptotes. */
function TangentIcon() {
  return (
    <svg {...svgProps}>
      <path d="M6 4 V20" strokeDasharray="2 2" opacity="0.5" />
      <path d="M18 4 V20" strokeDasharray="2 2" opacity="0.5" />
      <path d="M7 19 C 10 16, 11 8, 12 12 C 13 16, 14 8, 17 5" />
    </svg>
  )
}

/** Generic fallback — a small open book. */
function FallbackIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 6 C 9 4, 6 4, 4 5 V18 C 6 17, 9 17, 12 19" />
      <path d="M12 6 C 15 4, 18 4, 20 5 V18 C 18 17, 15 17, 12 19" />
    </svg>
  )
}

const ICONS: Record<string, () => ReactElement> = {
  introduction: IntroductionIcon,
  parabolas: ParabolaIcon,
  circles: CircleIcon,
  ellipses: EllipseIcon,
  hyperbolas: HyperbolaIcon,
  'trig-angles': TrigAnglesIcon,
  'trig-unit-circle': UnitCircleIcon,
  'trig-sine-cosine': SineCosineIcon,
  'trig-tangent': TangentIcon,
}

export function LessonIcon({ lessonId }: LessonIconProps) {
  const Icon = ICONS[lessonId] ?? FallbackIcon
  return <Icon />
}
