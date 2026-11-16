import { useEffect, useId, useRef, useState } from "react";
import type { PersonView } from "../wave/types";
import { Avatar } from "./Avatar";
import { PresenceBar } from "./PresenceBar";

const ACTIVITY_TEXT: Record<NonNullable<PersonView["activity"]>, string> = {
  typing: "typing\u2026",
  editing: "editing a blip",
};

/** Avatar stack that opens a list of everyone connected, with full names and what they are doing. */
export function PeopleMenu({ people }: { people: PersonView[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const names = people.map((p) => p.name);
  const active = people.filter((p) => p.activity).length;
  const count = people.length;

  return (
    <span className="rw-people" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="rw-people-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`People here now: ${count}. Show list`}
        onClick={() => setOpen((o) => !o)}
      >
        <PresenceBar names={names} />
        {active > 0 && <span className="rw-people-live" aria-hidden="true" />}
      </button>
      {open && (
        <div className="rw-people-panel" id={panelId} role="region" aria-label="People in this wave">
          <p className="rw-people-title">Here now ({count})</p>
          <ul className="rw-people-list" aria-live="polite">
            {people.map((p) => (
              <li key={p.name} className="rw-people-row">
                <Avatar name={p.name} size="md" title={p.name} />
                <span className="rw-people-name">
                  {p.name}
                  {p.isMe ? <span className="rw-people-me"> (you)</span> : null}
                </span>
                <span className="rw-people-status">{p.activity ? ACTIVITY_TEXT[p.activity] : "online"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}