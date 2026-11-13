import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import type { AgentName, Attachment, BlipView, LinkPreview, Poll } from "../wave/types";
import { AGENT_NAMES } from "../wave/agents";
import {
  ACCEPT_ATTR,
  ACCEPT_MEDIA_ATTR,
  buildLinkPreview,
  captureScreenFile,
  extractUrl,
  type AddFilesOptions,
} from "../wave/attachments";
import { blipExcerpt } from "../wave/format";
import { useVoiceRecorder } from "../wave/useVoiceRecorder";
import { PaperPlaneIcon } from "../pages/WavePage/icons";
import { AttachmentTray } from "./rich/AttachmentTray";
import { AttachToolbar } from "./rich/AttachToolbar";
import { PollComposer } from "./rich/PollComposer";
import { CloseIcon } from "./rich/richIcons";
import { Button, Card, Ribbon } from "./ui/index";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  /** Uploads start only while the wave is connected. */
  online: boolean;
  attachments: Attachment[];
  onAddFiles: (files: File[], options?: AddFilesOptions) => void;
  onRemoveAttachment: (id: string) => void;
  onRetryAttachment: (id: string) => void;
  link: LinkPreview | null;
  onLinkChange: (link: LinkPreview | null) => void;
  poll: Poll | null;
  onPollChange: (poll: Poll | null) => void;
  replyTo: BlipView | null;
  onCancelReply: () => void;
  notice: string | null;
  onNotice: (message: string | null) => void;
  onOpenSketch: () => void;
}

/** Sticky bottom composer: mentions, attach toolbar, tray, growing textarea, Send (Ctrl/Cmd+Enter).
 *  Presentational: WavePanel owns the draft, the uploads and the post action. */
export function Composer(props: ComposerProps) {
  const { value, onChange, onSend, placeholder, attachments, onAddFiles, link, onLinkChange, poll, onPollChange, replyTo, notice, onNotice } =
    props;
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollSeed, setPollSeed] = useState("");

  const recorder = useVoiceRecorder(
    (file, durationSec) => onAddFiles([file], { kind: "voice", durationSec }),
    (message) => onNotice(message),
  );

  // Grow the textarea to fit its content (capped by CSS max-height).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Replying: put the caret back in the input.
  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Insert text at the caret, keeping the rest of the draft intact. */
  function insertAtCaret(text: string, caretOffset: number = text.length) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + caretOffset;
      el.setSelectionRange(caret, caret);
    });
  }

  function insertMention(agent: AgentName) {
    const before = value.slice(0, ref.current?.selectionStart ?? value.length);
    const lead = before && !/\s$/.test(before) ? " " : "";
    insertAtCaret(`${lead}@${agent} `);
  }

  function openPoll(seed = "") {
    setPollSeed(seed);
    setPollOpen(true);
  }

  function handleChange(next: string) {
    // "/poll" followed by a space or newline opens the poll composer; the rest seeds the question.
    const m = /^\/poll\s([\s\S]*)$/.exec(next);
    if (m) {
      onChange("");
      openPoll(m[1].trim());
      return;
    }
    onChange(next);
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      const allImages = files.every((f) => f.type.startsWith("image/"));
      onAddFiles(files, allImages ? { kind: "screenshot" } : undefined);
      return;
    }
    const url = extractUrl(e.clipboardData.getData("text"));
    if (url && !link) onLinkChange(buildLinkPreview(url)); // the URL still pastes as text too
  }

  async function takeScreenshot() {
    try {
      onAddFiles([await captureScreenFile()], { kind: "screenshot" });
    } catch (err) {
      // Dismissing the browser's picker is not an error.
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) return;
      onNotice("Screen capture isn\u2019t available here. Paste a screenshot with Ctrl+V instead.");
    }
  }

  function pickFrom(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length > 0) onAddFiles(files);
  }

  const canSend = (value.trim().length > 0 || attachments.length > 0 || poll !== null) && !recorder.recording;

  return (
    <Card className="rw-composer" shape="c">
      {notice ? (
        <Ribbon role="alert" className="rc-notice">
          <span className="rc-notice__row">
            <span>{notice}</span>
            <button type="button" className="rc-x" aria-label="Dismiss message" onClick={() => onNotice(null)}>
              <CloseIcon size={12} />
            </button>
          </span>
        </Ribbon>
      ) : null}

      {replyTo ? (
        <div className="rc-replying">
          <span className="rc-replying__text">
            <strong>Replying to {replyTo.author}</strong>
            <span>{blipExcerpt(replyTo, 100)}</span>
          </span>
          <button type="button" className="rc-x" aria-label="Cancel reply" onClick={props.onCancelReply}>
            <CloseIcon size={12} />
          </button>
        </div>
      ) : null}

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

      <AttachToolbar
        recording={recorder.recording}
        onAttachFile={() => fileRef.current?.click()}
        onAttachMedia={() => mediaRef.current?.click()}
        onScreenshot={() => void takeScreenshot()}
        onPoll={() => openPoll()}
        onVoice={() => (recorder.recording ? recorder.stop() : void recorder.start())}
        onSketch={props.onOpenSketch}
        onCode={() => insertAtCaret("```\n\n```", 4)}
      />
      <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ATTR} onChange={(e) => pickFrom(e.currentTarget)} />
      <input ref={mediaRef} type="file" hidden multiple accept={ACCEPT_MEDIA_ATTR} onChange={(e) => pickFrom(e.currentTarget)} />

      <AttachmentTray
        attachments={attachments}
        link={link}
        poll={poll}
        online={props.online}
        recording={recorder.recording}
        recordingSec={recorder.elapsedSec}
        onRemove={props.onRemoveAttachment}
        onRetry={props.onRetryAttachment}
        onRemoveLink={() => onLinkChange(null)}
        onEditPoll={() => openPoll()}
        onRemovePoll={() => onPollChange(null)}
        onStopRecording={recorder.stop}
      />

      <div className="rw-composer-row">
        <textarea
          ref={ref}
          className="sketch sketch-b ink-input rw-composer-input"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          aria-label={replyTo ? `Reply to ${replyTo.author}` : "Message"}
          rows={1}
        />
        <Button
          variant="primary"
          shape="a"
          className="rw-send"
          onClick={() => {
            if (canSend) onSend();
          }}
          aria-disabled={!canSend}
          aria-label="Send blip (Ctrl or Cmd + Enter)"
        >
          <PaperPlaneIcon className="rw-send-icon" />
          <span className="rw-send-text">Send</span>
        </Button>
      </div>

      {pollOpen ? (
        <PollComposer
          initial={poll}
          initialQuestion={pollSeed}
          onCancel={() => setPollOpen(false)}
          onSubmit={(p) => {
            onPollChange(p);
            setPollOpen(false);
          }}
        />
      ) : null}
    </Card>
  );
}
