/**
 * Cited source blips rendered as chips that jump to the cited blip.
 * Buttons, not `#b-<id>` links: the URL hash holds the wave id, so a hash link would
 * navigate away from the wave.
 */
export function SourceChips({ sources, onJump }: { sources: string[]; onJump?: (blipId: string) => void }) {
  if (sources.length === 0) return null;
  return (
    <p className="rw-sources">
      <span className="rw-sources-label">Sources</span>
      {sources.map((s) => (
        <button key={s} type="button" className="rw-source-chip" onClick={() => onJump?.(s)} aria-label={`Jump to source blip ${s}`}>
          b:{s}
        </button>
      ))}
    </p>
  );
}
