interface Props {
  /** Height in px; the mark is slightly narrower than tall (315:345). */
  size?: number
  /**
   * In viewBox units. The drawing's own line is 9, but scaled down to sidebar
   * sizes that lands under a pixel and turns grey, so the default is heavier.
   * Large uses (the welcome page) pass something closer to the original.
   */
  strokeWidth?: number
}

// The mark's measured ink bounds rather than a loose box, so it fills whatever
// size it's given instead of rendering with invisible padding around it.
const VIEW_BOX = '11 20 287 312'
const W = 287
const H = 312

// The coil rings, evenly spaced down the binding edge. Each is a hook that
// wraps the cover's left edge and ends in a dot where the wire meets the page.
const RING_Y = [80, 143, 206, 269]

/**
 * The spiral notebook mark: a bound cover with the page edge showing at the
 * top right, four coil rings, and an N whose loose ends are capped with dots.
 *
 * Dot radii are derived from strokeWidth rather than fixed, so the drawing
 * keeps its proportions when the line is thickened for small sizes — otherwise
 * a heavier stroke swallows the dots.
 */
export function NotesuMark({ size = 22, strokeWidth = 16 }: Props) {
  const ringDot = strokeWidth * 1.11
  const letterDot = strokeWidth * 1.22

  return (
    <svg
      viewBox={VIEW_BOX}
      width={size * (W / H)}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Page edge, peeking out behind the cover's top-right corner. */}
      <path d="M210 62H258A30 30 0 0 1 288 92V288" />
      <rect x="48" y="30" width="222" height="292" rx="30" />

      {RING_Y.map((y) => (
        <path key={y} d={`M38 ${y + 35}C18 ${y + 31} 14 ${y - 1} 34 ${y - 5}C48 ${y - 7} 66 ${y - 5} 82 ${y - 1}`} />
      ))}

      {/* Bottom-left up, diagonal down, right leg up — one continuous N. */}
      <path d="M128 238L128 118L216 240L216 128" />

      <g fill="currentColor" stroke="none">
        {RING_Y.map((y) => (
          <circle key={y} cx="85" cy={y} r={ringDot} />
        ))}
        <circle cx="128" cy="238" r={letterDot} />
        <circle cx="216" cy="128" r={letterDot} />
      </g>
    </svg>
  )
}
