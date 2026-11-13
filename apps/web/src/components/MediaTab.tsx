import { useRef, type KeyboardEvent } from "react";
import { Chip, DashedPanel, cx } from "./ui/index";
import { DownloadLink } from "./rich/FileBlip";
import { FileTypeIcon, PlayIcon } from "./rich/richIcons";
import { isMedia } from "../wave/attachments";
import { fileTypeOf, formatDuration, formatSize, plural } from "../wave/format";
import { isPollClosed, pollResults } from "../wave/polls";
import type { Attachment, BlipView } from "../wave/types";

/* ---------- Tab bar ---------- */

export type WaveTab = "thread" | "media" | "polls";

const TABS: { id: WaveTab; label: string }[] = [
  { id: "thread", label: "Thread" },
  { id: "media", label: "Media & files" },
  { id: "polls", label: "Polls" },
];

export const tabId = (t: WaveTab) => `rc-tab-${t}`;
export const PANEL_ID = "rc-tabpanel";

/** Roving-tabindex tablist with a hand-drawn underline under the active tab. */
export function WaveTabs({ tab, onChange }: { tab: WaveTab; onChange: (tab: WaveTab) => void }) {
  const refs = useRef(new Map<WaveTab, HTMLButtonElement>());

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current.get(TABS[next].id)?.focus();
  }

  return (
    <div className="rc-tabs" role="tablist" aria-label="Wave sections" onKeyDown={onKeyDown}>
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) refs.current.set(t.id, el);
              else refs.current.delete(t.id);
            }}
            id={tabId(t.id)}
            type="button"
            role="tab"
            className={cx("rc-tab", active && "is-active")}
            aria-selected={active}
            aria-controls={PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {active ? (
              <svg className="rc-tab__line" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M1 4.5 Q14 1.5 27 4 T52 3.6 T77 4.4 T99 3" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Media & files ---------- */

interface Located {
  blip: BlipView;
  attachment: Attachment;
}

function collect(blips: readonly BlipView[], pick: (a: Attachment) => boolean): Located[] {
  return blips
    .filter((b) => !b.deleted)
    .flatMap((blip) => blip.attachments.filter(pick).map((attachment) => ({ blip, attachment })));
}

export function MediaTab(props: {
  blips: readonly BlipView[];
  onOpenMedia: (items: Attachment[], index: number) => void;
  onJump: (blipId: string) => void;
}) {
  const { blips, onOpenMedia, onJump } = props;
  const media = collect(blips, (a) => isMedia(a) && Boolean(a.url));
  const files = collect(blips, (a) => a.kind === "file" || a.kind === "voice");
  const items = media.map((m) => m.attachment);

  if (media.length === 0 && files.length === 0) {
    return (
      <DashedPanel className="rc-empty rc-empty--tab">
        <h3 className="rc-empty__title">No attachments yet</h3>
        <p className="rc-empty__text">Drop images, videos or files on this wave, or use the paperclip in the composer.</p>
      </DashedPanel>
    );
  }

  return (
    <div className="rc-mediatab">
      <section aria-labelledby="rc-media-h">
        <h3 id="rc-media-h" className="rc-sectionh">
          Media <span className="rc-count">{media.length}</span>
        </h3>
        {media.length === 0 ? (
          <DashedPanel className="rc-empty rc-empty--slim">No images or videos yet</DashedPanel>
        ) : (
          <ul className="rc-mgrid">
            {media.map(({ attachment: a, blip }, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="sketch sketch-auto rc-mcell"
                  aria-label={`Open ${a.kind}: ${a.alt?.trim() || a.name}`}
                  onClick={() => onOpenMedia(items, i)}
                >
                  {a.kind === "video" ? (
                    a.posterUrl ? (
                      <img src={a.posterUrl} alt="" width={160} height={120} loading="lazy" decoding="async" />
                    ) : (
                      <span className="rc-mcell__blank" aria-hidden="true" />
                    )
                  ) : (
                    <img src={a.url} alt="" width={160} height={120} loading="lazy" decoding="async" />
                  )}
                  {a.kind === "video" ? (
                    <span className="rc-mcell__play" aria-hidden="true">
                      <PlayIcon size={22} />
                    </span>
                  ) : null}
                  {a.kind === "video" && a.durationSec ? (
                    <Chip className="rc-mcell__dur">{formatDuration(a.durationSec)}</Chip>
                  ) : null}
                </button>
                <button type="button" className="rc-linkbtn rc-mcell__jump" onClick={() => onJump(blip.id)}>
                  View in thread
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rc-files-h">
        <h3 id="rc-files-h" className="rc-sectionh">
          Files <span className="rc-count">{files.length}</span>
        </h3>
        {files.length === 0 ? (
          <DashedPanel className="rc-empty rc-empty--slim">No files yet</DashedPanel>
        ) : (
          <ul className="rc-flist">
            {files.map(({ attachment: a, blip }) => (
              <li key={a.id} className="sketch sketch-b rc-frow">
                <FileTypeIcon type={fileTypeOf(a.name, a.mimeType)} size={26} />
                <span className="rc-frow__meta">
                  <span className="rc-file__name" title={a.name}>
                    {a.name}
                  </span>
                  <span className="rc-file__sub">
                    {formatSize(a.size)} &middot; from {blip.author}
                  </span>
                </span>
                <button type="button" className="rc-linkbtn" onClick={() => onJump(blip.id)}>
                  View in thread
                </button>
                {a.url ? <DownloadLink attachment={a} /> : <span className="rc-file__sub">Uploading&hellip;</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- Polls ---------- */

export function PollsTab({ blips, onJump }: { blips: readonly BlipView[]; onJump: (blipId: string) => void }) {
  const polls = blips.filter((b) => b.poll && !b.deleted);
  if (polls.length === 0) {
    return (
      <DashedPanel className="rc-empty rc-empty--tab">
        <h3 className="rc-empty__title">No polls yet</h3>
        <p className="rc-empty__text">Type /poll in the composer, or use the poll button, to ask the room to decide.</p>
      </DashedPanel>
    );
  }
  const now = Date.now();
  const open = polls.filter((b) => !isPollClosed(b.poll!, now));
  const closed = polls.filter((b) => isPollClosed(b.poll!, now));

  const group = (title: string, list: BlipView[], id: string) => (
    <section aria-labelledby={id}>
      <h3 id={id} className="rc-sectionh">
        {title} <span className="rc-count">{list.length}</span>
      </h3>
      {list.length === 0 ? (
        <DashedPanel className="rc-empty rc-empty--slim">None</DashedPanel>
      ) : (
        <ul className="rc-flist">
          {list.map((b) => {
            const poll = b.poll!;
            const res = pollResults(poll);
            const isClosed = isPollClosed(poll, now);
            const winners = res.options.filter((o) => res.winnerIds.includes(o.id)).map((o) => o.label);
            return (
              <li key={b.id} className={cx("sketch sketch-auto rc-frow rc-prow", isClosed && "is-closed")}>
                <span className="rc-frow__meta">
                  <span className="rc-file__name">{poll.question}</span>
                  <span className="rc-file__sub">
                    {plural(res.totalVotes, "vote")} &middot; by {b.author}
                    {isClosed && winners.length > 0 ? ` \u00b7 Winner: ${winners.join(", ")}` : ""}
                  </span>
                </span>
                <Chip className={cx("rc-poll__chip", isClosed && "is-closed")}>{isClosed ? "Closed" : "Open"}</Chip>
                <button type="button" className="rc-linkbtn" onClick={() => onJump(b.id)}>
                  View in thread
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <div className="rc-mediatab">
      {group("Open", open, "rc-polls-open")}
      {group("Closed", closed, "rc-polls-closed")}
    </div>
  );
}
