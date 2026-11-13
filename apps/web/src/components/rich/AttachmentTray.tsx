import { useId } from "react";
import { cx } from "../ui/index";
import { formatDuration, formatSize, fileTypeOf } from "../../wave/format";
import { CloseIcon, FileTypeIcon, LinkIcon, MicIcon, PlayIcon, PollIcon, RetryIcon } from "./richIcons";
import type { Attachment, LinkPreview, Poll } from "../../wave/types";

/** Wobbly ink-outlined progress bar with a blue fill. */
export function SketchProgress({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const clipId = `rc-prog-${useId().replace(/:/g, "")}`;
  return (
    <div className="rc-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <clipPath id={clipId}>
          <rect x="0" y="0" width={pct} height="10" />
        </clipPath>
        <path className="rc-progress__fill" clipPath={`url(#${clipId})`} d="M1.5 2.2 Q25 1 50 2.4 T98.5 2 L98.3 8 Q75 9 50 7.7 T1.7 8.2 Z" />
        <path className="rc-progress__line" d="M1.5 2.2 Q25 .8 50 2.4 T98.5 2 L98.3 8 Q75 9.2 50 7.7 T1.7 8.2 Z" />
      </svg>
    </div>
  );
}

export interface AttachmentTrayProps {
  attachments: Attachment[];
  link: LinkPreview | null;
  poll: Poll | null;
  online: boolean;
  recording: boolean;
  recordingSec: number;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onRemoveLink: () => void;
  onEditPoll: () => void;
  onRemovePoll: () => void;
  onStopRecording: () => void;
}

/** Horizontally scrollable row of small cards above the input. */
export function AttachmentTray(p: AttachmentTrayProps) {
  const empty = p.attachments.length === 0 && !p.link && !p.poll && !p.recording;
  if (empty) return null;
  const waiting = !p.online && p.attachments.some((a) => a.status === "queued");

  return (
    <div className="rc-tray-wrap">
      <ul className="rc-tray" aria-label="Attachments">
        {p.recording ? (
          <li className="sketch sketch-c rc-tcard rc-tcard--rec">
            <MicIcon />
            <span className="rc-tcard__meta">
              <strong>Recording {formatDuration(p.recordingSec)}</strong>
              <button type="button" className="rc-linkbtn" onClick={p.onStopRecording}>
                Stop and attach
              </button>
            </span>
          </li>
        ) : null}

        {p.attachments.map((a) => {
          const isVisual = a.kind === "image" || a.kind === "screenshot" || a.kind === "video";
          return (
            <li key={a.id} className={cx("sketch sketch-auto rc-tcard", a.status === "failed" && "is-failed")}>
              {isVisual ? (
                <span className="rc-tcard__thumb">
                  {a.kind === "video" ? (
                    <>
                      <video src={a.url} preload="metadata" muted tabIndex={-1} aria-hidden="true" />
                      <PlayIcon className="rc-tcard__play" size={20} />
                    </>
                  ) : (
                    <img src={a.url} alt="" width={64} height={64} loading="lazy" />
                  )}
                </span>
              ) : a.kind === "voice" ? (
                <MicIcon size={28} />
              ) : (
                <FileTypeIcon type={fileTypeOf(a.name, a.mimeType)} />
              )}

              <span className="rc-tcard__meta">
                <span className="rc-tcard__name" title={a.name}>
                  {a.name}
                </span>
                <span className="rc-tcard__sub">
                  {a.kind === "voice" && a.durationSec ? `${formatDuration(a.durationSec)} \u00b7 ` : ""}
                  {formatSize(a.size)}
                </span>
                {a.status === "uploading" ? <SketchProgress value={a.progress} label={`Uploading ${a.name}`} /> : null}
                {a.status === "queued" && !p.online ? (
                  <span className="rc-tcard__sub rc-tcard__sub--wait">Will upload when you&rsquo;re back online</span>
                ) : null}
                {a.status === "queued" && p.online ? <span className="rc-tcard__sub">Waiting to upload</span> : null}
                {a.status === "failed" ? (
                  <button type="button" className="rc-retry" onClick={() => p.onRetry(a.id)} aria-label={`Retry upload of ${a.name}`}>
                    <RetryIcon size={12} />
                    Retry
                  </button>
                ) : null}
              </span>

              <button type="button" className="rc-x" aria-label={`Remove ${a.name}`} onClick={() => p.onRemove(a.id)}>
                <CloseIcon size={12} />
              </button>
            </li>
          );
        })}

        {p.link ? (
          <li className="sketch sketch-b rc-tcard">
            <LinkIcon size={26} />
            <span className="rc-tcard__meta">
              <span className="rc-tcard__name" title={p.link.url}>
                {p.link.title}
              </span>
              <span className="rc-tcard__sub">Link preview &middot; {p.link.domain}</span>
            </span>
            <button type="button" className="rc-x" aria-label="Remove link preview" onClick={p.onRemoveLink}>
              <CloseIcon size={12} />
            </button>
          </li>
        ) : null}

        {p.poll ? (
          <li className="sketch sketch-a rc-tcard">
            <PollIcon size={26} />
            <span className="rc-tcard__meta">
              <span className="rc-tcard__name" title={p.poll.question}>
                {p.poll.question}
              </span>
              <button type="button" className="rc-linkbtn" onClick={p.onEditPoll}>
                Edit poll ({p.poll.options.length} options)
              </button>
            </span>
            <button type="button" className="rc-x" aria-label="Remove poll" onClick={p.onRemovePoll}>
              <CloseIcon size={12} />
            </button>
          </li>
        ) : null}
      </ul>
      {waiting ? (
        <p className="rc-tray__caption" role="status">
          Will upload when you&rsquo;re back online.
        </p>
      ) : null}
    </div>
  );
}
