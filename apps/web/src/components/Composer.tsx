import { useEffect, useRef } from "react";
import type { AgentName } from "../wave/types";
import { AGENT_NAMES } from "../wave/agents";
import { PaperPlaneIcon } from "../pages/WavePage/icons";
import { Button, Card } from "./ui/index";

/** Sticky bottom composer: growing textarea, Send (Ctrl/Cmd+Enter), quick-insert mentions.
 *  Presentational only — App owns the draft string and the post action. */
export function Composer(props: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
}) {
  const { value, onChange, onSend, placeholder } = props;
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea to fit its content (capped by CSS max-height).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Insert "@agent " at the caret, keeping the rest of the draft intact.
  function insertMention(agent: AgentName) {
    const el = ref.current;
    const mention = `@${agent} `;
    if (!el) {
      onChange(`${value}${value && !value.endsWith(" ") ? " " : ""}${mention}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + mention + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + mention.length;
      el.setSelectionRange(caret, caret);
    });
  }

  const canSend = value.trim().length > 0;

  return (
    <Card className="rw-composer" shape="c">
      <div className="rw-composer-mentions">
        <span className="rw-composer-hint">Bring in</span>
        {AGENT_NAMES.map((agent) => (
          <button
            key={agent}
            type="button"
            className="ink-chip rw-mention-btn"
            onClick={() => insertMention(agent)}
            aria-label={`Insert @${agent} mention`}
          >
            @{agent}
          </button>
        ))}
      </div>
      <div className="rw-composer-row">
        <textarea
          ref={ref}
          className="sketch sketch-b ink-input rw-composer-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          rows={1}
        />
        <Button
          variant="primary"
          shape="a"
          className="rw-send"
          onClick={onSend}
          aria-disabled={!canSend}
          aria-label="Send blip (Ctrl or Cmd + Enter)"
        >
          <PaperPlaneIcon className="rw-send-icon" />
          <span className="rw-send-text">Send</span>
        </Button>
      </div>
    </Card>
  );
}
