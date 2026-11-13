import { useState } from "react";
import { ChevronDownIcon } from "../pages/WavePage/icons";
import { Card } from "./ui/index";

/** Reserved slot above the thread for a future decision log. Collapsible, no logic. */
export function DecisionLog() {
  const [open, setOpen] = useState(true);
  return (
    <Card className="rw-decisions" shape="a" aria-label="Decision log" role="region">
      <button
        type="button"
        className="rw-decisions-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rw-decisions-title">Decision log</span>
        <ChevronDownIcon className={`rw-decisions-caret ${open ? "" : "is-closed"}`} />
      </button>
      {open && (
        <p className="rw-decisions-empty">
          No decisions yet. Ask <span className="ink-chip rw-mention">@scribe</span> to summarize.
        </p>
      )}
    </Card>
  );
}
