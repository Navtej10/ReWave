import { useMemo, useState, type FormEvent } from "react";
import { ChevronDownIcon } from "../pages/WavePage/icons";
import { PinIcon } from "./rich/richIcons";
import { RichText } from "./rich/markdownLite";
import { relativeTime } from "./ui";
import { blipExcerpt } from "../wave/format";
import { dropUnknownCitations } from "../wave/agents";
import { decisionsToMarkdown } from "../wave/decisions";
import { decisionSources } from "../wave/decisionSources";
import { buildReplayFrames } from "../wave/replayFrames";
import type { BlipView, Decision } from "../wave/types";
import { Button, Card, Input } from "./ui/index";

const MAX_DECISION_CHARS = 600;

export interface DecisionLogProps {
  decisions?: Decision[];
  /** All blips in thread order; used to resolve each decision's source chips. */
  blips?: BlipView[];
  myName?: string;
  /** Jump to the blip a decision (or a [b:id] citation inside it) points at. */
  onJump?: (blipId: string) => void;
  /** Record a decision by hand. */
  onAdd?: (text: string) => void;
  onRemove?: (id: string) => void;
  /** Open the replay of how the thread built up to a decision. */
  onReplay?: (decision: Decision) => void;
  /** Export a decision and its thread as a Kiro spec folder. */
  onExportSpec?: (decision: Decision) => void;
  /** Ask @scribe to summarize the whole wave. Humans trigger this; agents never start it. */
  onAskScribe?: () => void;
  /** Scribe is already working, or the wave has nothing to summarize yet. */
  scribeDisabled?: boolean;
  scribeBusy?: boolean;
}

/** Chips (cited blip's author) that jump to the blips a decision came from. Renders nothing without sources. */
function DecisionSources(props: { sources: string[]; authorOf: Map<string, string>; onJump?: (blipId: string) => void }) {
  const { sources, authorOf, onJump } = props;
  if (sources.length === 0) return null;
  return (
    <p className="rw-sources">
      <span className="rw-sources-label">Raised in</span>
      {sources.map((id) => {
        const author = authorOf.get(id) ?? "blip";
        return (
          <button key={id} type="button" className="rw-source-chip" onClick={() => onJump?.(id)} aria-label={`Jump to blip by ${author}`}>
            {author}
          </button>
        );
      })}
    </p>
  );
}

/** Collapsible decision log above the thread. Entries are synced in the wave's own doc. */
export function DecisionLog(props: DecisionLogProps) {
  const { decisions = [], blips = [], myName = "", onJump, onAdd, onRemove, onReplay, onExportSpec, onAskScribe, scribeDisabled, scribeBusy } = props;
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const blipIds = useMemo(() => blips.map((b) => b.id), [blips]);
  const authorOf = useMemo(() => new Map(blips.map((b) => [b.id, b.author])), [blips]);
  // Decisions whose replay would be empty (nothing to show) get a disabled Replay button.
  const replayable = useMemo(() => new Set(onReplay ? decisions.filter((d) => buildReplayFrames(blips, d).length > 0).map((d) => d.id) : []), [onReplay, decisions, blips]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !onAdd) return;
    onAdd(text.slice(0, MAX_DECISION_CHARS));
    setDraft("");
  }

  async function copy() {
    try {
      await navigator.clipboard?.writeText(decisionsToMarkdown(decisions, undefined, blips));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context): nothing useful to show.
    }
  }

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
      {open && (
        <>
          {decisions.length === 0 ? (
            <p className="rw-decisions-empty">
              No decisions yet. Ask <span className="ink-chip rw-mention">@scribe</span> to summarize, or record one below.
            </p>
          ) : (
            <ul className="rc-decisions">
              {decisions.map((d) => (
                <li key={d.id} className="rc-decision rc-decision--entry">
                  <div className="rc-decision__main">
                    <div className="rc-decision__text">
                      <RichText text={dropUnknownCitations(d.text, new Set())} currentUserName={myName} onJump={onJump} />
                    </div>
                    <DecisionSources sources={decisionSources(d, blipIds)} authorOf={authorOf} onJump={onJump} />
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
                      {onReplay ? (
                        <>
                          {" \u00b7 "}
                          <button
                            type="button"
                            className="rc-linkbtn rc-replay-open"
                            disabled={!replayable.has(d.id)}
                            title={replayable.has(d.id) ? undefined : "No blips to replay for this decision"}
                            aria-label={`Replay how the thread led to: ${d.text.replace(/\[b:[^\]]+\]/g, "").trim().slice(0, 60)}`}
                            onClick={() => onReplay(d)}
                          >
                            Replay
                          </button>
                        </>
                      ) : null}
                      {onExportSpec ? (
                        <>
                          {" \u00b7 "}
                          <button
                            type="button"
                            className="rc-linkbtn rc-spec-open"
                            aria-label={`Export to Kiro spec: ${d.text.replace(/\[b:[^\]]+\]/g, "").trim().slice(0, 60)}`}
                            onClick={() => onExportSpec(d)}
                          >
                            Export to Kiro spec
                          </button>
                        </>
                      ) : null}
                    </span>
                  </div>
                  {onRemove ? (
                    <button
                      type="button"
                      className="rc-linkbtn"
                      onClick={() => onRemove(d.id)}
                      aria-label={`Remove decision: ${d.text.replace(/\[b:[^\]]+\]/g, "").trim().slice(0, 60)}`}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="rc-decisions-tools">
            {onAskScribe ? (
              <Button variant="secondary" onClick={onAskScribe} aria-disabled={scribeDisabled} disabled={scribeDisabled}>
                {scribeBusy ? "@scribe is reading\u2026" : "Ask @scribe to summarize"}
              </Button>
            ) : null}
            {decisions.length > 0 ? (
              <Button variant="ghost" onClick={() => void copy()} aria-live="polite">
                {copied ? "Copied" : "Copy as Markdown"}
              </Button>
            ) : null}
          </div>
          {onAdd ? (
            <form className="rc-decision-form" onSubmit={submit}>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_DECISION_CHARS}
                placeholder="Record a decision, e.g. Ship on Friday"
                aria-label="Record a decision"
              />
              <Button type="submit" variant="primary" disabled={!draft.trim()}>
                Add
              </Button>
            </form>
          ) : null}
        </>
      )}
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
