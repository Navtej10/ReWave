import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button, Card } from "../../components/ui/index";
import { PaperPlaneIcon } from "./icons";
import { AGENT_NAMES, type AgentName } from "./types";

export const COMPOSER_PLACEHOLDER = "Start a thread. Mention @scribe, @skeptic or @researcher to bring an agent in.";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function Composer({ value, onChange, onSend }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);
  const canSend = value.trim().length > 0;

  // Show the caret on arrival, as in the reference.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  // After a chip inserts a mention, restore focus and put the caret right after it.
  useEffect(() => {
    const pos = caretRef.current;
    if (pos === null) return;
    caretRef.current = null;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [value]);

  function insertMention(name: AgentName) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lead = before.length > 0 && !/\s$/.test(before) ? " " : "";
    const insert = `${lead}@${name} `;
    caretRef.current = before.length + insert.length;
    onChange(before + insert + after);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter falls through and inserts a newline.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <Card className="wp-composer" role="group" aria-label="Composer">
      <div className="wp-composer__bring">
        <span className="wp-composer__label" id="wp-bring-in">
          Bring in
        </span>
        <div className="wp-composer__chips" role="group" aria-labelledby="wp-bring-in">
          {AGENT_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className="ink-chip wp-chip"
              aria-label={`Mention ${name}`}
              onClick={() => insertMention(name)}
            >
              @{name}
            </button>
          ))}
        </div>
      </div>

      <div className="wp-composer__row">
        <textarea
          ref={ref}
          rows={1}
          className="sketch sketch-b ink-input wp-composer__input"
          placeholder={COMPOSER_PLACEHOLDER}
          aria-label="Message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button variant="primary" className="wp-send" disabled={!canSend} onClick={onSend}>
          <PaperPlaneIcon />
          Send
        </Button>
      </div>
    </Card>
  );
}
