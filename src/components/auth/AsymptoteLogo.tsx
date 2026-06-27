type AsymptoteLogoProps = {
  className?: string
}

/**
 * Brand mark for "Asymptote": two hyperbola branches curving toward a pair of
 * dashed asymptote lines. Uses stroke="currentColor" so it inherits text color.
 */
export function AsymptoteLogo({ className }: AsymptoteLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Asymptotes */}
      <path d="M6 42 L42 6" strokeDasharray="3 3" opacity="0.45" />
      <path d="M6 6 L42 42" strokeDasharray="3 3" opacity="0.45" />
      {/* Upper-right hyperbola branch */}
      <path d="M26 8 C 30 18, 38 22, 42 23" />
      {/* Lower-left hyperbola branch */}
      <path d="M22 40 C 18 30, 10 26, 6 25" />
    </svg>
  )
}
