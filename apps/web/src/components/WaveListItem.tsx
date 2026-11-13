import { deriveTitle, type WaveSummary } from "../wave/waveIndex";
import { Avatar } from "./Avatar";
import { Sparkle } from "./ui/index";
import { relativeTime } from "./ui";

/** One row in the wave list: title, snippet + author, time, participants, presence, unread.
 *  Presentational only — selection, presence and unread are passed in. */
export function WaveListItem(props: {
  wave: WaveSummary;
  selected: boolean;
  /** Hand-drawn corner shape, rotated among rows. */
  shape: "a" | "b" | "c";
  someoneHere: boolean;
  unread: number;
  onOpen: () => void;
  /** Roving tabindex: only the active row is tabbable (keyboard nav in WaveList). */
  tabIndex: number;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const { wave, selected, shape, someoneHere, unread, onOpen, tabIndex, registerRef } = props;
  const title = deriveTitle(wave);
  const shown = wave.participants.slice(0, 3);
  const overflow = wave.participants.length - shown.length;
  const snippet = wave.lastSnippet
    ? `${wave.lastAuthor ? `${wave.lastAuthor}: ` : ""}${wave.lastSnippet}`
    : "No blips yet";
  const hasFoot = shown.length > 0 || someoneHere || unread > 0;

  return (
    <li role="presentation">
      <button
        type="button"
        ref={registerRef}
        className={`rw-waverow sketch sketch-${shape} sketch-double${selected ? " is-selected" : ""}`}
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

        {hasFoot && (
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
        )}

        {selected ? (
          <>
            <Sparkle size={10} rotate={-10} className="rw-spark rw-spark--tl" />
            <Sparkle size={14} rotate={8} className="rw-spark rw-spark--br" />
            <Sparkle size={10} rotate={14} className="rw-spark rw-spark--l" />
          </>
        ) : (
          <>
            <Sparkle size={16} rotate={6} className="rw-spark rw-spark--tr1" />
            <Sparkle size={12} rotate={-12} className="rw-spark rw-spark--tr2" />
          </>
        )}
      </button>
    </li>
  );
}
