import { useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, hashString, seededRandom } from "../../wave/format";
import { ArrowDownIcon, PauseIcon, PlayIcon } from "./richIcons";
import type { Attachment } from "../../wave/types";

const BARS = 36;
const SPEEDS = [1, 1.5, 2] as const;

export function VoiceBlip({ voice }: { voice: Attachment }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(voice.durationSec ?? 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  // Slightly irregular bar heights, stable per attachment.
  const heights = useMemo(() => {
    const rand = seededRandom(hashString(voice.id));
    return Array.from({ length: BARS }, (_, i) => {
      const envelope = 0.45 + 0.4 * Math.sin((i / BARS) * Math.PI);
      return Math.round((envelope * 0.7 + rand() * 0.55) * 100) / 100;
    });
  }, [voice.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[speedIdx];
  }, [speedIdx]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  const progress = duration > 0 ? time / duration : 0;
  const speed = SPEEDS[speedIdx];

  return (
    <div className="sketch sketch-c rc-voice">
      <div className="rc-voice__row">
        <button
          type="button"
          className="sketch sketch-b rc-voice__play"
          aria-label={playing ? "Pause voice note" : "Play voice note"}
          onClick={toggle}
        >
          {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>

        <svg className="rc-wave" viewBox={`0 0 ${BARS * 5} 40`} preserveAspectRatio="none" role="img" aria-label="Voice note waveform">
          {heights.map((h, i) => {
            const bh = Math.max(4, h * 36);
            const x = i * 5 + 2.5 + (i % 3 === 0 ? 0.4 : -0.3);
            return (
              <line
                key={i}
                x1={x}
                x2={x + (i % 2 === 0 ? 0.3 : -0.3)}
                y1={20 - bh / 2}
                y2={20 + bh / 2}
                className={i / BARS < progress ? "is-played" : undefined}
              />
            );
          })}
        </svg>

        <span className="rc-voice__time">
          {formatDuration(playing || time > 0 ? time : duration)}
        </span>

        <button
          type="button"
          className="sketch sketch-a rc-voice__speed"
          aria-label={`Playback speed ${speed}x. Change speed`}
          onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
        >
          {speed}x
        </button>
      </div>

      <audio
        ref={audioRef}
        src={voice.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
      />

      <button
        type="button"
        className="rc-linkbtn rc-voice__tbtn"
        aria-expanded={showTranscript}
        onClick={() => setShowTranscript((v) => !v)}
      >
        <ArrowDownIcon size={12} className={showTranscript ? "rc-flip" : undefined} />
        Transcript
      </button>
      {showTranscript ? (
        <p className="rc-voice__transcript">
          {voice.transcript?.trim() || "No transcript yet. An agent can add one later."}
        </p>
      ) : null}
    </div>
  );
}
