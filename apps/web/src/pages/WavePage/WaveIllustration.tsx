/** Hand-drawn Hokusai-style wave: curling crest, foam lines and spray. Decorative. */
export function WaveIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 90 58"
      width="90"
      height="58"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* back of the swell rising into the crest */}
      <path d="M2 50 C15 49 24 41 31 31 C37 22 47 12 61 10 C71 9 79 13 82 21" />
      {/* spiral curl */}
      <path d="M82 21 C84 28 77 32 72 28 C68 25 70 19 75 19 C78 19 79 22 77 24" />
      {/* front face falling away to the right */}
      <path d="M61 10 C55 18 55 28 62 34 C68 39 78 40 88 37" />
      {/* inner shadow strokes */}
      <path d="M44 25 C50 22 54 24 56 28" />
      <path d="M38 34 C44 30 50 32 53 36" />
      {/* foam lines */}
      <path d="M22 46 C28 42 36 43 41 47" />
      <path d="M46 44 C52 41 58 43 62 47" />
      <path d="M2 54 C14 52 24 55 36 53 C48 51 60 55 72 53 C78 52 84 53 88 54" />
      {/* spray */}
      <g fill="currentColor" stroke="none">
        <circle cx="58" cy="5" r="1.1" />
        <circle cx="65" cy="3" r="1.4" />
        <circle cx="72" cy="5" r="1" />
        <circle cx="79" cy="8" r="1.3" />
        <circle cx="85" cy="13" r="1" />
        <circle cx="70" cy="11" r="0.8" />
      </g>
    </svg>
  );
}
