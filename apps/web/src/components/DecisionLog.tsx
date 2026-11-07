import { useState } from "react";

/** Reserved slot above the thread for a future decision log. Collapsible, no logic. */
export function DecisionLog() {
  const [open, setOpen] = useState(true);
  return (
    <section className="rw-decisions" aria-label="Decision log">
      <button
        type="button"
        className="rw-decisions-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rw-decisions-title">Decision log</span>
        <span className={`rw-decisions-caret ${open ? "is-open" : ""}`} aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <div className="rw-decisions-body">
          <p className="rw-decisions-empty">
            No decisions yet. Ask <code>@scribe</code> to summarize.
          </p>
        </div>
      )}
    </section>
  );
}
