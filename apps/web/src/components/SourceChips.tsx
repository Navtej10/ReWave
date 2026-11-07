/** Cited source blips rendered as chips that jump to the cited blip. */
export function SourceChips({ sources }: { sources: string[] }) {
  if (sources.length === 0) return null;
  return (
    <p className="rw-sources">
      <span className="rw-sources-label">Sources</span>
      {sources.map((s) => (
        <a key={s} className="rw-source-chip" href={`#b-${s}`}>
          b:{s}
        </a>
      ))}
    </p>
  );
}
