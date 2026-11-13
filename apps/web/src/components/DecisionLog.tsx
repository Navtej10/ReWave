import { useState } from "react";
import { ChevronDownIcon } from "../pages/WavePage/icons";
import { PinIcon } from "./rich/richIcons";
import { relativeTime } from "./ui";
import { blipExcerpt } from "../wave/format";
import type { BlipView, Decision } from "../wave/types";
import { Card } from "./ui/index";

/** Collapsible decision log above the thread. Entries are synced in the wave's own doc. */
export function DecisionLog(props: { decisions?: Decision[]; onJump?: (blipId: string) => void }) {
  const { decisions = [], onJump } = props;
  const [open, setOpen] = useState(true);
  return (
    <Card className="rw-decisions" shape="a" aria-label="Decision log" role="region">
      <button
        type="button"
        className="rw-decisions-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rw-decisions-title">
          Decision log{decisions.length > 0 ? <span className="rc-count"> {decisions.length}</span> : null}
        </span>
        <ChevronDownIcon className={`rw-decisions-caret ${open ? "" : "is-closed"}`} />
      </button>
      {open &&
        (decisions.length === 0 ? (
          <p className="rw-decisions-empty">
            No decisions yet. Ask <span className="ink-chip rw-mention">@scribe</span> to summarize.
          </p>
        ) : (
          <ul className="rc-decisions">
            {decisions.map((d) => (
              <li key={d.id} className="rc-decision">
                <span className="rc-decision__text">{d.text}</span>
                <span className="rc-decision__meta">
                  {d.author} &middot; {relativeTime(d.createdAt)}
                  {d.sourceBlipId && onJump ? (
                    <>
                      {" \u00b7 "}
                      <button type="button" className="rc-linkbtn" onClick={() => onJump(d.sourceBlipId!)}>
                        {d.sourceLabel === "poll" ? "View poll" : "View source"}
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </Card>
  );
}

/** Collapsible "Pinned" card under the Decision log. Hidden when nothing is pinned. */
export function PinnedPanel(props: { pinned: BlipView[]; onJump: (blipId: string) => void; onUnpin: (blipId: string) => void }) {
  const { pinned, onJump, onUnpin } = props;
  const [open, setOpen] = useState(true);
  if (pinned.length === 0) return null;
  return (
    <Card className="rw-decisions rc-pinned" shape="b" aria-label="Pinned blips" role="region">
      <button type="button" className="rw-decisions-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="rw-decisions-title">
          <PinIcon size={14} /> Pinned <span className="rc-count">{pinned.length}</span>
        </span>
        <ChevronDownIcon className={`rw-decisions-caret ${open ? "" : "is-closed"}`} />
      </button>
      {open ? (
        <ul className="rc-decisions">
          {pinned.map((b) => (
            <li key={b.id} className="rc-decision rc-decision--row">
              <button type="button" className="rc-pinrow" onClick={() => onJump(b.id)}>
                <strong>{b.author}</strong> {blipExcerpt(b, 80)}
              </button>
              <button type="button" className="rc-linkbtn" onClick={() => onUnpin(b.id)} aria-label={`Unpin: ${blipExcerpt(b, 40)}`}>
                Unpin
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
