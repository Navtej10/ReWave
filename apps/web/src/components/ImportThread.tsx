import { useMemo, useState } from "react";
import { IMPORT_MAX_MESSAGES, parseThread, type ImportedMessage } from "../wave/importThread";
import { plural } from "../wave/format";
import { Button } from "./ui/index";
import { Modal } from "./rich/Modal";

/** Paste an email / Slack / chat thread; it becomes blips and @scribe writes the decision log (spec 04 R3). */
export function ImportThread(props: { onCancel: () => void; onImport: (messages: ImportedMessage[]) => void }) {
  const { onCancel, onImport } = props;
  const [text, setText] = useState("");
  const messages = useMemo(() => parseThread(text), [text]);
  const speakers = [...new Set(messages.map((m) => m.author))];
  return (
    <Modal label="Import a thread" onClose={onCancel} className="sketch sketch-a ink-card rc-import" initialFocus="textarea">
      <h2 className="rc-dialog__title">Import a thread</h2>
      <p className="rc-import__hint">
        Paste an email chain, a Slack export or any pasted conversation. Each message becomes a blip, then{" "}
        <span className="ink-chip rw-mention">@scribe</span> drafts the decision log.
      </p>
      <textarea
        className="sketch sketch-b ink-input rc-import__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={"Asha: We should ship Friday.\nBen: Too risky, QA isn't done."}
        aria-label="Thread to import"
      />
      <p className="rc-import__count" aria-live="polite">
        {messages.length === 0
          ? "Nothing to import yet."
          : `${plural(messages.length, "message")} from ${speakers.slice(0, 4).join(", ")}${speakers.length > 4 ? "\u2026" : ""}.`}
        {messages.length >= IMPORT_MAX_MESSAGES ? ` Only the first ${IMPORT_MAX_MESSAGES} are imported.` : ""}
      </p>
      <div className="rc-dialog__actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={messages.length === 0} onClick={() => onImport(messages)}>
          Import and summarize
        </Button>
      </div>
    </Modal>
  );
}
