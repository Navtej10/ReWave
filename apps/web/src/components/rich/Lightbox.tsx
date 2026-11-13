import { useEffect, useRef } from "react";
import { DownloadLink } from "./FileBlip";
import { Modal } from "./Modal";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "./richIcons";
import type { Attachment } from "../../wave/types";

export interface LightboxProps {
  items: Attachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const SWIPE_PX = 48;

/** Full-screen viewer: warm 70% scrim, paper frame, arrows / Esc / swipe, focus trapped and restored by Modal. */
export function Lightbox({ items, index, onIndexChange, onClose }: LightboxProps) {
  const touchX = useRef<number | null>(null);
  const count = items.length;
  const current = items[Math.min(Math.max(index, 0), count - 1)];

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < count) onIndexChange(next);
  };

  // Arrow keys navigate; Esc is handled by Modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // go closes over index/count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  if (!current) return null;
  const caption = current.alt?.trim() || current.name;

  return (
    <Modal label={`Media viewer: ${caption}`} onClose={onClose} scrimClassName="rc-modal--lightbox" className="sketch sketch-a rc-lightbox">
      <div className="rc-lightbox__top">
        <span className="rc-lightbox__count" aria-live="polite">
          {index + 1} of {count}
        </span>
        <DownloadLink attachment={current} />
        <button type="button" className="sketch sketch-b rc-lightbox__close" aria-label="Close viewer" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>

      <div
        className="rc-lightbox__stage"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start === null || end === undefined) return;
          const dx = end - start;
          if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          className="sketch sketch-c rc-lightbox__nav rc-lightbox__nav--prev"
          aria-label="Previous"
          disabled={index <= 0}
          onClick={() => go(-1)}
        >
          <ArrowLeftIcon size={20} />
        </button>

        {current.kind === "video" ? (
          <video
            key={current.id}
            className="rc-lightbox__media"
            src={current.url}
            poster={current.posterUrl}
            controls
            playsInline
            preload="metadata"
            aria-label={caption}
          >
            {current.captionsUrl ? <track kind="captions" src={current.captionsUrl} srcLang="en" label="English" default /> : null}
          </video>
        ) : (
          <img
            key={current.id}
            className="rc-lightbox__media"
            src={current.url}
            alt={caption}
            width={current.width ?? 960}
            height={current.height ?? 640}
            decoding="async"
          />
        )}

        <button
          type="button"
          className="sketch sketch-b rc-lightbox__nav rc-lightbox__nav--next"
          aria-label="Next"
          disabled={index >= count - 1}
          onClick={() => go(1)}
        >
          <ArrowRightIcon size={20} />
        </button>
      </div>

      <p className="rc-lightbox__caption">{caption}</p>
    </Modal>
  );
}
