import { useEffect, useRef, useState } from "react";
import { filterWaves, type WaveSummary } from "../wave/waveIndex";
import { WaveListItem } from "./WaveListItem";

/** Left inbox panel: New wave button, search box, and the keyboard-navigable wave list. */
export function WaveList(props: {
  waves: WaveSummary[];
  selectedId: string | null;
  presence: Set<string>;
  unreadOf: (waveId: string) => number;
  onOpen: (waveId: string) => void;
  onNewWave: () => void;
  onJoinWave: () => void;
}) {
  const { waves, selectedId, presence, unreadOf, onOpen, onNewWave, onJoinWave } = props;
  const [query, setQuery] = useState("");
  const visible = filterWaves(waves, query);

  // Roving tabindex across the rows (R9.4). Track which row is the active (tabbable) one.
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Keep the active index valid as the visible list changes; prefer the selected wave.
  useEffect(() => {
    const sel = visible.findIndex((w) => w.id === selectedId);
    if (sel >= 0) setActiveIndex(sel);
    else setActiveIndex((i) => Math.min(i, Math.max(0, visible.length - 1)));
  }, [selectedId, visible.length]);

  function focusRow(index: number) {
    const clamped = Math.max(0, Math.min(index, visible.length - 1));
    setActiveIndex(clamped);
    rowRefs.current[clamped]?.focus();
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (visible.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(activeIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(activeIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusRow(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusRow(visible.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const wave = visible[activeIndex];
      if (wave) onOpen(wave.id);
    }
  }

  return (
    <div className="rw-wavelist">
      <div className="rw-wavelist-head">
        <div className="rw-wavelist-actions">
          <button type="button" className="rw-newwave" onClick={onNewWave}>
            + New wave
          </button>
          <button type="button" className="rw-joinwave" onClick={onJoinWave}>
            Join Wave
          </button>
        </div>
        <input
          type="search"
          className="rw-wavelist-search"
          placeholder="Search waves"
          aria-label="Search waves by title or snippet"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {visible.length === 0 ? (
        <div className="rw-wavelist-empty">
          {query ? (
            <p className="rw-wavelist-empty-text">No waves match “{query}”.</p>
          ) : (
            <>
              <p className="rw-wavelist-empty-text">No waves yet. Start one.</p>
              <button type="button" className="rw-newwave" onClick={onNewWave}>
                + New wave
              </button>
            </>
          )}
        </div>
      ) : (
        <ul
          className="rw-wavelist-rows"
          role="listbox"
          aria-label="Waves"
          onKeyDown={onListKeyDown}
        >
          {visible.map((wave, i) => (
            <WaveListItem
              key={wave.id}
              wave={wave}
              selected={wave.id === selectedId}
              someoneHere={presence.has(wave.id)}
              unread={unreadOf(wave.id)}
              onOpen={() => onOpen(wave.id)}
              tabIndex={i === activeIndex ? 0 : -1}
              registerRef={(el) => (rowRefs.current[i] = el)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
