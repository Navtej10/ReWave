import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from "react";
import { dropUnknownCitations } from "../wave/agents";
import {
  captionAt,
  isFresh,
  narrate,
  sanitizeCaptions,
  type ReplayCaption,
  type ReplayEntry,
} from "../wave/replayCaptions";
import { buildReplayFrames } from "../wave/replayFrames";
import { dwellMs, initialPlayback, isReplaySpeed, playbackReducer, REPLAY_SPEEDS } from "../wave/replayPlayback";
import type { BlipView, Decision } from "../wave/types";
import { BlipNode, type ReplayDecor } from "./BlipNode";
import type { BlipActions } from "./BlipCard";
import { Modal } from "./rich/Modal";
import { RichText } from "./rich/markdownLite";
import { relativeTime } from "./ui";
import { Button } from "./ui/index";

const ID_PREFIX = "rp-b-";
const NOOP = () => {};
const NO_TYPERS: never[] = [];
const NO_EDITORS = new Map<string, string>();
const NO_DECIDED = new Set<string | undefined>();
const NO_PENDING: never[] = [];

type Narration =
  | { status: "loading" }
  | { status: "ready"; captions: ReplayCaption[] }
  | { status: "failed"; message: string };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A replay shows the thread as it ended up, so a poll is shown closed: no voting from inside a replay. */
function frozen(b: BlipView): BlipView {
  return b.poll ? { ...b, poll: { ...b.poll, closed: true } } : b;
}

export interface ReplayViewProps {
  decision: Decision;
  /** All blips of the wave, in wave order. The replay takes a snapshot when it opens. */
  blips: readonly BlipView[];
  /** Cached captions for this decision from the wave's doc, if any. */
  cached?: ReplayEntry;
  /** Store captions in the wave's doc; returns the entry that ended up there (see replays.saveReplay). */
  onSaveCaptions: (decisionId: string, entry: ReplayEntry, force: boolean) => ReplayEntry;
  onClose: () => void;
}

/**
 * Focused, read-only replay of how the thread built up to a decision. Blips appear one at a time in
 * their final text; cited blips are marked; short AI captions (cached in the wave's doc) narrate.
 */
