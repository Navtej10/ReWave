/** WhatsApp-style pill with three animated dots and the typist's name, shown where the
 *  reply will land. Dots go static under prefers-reduced-motion (handled in CSS). */
export function TypingBubble({ name }: { name: string }) {
  return (
    <li className="rw-typing-row" aria-live="polite">
      <div className="rw-typing" aria-label={`${name} is typing`}>
        <span className="rw-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="rw-typing-name">{name} is typing…</span>
      </div>
    </li>
  );
}
