import { deriveTitle, type WaveSummary } from "../wave/waveIndex";
import { Avatar } from "./Avatar";
import { relativeTime } from "./ui";

/** One row in the wave list: title, snippet + author, time, participants, presence, unread.
 *  Presentational only — selection, presence and unread are passed in. */
export function WaveListItem(props: {
  wave: WaveSummary;
  selected: boolean;
  someoneHere: boolean;
  unread: number;
  onOpen: () => void;
  /** Roving tabindex: only the active row is tabbable (keyboard nav in WaveList). */
  tabIndex: number;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const { wave, selected, someoneHere, unread, onOpen, tabIndex, registerRef } = props;
  const title = deriveTitle(wave);
  const shown = wave.participants.slice(0, 3);
  const overflow = wave.participants.length - shown.length;
  const snippet = wave.lastSnippet
    ? `${wave.lastAuthor ? `${wave.lastAuthor}: ` : ""}${wave.lastSnippet}`
    : "No blips yet";

  return (
    <li role="presentation">
      <button
        type="button"
        ref={registerRef}
        className={`rw-waverow${selected ? " is-selected" : ""}`}
        role="option"
        aria-selected={selected}
        aria-current={selected ? "true" : undefined}
        tabIndex={tabIndex}
        onClick={onOpen}
      >
        <span className="rw-waverow-top">
          <span className="rw-waverow-title">{title}</span>
          {wave.lastActivity > 0 && (
            <span className="rw-waverow-time">{relativeTime(wave.lastActivity)}</span>
          )}
        </span>

        <span className="rw-waverow-snippet">{snippet}</span>

        <span className="rw-waverow-foot">
          <span className="rw-waverow-people">
            {shown.map((name) => (
              <Avatar key={name} name={name} size="sm" title={name} />
            ))}
            {overflow > 0 && (
              <Avatar
                name="overflow"
                size="sm"
                color="var(--rw-surface-2)"
                label={`+${overflow}`}
                title={`${overflow} more`}
              />
            )}
          </span>

          <span className="rw-waverow-marks">
            {someoneHere && (
              <span className="rw-waverow-presence">
                <span className="rw-waverow-presence-dot" aria-hidden="true" />
                <span className="rw-waverow-presence-text">someone's here</span>
              </span>
            )}
            {unread > 0 && (
              <span className="rw-unread" aria-label={`${unread} unread`}>
                {unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