export function ReplayView({ decision, blips, cached, onSaveCaptions, onClose }: ReplayViewProps) {
  const [frames] = useState(() => buildReplayFrames(blips, decision));
  const frameIds = useMemo(() => frames.map((f) => f.blip.id), [frames]);
  const reduced = useMemo(prefersReducedMotion, []);
  const [play, dispatch] = useReducer(playbackReducer, undefined, () => initialPlayback(frames.length, !prefersReducedMotion()));
  const total = frames.length;
  const current = frames[play.index];
  const isLast = total > 0 && play.index >= total - 1;

  /* ---------- Narration ---------- */

  const [narration, setNarration] = useState<Narration>(() =>
    isFresh(cached, total) ? { status: "ready", captions: sanitizeCaptions(cached.captions, frameIds) } : { status: "loading" },
  );
  const alive = useRef(true);
  const saveRef = useRef(onSaveCaptions);
  saveRef.current = onSaveCaptions;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const generate = useCallback(
    async (force: boolean) => {
      if (total === 0) return;
      setNarration({ status: "loading" });
      try {
        const captions = await narrate(frames, decision.text);
        // The doc decides which version wins when two people ask at once.
        const stored = saveRef.current(decision.id, { captions, generatedAt: Date.now(), frameCount: total }, force);
        if (alive.current) setNarration({ status: "ready", captions: sanitizeCaptions(stored.captions, frameIds) });
      } catch (e) {
        if (alive.current) setNarration({ status: "failed", message: e instanceof Error ? e.message : "Captions couldn't be written." });
      }
    },
    [frames, frameIds, total, decision.id, decision.text],
  );

  useEffect(() => {
    if (narration.status === "loading") void generate(false);
    // Once, on open: a fresh cached entry skips the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Playback ---------- */

  useEffect(() => {
    if (play.status !== "playing") return;
    const id = window.setTimeout(() => dispatch({ type: "tick" }), dwellMs(current?.cited ?? false, play.total, play.speed));
    return () => window.clearTimeout(id);
  }, [play.status, play.index, play.speed, play.total, current]);

  // Keep the newest blip in view.
  const currentId = current?.blip.id;
  useEffect(() => {
    if (currentId) document.getElementById(ID_PREFIX + currentId)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [currentId, reduced]);

  // Space toggles play, Left/Right step. Native keys on a focused control keep their meaning.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const tag = target?.tagName ?? "";
      if (e.key === " ") {
        if (["BUTTON", "SELECT", "TEXTAREA", "A"].includes(tag)) return;
        e.preventDefault();
        dispatch({ type: "toggle" });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
        e.preventDefault();
        dispatch({ type: e.key === "ArrowLeft" ? "prev" : "next" });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- Thread (visible frames only) ---------- */

  const visible = useMemo(() => frames.slice(0, play.index + 1).map((f) => frozen(f.blip)), [frames, play.index]);
  const { roots, childrenOf, byId } = useMemo(() => {
    const ids = new Set(visible.map((b) => b.id));
    const kids = new Map<string, BlipView[]>();
    const top: BlipView[] = [];
    for (const b of visible) {
      if (b.parentId && ids.has(b.parentId)) kids.set(b.parentId, [...(kids.get(b.parentId) ?? []), b]);
      else top.push(b);
    }
    return { roots: top, childrenOf: kids, byId: new Map(visible.map((b) => [b.id, b])) };
  }, [visible]);

  const citedIds = useMemo(() => new Set(frames.filter((f) => f.cited).map((f) => f.blip.id)), [frames]);
  const decor = useMemo<ReplayDecor>(
    () => ({
      idPrefix: ID_PREFIX,
      className: (id) => [citedIds.has(id) ? "rc-replay-cited" : "", id === currentId ? "rc-replay-current" : ""].filter(Boolean).join(" "),
      badge: (id) => (citedIds.has(id) ? <span className="rc-replay-badge">Cited</span> : null),
    }),
    [citedIds, currentId],
  );
  const jump = useCallback(
    (id: string) => document.getElementById(ID_PREFIX + id)?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }),
    [reduced],
  );
  const actions = useMemo<BlipActions>(
    () => ({
      onReact: NOOP,
      onStance: NOOP,
      onReply: NOOP,
      onTogglePin: NOOP,
      onDelete: NOOP,
      onEdit: NOOP,
      setEditing: NOOP,
      onVote: NOOP,
      onClosePoll: NOOP,
      onAddDecisions: NOOP,
      onOpenMedia: NOOP,
      onAnnotate: NOOP,
      onJump: jump,
      onAltChange: NOOP,
      onRetryAttachment: NOOP,
      canRetry: () => false,
    }),
    [jump],
  );

  /* ---------- Caption bar ---------- */

  const caption = narration.status === "ready" ? captionAt(frameIds, narration.captions, play.index) : null;
  const captionText =
    narration.status === "loading" ? "Writing captions\u2026" : narration.status === "failed" ? "Captions are unavailable." : (caption?.text ?? "");
  const decisionText = dropUnknownCitations(decision.text, new Set());

  return (
    <Modal label="Decision replay" onClose={onClose} className="sketch sketch-a ink-card rc-replay" initialFocus=".rc-replay__play">
      <header className="rc-replay__head">
        <h2 className="rc-dialog__title">How this decision formed</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close replay">
          Close
        </Button>
      </header>
      <p className="rc-replay__note">Replay shows each blip in its final text, not every keystroke.</p>

      {total === 0 ? (
        <p className="rc-replay__empty">There are no blips to replay for this decision.</p>
      ) : (
        <div className={isLast ? "rc-replay__body rc-replay__body--final" : "rc-replay__body"}>
          <div className="rc-replay__thread" tabIndex={0} role="region" aria-label="Thread so far">
            <ul className="rw-thread rc-replay-thread">
              {roots.map((b) => (
                <BlipNode
                  key={b.id}
                  blip={b}
                  childrenOf={childrenOf}
                  byId={byId}
                  typers={NO_TYPERS}
                  editors={NO_EDITORS}
                  myName=""
                  highlightId={null}
                  decidedIds={NO_DECIDED}
                  pending={NO_PENDING}
                  actions={actions}
                  replay={decor}
                />
              ))}
            </ul>
          </div>
          {isLast ? (
            <aside className="rc-replay__decision" aria-label="Decision">
              <h3 className="rc-replay__decision-title">Decision</h3>
              <div className="rc-replay__decision-text">
                <RichText text={decisionText} currentUserName="" />
              </div>
              <p className="rc-replay__decision-meta">
                {decision.author} &middot; {relativeTime(decision.createdAt)}
              </p>
            </aside>
          ) : null}
        </div>
      )}

      <div className="rc-replay__caption" aria-live="polite" aria-atomic="true">
        {captionText}
      </div>
      {narration.status === "failed" ? (
        <p className="rc-replay__notice" role="status">
          {narration.message} The replay still works without captions.{" "}
          <button type="button" className="rc-linkbtn" onClick={() => void generate(false)}>
            Try again
          </button>
        </p>
      ) : null}

      <div className="rc-replay__controls">
        <Button variant="ghost" onClick={() => dispatch({ type: "prev" })} disabled={play.index <= 0} aria-label="Back one blip">
          Back
        </Button>
        <Button
          variant="primary"
          className="rc-replay__play"
          onClick={() => dispatch({ type: "toggle" })}
          disabled={total === 0}
          aria-label={play.status === "playing" ? "Pause" : isLast ? "Replay from the start" : "Play"}
        >
          {play.status === "playing" ? "Pause" : isLast ? "Again" : "Play"}
        </Button>
        <Button variant="ghost" onClick={() => dispatch({ type: "next" })} disabled={total === 0 || isLast} aria-label="Next blip">
          Next
        </Button>
        <input
          className="rc-replay__scrub"
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          step={1}
          value={play.index}
          disabled={total === 0}
          aria-label="Replay position"
          aria-valuetext={total === 0 ? "No blips" : `Blip ${play.index + 1} of ${total}`}
          onChange={(e: ChangeEvent<HTMLInputElement>) => dispatch({ type: "seek", index: Number(e.target.value) })}
        />
        <span className="rc-replay__count" aria-hidden="true">
          {total === 0 ? "0 / 0" : `${play.index + 1} / ${total}`}
        </span>
        <label className="rc-replay__speed">
          <span>Speed</span>
          <select
            value={play.speed}
            onChange={(e) => {
              const speed = Number(e.target.value);
              if (isReplaySpeed(speed)) dispatch({ type: "speed", speed });
            }}
          >
            {REPLAY_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rc-replay__foot">
        <Button variant="ghost" onClick={() => void generate(true)} disabled={narration.status === "loading" || total === 0}>
          Regenerate captions
        </Button>
      </div>
    </Modal>
  );
}
