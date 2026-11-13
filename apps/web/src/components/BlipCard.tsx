import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { AgentNameChip, agentOf } from "./AgentCards";
import { EditedIndicator } from "./EditedIndicator";
import { EditLockLabel } from "./EditLockLabel";
import { SourceChips } from "./SourceChips";
import { StanceChips } from "./StanceChips";
import { SketchProgress } from "./rich/AttachmentTray";
import { CodeBlip } from "./rich/CodeBlip";
import { FileBlip } from "./rich/FileBlip";
import { ImageGrid, ScreenshotBlip } from "./rich/ImageGrid";
import { LinkBlip } from "./rich/LinkBlip";
import { RichText } from "./rich/markdownLite";
import { PollBlip } from "./rich/PollBlip";
import { ReactionBar } from "./rich/ReactionBar";
import { PencilIcon, PinIcon, ReplyIcon, TrashIcon } from "./rich/richIcons";
import { VideoBlip } from "./rich/VideoBlip";
import { VoiceBlip } from "./rich/VoiceBlip";
import { Button, Card, cx } from "./ui/index";
import { relativeTime } from "./ui";
import { isMedia } from "../wave/attachments";
import { blipExcerpt } from "../wave/format";
import { decisionTextForPoll } from "../wave/polls";
import type { Attachment, BlipView, ReactionKey, Stance } from "../wave/types";

/** Everything a blip can ask the wave to do. One stable object per panel. */
export interface BlipActions {
  onReact: (blipId: string, key: ReactionKey) => void;
  onStance: (blipId: string, stance: Stance | null) => void;
  onReply: (blip: BlipView) => void;
  onTogglePin: (blipId: string) => void;
  onDelete: (blipId: string) => void;
  onEdit: (blipId: string, text: string) => void;
  setEditing: (blipId: string | null) => void;
  onVote: (blipId: string, optionId: string) => void;
  onClosePoll: (blipId: string) => void;
  onAddDecisions: (blipId: string, texts: string[], label: string) => void;
  onOpenMedia: (items: Attachment[], index: number) => void;
  onAnnotate: (blipId: string, attachment: Attachment) => void;
  onJump: (blipId: string) => void;
  onAltChange: (blipId: string, attachmentId: string, alt: string) => void;
  onRetryAttachment: (attachmentId: string) => void;
  /** True when this browser still holds the file, so Retry can work. */
  canRetry: (attachmentId: string) => boolean;
}

