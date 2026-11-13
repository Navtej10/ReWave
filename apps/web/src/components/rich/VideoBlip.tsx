import { useRef, useState } from "react";
import { Chip } from "../ui/index";
import { formatDuration } from "../../wave/format";
import { DownloadLink } from "./FileBlip";
import { FilmIcon, PauseIcon, PlayIcon } from "./richIcons";
import type { Attachment } from "../../wave/types";

/** Big hand-drawn play button. Decorative; the wrapping button carries the label. */
function BigPlay() {
  return (
    <svg className="rc-bigplay" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" focusable="false">
      <path d="M32 4.5c15.5-.4 27.6 11.6 27.4 27.6C59.2 47.8 47 59.8 31.6 59.4 16.4 59.1 4.2 47.2 4.6 31.8 5 16.6 16.8 4.9 32 4.5Z" />
      <path d="M25 19.5c.2-1.6 1.8-2.3 3.2-1.4l17.6 11.2c1.3.8 1.3 2.4 0 3.2L28.3 43.6c-1.4.9-3.1.2-3.3-1.4Z" />
    </svg>
  );
}

export function VideoBlip({ video }: { video: Attachment }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSec ?? 0);
  const [failed, setFailed] = useState(false);

  const label = video.alt?.trim() || video.name;

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  // The <video> only mounts after a click, so nothing is fetched until the reader asks (lazy by design).
  if (!started) {
    return (
      <div className="sketch sketch-a rc-video">
        <button
          type="button"
          className="rc-video__poster"
          aria-label={`Play video: ${label}`}
          onClick={() => setStarted(true)}
        >
          {video.posterUrl ? (
            <img
              src={video.posterUrl}
              alt=""
              width={video.width ?? 640}
              height={video.height ?? 360}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="rc-video__blank" aria-hidden="true">
              <FilmIcon size={40} />
            </span>
          )}
          <BigPlay />
          {duration > 0 ? <Chip className="rc-video__dur">{formatDuration(duration)}</Chip> : null}
        </button>
      </div>
    );
  }

  return (
    <div className="sketch sketch-a rc-video is-playing">
      {failed ? (
        <div className="rc-video__error" role="alert">
          <p>This video can&rsquo;t be played here.</p>
          <DownloadLink attachment={video} />
        </div>
      ) : (
        <video
          ref={ref}
          className="rc-video__el"
          src={video.url}
          poster={video.posterUrl}
          preload="metadata"
          playsInline
          autoPlay
          width={video.width ?? 640}
          height={video.height ?? 360}
          aria-label={label}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
          onError={() => setFailed(true)}
        >
          {video.captionsUrl ? <track kind="captions" src={video.captionsUrl} srcLang="en" label="English" default /> : null}
        </video>
      )}
      {failed ? null : (
        <div className="rc-vbar">
          <button
            type="button"
            className="sketch sketch-b rc-vbar__btn"
            aria-label={playing ? "Pause" : "Play"}
            onClick={toggle}
          >
            {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <input
            type="range"
            className="rc-vbar__seek"
            aria-label="Seek"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              const v = ref.current;
              if (v) v.currentTime = Number(e.target.value);
            }}
          />
          <span className="rc-vbar__time">
            {formatDuration(time)} / {formatDuration(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
