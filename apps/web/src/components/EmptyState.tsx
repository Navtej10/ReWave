/** Shown when the wave has no blips and no one is typing. */
export function EmptyState() {
  return (
    <div className="rw-empty">
      <div className="rw-empty-mark" aria-hidden="true">
        〜
      </div>
      <h2 className="rw-empty-title">This wave is empty</h2>
      <p className="rw-empty-text">
        Post the first blip to start the thread. Mention <code>@scribe</code>,{" "}
        <code>@skeptic</code>, or <code>@researcher</code> to bring an agent in.
      </p>
    </div>
  );
}