export function BlipCard(props: {
  blip: BlipView;
  /** The blip this one replies to (its parent), when it still exists. */
  parent?: BlipView;
  myName: string;
  lockedBy?: string;
  decided: boolean;
  actions: BlipActions;
}) {
  const { blip, parent, myName, lockedBy, decided, actions } = props;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditingLocal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pressTimer = useRef<number | undefined>(undefined);
  const keepRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => window.clearTimeout(pressTimer.current), []);
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);
  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);
  // Someone else grabbed the lock (after mine idled out): leave edit mode.
  useEffect(() => {
    if (lockedBy && editing) setEditingLocal(false);
  }, [lockedBy, editing]);
  // A poll is locked once the first vote lands: leave edit mode if one arrives mid-edit.
  const pollLocked = Boolean(blip.poll?.options.some((o) => o.votes.length > 0));
  useEffect(() => {
    if (pollLocked && editing) {
      setEditingLocal(false);
      actions.setEditing(null);
    }
  }, [pollLocked, editing, actions]);

  const agent = blip.kind === "agent" ? agentOf(blip.author) : null;
  const human = blip.kind === "human";
  const own = human && blip.author === myName;

  if (blip.deleted) {
    return (
      <article className="rw-blip-card rc-deleted" tabIndex={-1}>
        <p className="rc-deleted__text">This blip was deleted.</p>
      </article>
    );
  }

  const atts = blip.attachments;
  const ready = (a: Attachment) => Boolean(a.url);
  const images = atts.filter((a) => a.kind === "image" && ready(a));
  const shots = atts.filter((a) => a.kind === "screenshot" && ready(a));
  const videos = atts.filter((a) => a.kind === "video" && ready(a));
  const files = atts.filter((a) => a.kind === "file" && ready(a));
  const voices = atts.filter((a) => a.kind === "voice" && ready(a));
  const gallery = atts.filter((a) => isMedia(a) && ready(a));
  const pending = atts.filter((a) => a.status !== "done");

  const openAttachment = (a: Attachment) =>
    actions.onOpenMedia(gallery, Math.max(0, gallery.findIndex((g) => g.id === a.id)));

  function startPress(pointerType: string) {
    if (pointerType !== "touch") return;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPickerOpen(true), 500);
  }
  const cancelPress = () => window.clearTimeout(pressTimer.current);

  function startEdit() {
    setEditingLocal(true);
    actions.setEditing(blip.id);
  }
  function stopEdit() {
    setEditingLocal(false);
    actions.setEditing(null);
  }

  const showQuote = human && parent && !parent.deleted;

  return (
    <article
      className="rw-blip-card"
      tabIndex={-1}
      onPointerDown={(e) => startPress(e.pointerType)}
      onPointerUp={cancelPress}
      onPointerMove={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
    >
      <header className="rw-blip-head">
        {agent ? (
          <AgentNameChip agent={agent} />
        ) : (
          <>
            <Avatar name={blip.author} size="md" title={blip.author} />
            <span className="rw-blip-author">{blip.author}</span>
          </>
        )}
        <time className="rw-blip-time" dateTime={new Date(blip.createdAt).toISOString()}>
          {relativeTime(blip.createdAt)}
        </time>
        <EditedIndicator blip={blip} myName={myName} />
        {blip.pinned ? (
          <span className="rc-pinned-flag">
            <PinIcon size={12} />
            Pinned
          </span>
        ) : null}
        {lockedBy ? <EditLockLabel name={lockedBy} /> : null}
      </header>

      {showQuote ? (
        <button type="button" className="sketch sketch-c rc-quote" onClick={() => actions.onJump(parent.id)}>
          <strong>Replying to {parent.author}</strong>
          <span>{blipExcerpt(parent, 110)}</span>
        </button>
      ) : null}

      {editing && human ? (
        <div className="rc-edit">
          <textarea
            ref={editRef}
            className="rw-blip-edit"
            value={blip.text}
            rows={3}
            aria-label={`Edit ${blip.author}'s blip`}
            onChange={(e) => {
              actions.onEdit(blip.id, e.target.value);
              actions.setEditing(blip.id); // keep the lock alive on each keystroke
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                e.stopPropagation();
                stopEdit();
              }
            }}
          />
          <div className="rc-edit__row">
            <Button variant="primary" onClick={stopEdit}>
              Done
            </Button>
            <span className="rc-hint">Changes sync as you type. Ctrl+Enter or Esc to finish.</span>
          </div>
        </div>
      ) : blip.text.trim() ? (
        <div className={cx("rw-blip-body rc-body", lockedBy && "is-locked")}>
          <RichText text={blip.text} currentUserName={myName} onJump={actions.onJump} />
        </div>
      ) : null}

      {agent && !blip.card ? <SourceChips sources={blip.sources} onJump={actions.onJump} /> : null}

      {images.length > 0 ? (
        <ImageGrid
          images={images}
          canEditAlt={own}
          onOpen={(i) => openAttachment(images[i])}
          onAltChange={(attId, alt) => actions.onAltChange(blip.id, attId, alt)}
        />
      ) : null}
      {shots.length > 0 ? (
        <ScreenshotBlip
          screenshots={shots}
          canEditAlt={own}
          onOpen={(i) => openAttachment(shots[i])}
          onAnnotate={(a) => actions.onAnnotate(blip.id, a)}
          onAltChange={(attId, alt) => actions.onAltChange(blip.id, attId, alt)}
        />
      ) : null}
      {videos.map((v) => (
        <VideoBlip key={v.id} video={v} />
      ))}
      {voices.map((v) => (
        <VoiceBlip key={v.id} voice={v} />
      ))}
      {files.map((f) => (
        <FileBlip key={f.id} file={f} />
      ))}

      {pending.length > 0 ? (
        <ul className="rc-pending" aria-label="Upload status">
          {pending.map((a) => (
            <li key={a.id}>
              <span className="rc-pending__name">{a.name}</span>
              {a.status === "failed" ? (
                actions.canRetry(a.id) ? (
                  <>
                    <span>Upload failed</span>
                    <button type="button" className="rc-retry" onClick={() => actions.onRetryAttachment(a.id)}>
                      Retry
                    </button>
                  </>
                ) : (
                  <span>{blip.author}&rsquo;s upload failed</span>
                )
              ) : actions.canRetry(a.id) && a.status === "uploading" ? (
                <SketchProgress value={a.progress} label={`Uploading ${a.name}`} />
              ) : a.status === "queued" ? (
                <span>Will upload when you&rsquo;re back online</span>
              ) : (
                <span>Uploading&hellip;</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {blip.link ? <LinkBlip link={blip.link} /> : null}
      {blip.code ? <CodeBlip snippet={blip.code} /> : null}
      {blip.poll ? (
        <PollBlip
          poll={blip.poll}
          currentUserName={myName}
          isOwner={own}
          decided={decided}
          onVote={(optionId) => actions.onVote(blip.id, optionId)}
          onClosePoll={() => actions.onClosePoll(blip.id)}
          onAddToLog={() => {
            const text = blip.poll ? decisionTextForPoll(blip.poll) : null;
            if (text) actions.onAddDecisions(blip.id, [text], "poll");
          }}
        />
      ) : null}

      <ReactionBar
        reactions={blip.reactions}
        me={myName}
        pickerOpen={pickerOpen}
        onPickerOpenChange={setPickerOpen}
        onToggle={(k) => actions.onReact(blip.id, k)}
      />

      {confirming ? (
        <Card
          className="rc-confirm"
          role="alertdialog"
          aria-label="Delete this blip?"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirming(false);
          }}
        >
          <p className="rc-confirm__text">
            {agent ? "Dismiss this agent reply?" : "Delete this blip?"} Everyone in the wave will stop seeing it.
          </p>
          <div className="rc-confirm__row">
            <Button variant="secondary" onClick={() => actions.onDelete(blip.id)}>
              {agent ? "Dismiss" : "Delete"}
            </Button>
            <Button ref={keepRef} variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </Card>
      ) : (
        <footer className="rc-bfoot">
          <StanceChips stances={blip.stances} myName={myName} onChange={(s) => actions.onStance(blip.id, s)} />
          <div className="rc-acts" role="group" aria-label="Blip actions">
            <button type="button" className="rc-act" onClick={() => actions.onReply(blip)}>
              <ReplyIcon size={14} />
              Reply
            </button>
            <button type="button" className="rc-act" aria-pressed={blip.pinned} onClick={() => actions.onTogglePin(blip.id)}>
              <PinIcon size={14} />
              {blip.pinned ? "Unpin" : "Pin"}
            </button>
            {human && !editing && !pollLocked ? (
              <button
                type="button"
                className="rc-act"
                disabled={Boolean(lockedBy)}
                aria-label={lockedBy ? `Edit (locked: ${lockedBy} is editing)` : "Edit"}
                onClick={startEdit}
              >
                <PencilIcon size={14} />
                Edit
              </button>
            ) : null}
            {own || agent ? (
              <button type="button" className="rc-act rc-act--danger" onClick={() => setConfirming(true)}>
                <TrashIcon size={14} />
                {agent ? "Dismiss" : "Delete"}
              </button>
            ) : null}
          </div>
        </footer>
      )}
    </article>
  );
}
