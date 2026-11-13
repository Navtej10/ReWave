import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button, Chip, Sparkle, cx } from "../ui/index";
import { formatRelative, plural } from "../../wave/format";
import { isPollClosed, pollResults, resultSentence, votedOptionIds } from "../../wave/polls";
import { CheckIcon } from "./richIcons";
import type { Poll } from "../../wave/types";
import { initials as initialsOf } from "../ui";

export interface PollBlipProps {
  poll: Poll;
  currentUserName: string;
  /** The poll's author may close it early. */
  isOwner: boolean;
  /** A decision from this poll already exists in the log. */
  decided: boolean;
  /** Inert rendering for the composer preview. */
  preview?: boolean;
  onVote?: (optionId: string) => void;
  onClosePoll?: () => void;
  onAddToLog?: () => void;
}

/** Re-render when `closesAt` passes so the poll flips to Closed without a reload. */
function useNow(closesAt: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!closesAt) return;
    const t = Date.parse(closesAt);
    const wait = t - Date.now();
    if (Number.isNaN(t) || wait <= 0 || wait > 2_000_000_000) return;
    const id = window.setTimeout(() => setNow(Date.now()), wait + 50);
    return () => window.clearTimeout(id);
  }, [closesAt]);
  return now;
}

function Voters({ voters }: { voters: string[] }) {
  if (voters.length === 0) return null;
  const shown = voters.slice(0, 3);
  const extra = voters.length - shown.length;
  return (
    <span className="rc-voters" aria-hidden="true">
      {shown.map((v) => (
        <span key={v} className="rc-avatar rc-avatar--xs" title={v}>
          {initialsOf(v)}
        </span>
      ))}
      {extra > 0 ? <span className="rc-avatar rc-avatar--xs rc-avatar--more">+{extra}</span> : null}
    </span>
  );
}

export function PollBlip({ poll, currentUserName, isOwner, decided, preview = false, onVote, onClosePoll, onAddToLog }: PollBlipProps) {
  const now = useNow(poll.closesAt);
  const closed = isPollClosed(poll, now);
  const hatchBase = `rc-hatch-${useId().replace(/:/g, "")}`;
  const [announce, setAnnounce] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const results = pollResults(poll);
  const mine = votedOptionIds(poll, currentUserName);
  const showResults = closed || !poll.hideResultsUntilVoted || mine.length > 0 || preview;
  const inert = closed || preview;
  const role = poll.multiSelect ? "checkbox" : "radio";

  function say(message: string) {
    setAnnounce(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnnounce(""), 2500);
  }

  function vote(optionId: string) {
    if (inert) return;
    const wasSelected = mine.includes(optionId);
    onVote?.(optionId);
    say(wasSelected ? "Vote removed" : "Vote recorded");
  }

  // Arrow keys move between options, like a native radio group.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  const closesText =
    !closed && poll.closesAt ? `Closes ${formatRelative(Date.parse(poll.closesAt), now).replace(" ago", "")}` : null;

  return (
    <section className={cx("sketch sketch-a rc-poll", closed && "is-closed")} aria-label={`Poll: ${poll.question}`}>
      <header className="rc-poll__head">
        <h3 className="rc-poll__q">{poll.question}</h3>
        <span className="rc-poll__chips">
          {closed ? <Chip className="rc-poll__chip is-closed">Closed</Chip> : null}
          {poll.multiSelect ? <Chip className="rc-poll__chip">Pick several</Chip> : null}
          {poll.anonymous ? <Chip className="rc-poll__chip">Anonymous</Chip> : null}
        </span>
      </header>

      <div
        className="rc-poll__opts"
        role={poll.multiSelect ? "group" : "radiogroup"}
        aria-label={poll.question}
        onKeyDown={onKeyDown}
      >
        {results.options.map((r) => {
          const selected = mine.includes(r.id);
          const isWinner = closed && results.winnerIds.includes(r.id);
          const leading = showResults && !closed && r.isLeader && r.votes > 0;
          const pct = showResults ? r.percent : 0;
          const hatchId = `${hatchBase}-${r.id}`;
          return (
            <button
              key={r.id}
              type="button"
              role={role}
              aria-checked={selected}
              aria-label={showResults ? resultSentence(r) : r.label}
              disabled={inert}
              className={cx("sketch sketch-auto rc-popt", selected && "is-selected", isWinner && "is-winner")}
              onClick={() => vote(r.id)}
            >
              {/* Vote share as pencil hatching. An SVG width attribute, not an inline style. */}
              <svg className="rc-popt__fill" aria-hidden="true" focusable="false">
                <defs>
                  <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="6" className="rc-popt__hatch" />
                  </pattern>
                </defs>
                <rect className="rc-popt__bar" x="0" y="0" height="100%" width={`${pct}%`} fill={`url(#${hatchId})`} />
              </svg>
              <span className="rc-popt__row">
                <span className="rc-popt__mark" aria-hidden="true">
                  {selected ? <CheckIcon size={16} className="rc-popt__check" /> : null}
                </span>
                <span className="rc-popt__label">{r.label}</span>
                {isWinner || leading ? <Sparkle size={14} rotate={10} className="rc-popt__spark" /> : null}
                {showResults ? (
                  <span className="rc-popt__count" aria-hidden="true">
                    {r.votes} &middot; {r.percent}%
                  </span>
                ) : null}
              </span>
              {showResults && !poll.anonymous ? <Voters voters={r.voters} /> : null}
            </button>
          );
        })}
      </div>

      <footer className="rc-poll__foot">
        <span className="rc-poll__meta">
          {showResults ? plural(results.totalVotes, "vote") : "Vote to see results"}
          {closesText ? ` \u00b7 ${closesText}` : ""}
          {!closed && !preview ? " \u00b7 You can change your vote until it closes" : ""}
        </span>
        {!preview ? (
          <span className="rc-poll__actions">
            {!closed && isOwner ? (
              <Button variant="ghost" onClick={onClosePoll}>
                Close poll
              </Button>
            ) : null}
            {closed && results.winnerIds.length > 0 ? (
              decided ? (
                <Chip className="rc-poll__chip">In Decision log</Chip>
              ) : (
                <Button variant="primary" onClick={onAddToLog}>
                  Add to Decision log
                </Button>
              )
            ) : null}
          </span>
        ) : null}
      </footer>

      <div className="rc-sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </section>
  );
}
