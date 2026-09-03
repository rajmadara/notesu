interface Props {
  size?: number
}

/**
 * The folded-note-page mark from the favicon (public/favicon.svg), redrawn
 * with currentColor so it picks up the theme instead of the baked-in teal.
 */
export function NotesuMark({ size = 22 }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M8.5 2.5h10l6 6v18.5a2.5 2.5 0 0 1-2.5 2.5H8.5A2.5 2.5 0 0 1 6 27V5a2.5 2.5 0 0 1 2.5-2.5z"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M18.5 2.5v4a2 2 0 0 0 2 2h4" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11.8 12v2.6a3.5 3.5 0 0 0 7 0V12" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M10.2 21.8h10.1M10.2 25.5h4" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="17.5" cy="25.5" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  )
}
