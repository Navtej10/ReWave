import { useState } from "react";
import { cx } from "../ui/index";
import { hashString } from "../../wave/format";
import { PencilIcon, TapeCorner } from "./richIcons";
import type { Attachment } from "../../wave/types";

const MAX_VISIBLE = 4;

function altOf(a: Attachment): string {
  return a.alt?.trim() || a.name;
}

/** "Add description" link + inline editor. Alt text defaults to the filename. */
function AltEditor({ attachment, onChange }: { attachment: Attachment; onChange: (alt: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(attachment.alt ?? "");

  if (!editing) {
    return (
      <button type="button" className="rc-linkbtn" onClick={() => setEditing(true)}>
        <PencilIcon size={11} />
        {attachment.alt ? "Edit description" : "Add description"}
      </button>
    );
  }
  function commit() {
    onChange(value.trim());
    setEditing(false);
  }
  return (
    <form
      className="rc-alt"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <input
        className="sketch sketch-c ink-input rc-alt__input"
        aria-label={`Description for ${attachment.name}`}
        placeholder="Describe this image"
        value={value}
        maxLength={200}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setEditing(false);
          }
        }}
      />
      <button type="submit" className="rc-linkbtn">
        Save
      </button>
    </form>
  );
}

export interface ImageGridProps {
  images: Attachment[];
  canEditAlt: boolean;
  onOpen: (index: number) => void;
  onAltChange: (attachmentId: string, alt: string) => void;
}

/** 1 image: single frame (max 360px). 2: side by side. 3-4: 2x2. More than 4: "+N" on the fourth tile. */
export function ImageGrid({ images, canEditAlt, onOpen, onAltChange }: ImageGridProps) {
  const shown = images.slice(0, MAX_VISIBLE);
  const extra = images.length - shown.length;
  return (
    <div className={cx("rc-grid", `rc-grid--${Math.min(images.length, 4)}`)}>
      {shown.map((img, i) => (
        <figure key={img.id} className="rc-grid__cell">
          <button
            type="button"
            className="sketch sketch-auto rc-img"
            aria-label={`Open image: ${altOf(img)}`}
            onClick={() => onOpen(i)}
          >
            <img
              src={img.url}
              alt={altOf(img)}
              width={img.width ?? 640}
              height={img.height ?? 480}
              loading="lazy"
              decoding="async"
            />
            <TapeCorner className="rc-tape rc-tape--tl" />
            {extra > 0 && i === MAX_VISIBLE - 1 ? <span className="rc-img__more">+{extra}</span> : null}
          </button>
          {canEditAlt ? (
            <figcaption className="rc-grid__cap">
              <AltEditor attachment={img} onChange={(alt) => onAltChange(img.id, alt)} />
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

export interface ScreenshotBlipProps {
  screenshots: Attachment[];
  canEditAlt: boolean;
  onOpen: (index: number) => void;
  onAnnotate: (attachment: Attachment) => void;
  onAltChange: (attachmentId: string, alt: string) => void;
}

/** Taped polaroid: slight stable rotation, wide caption margin, optional Annotate. */
export function ScreenshotBlip({ screenshots, canEditAlt, onOpen, onAnnotate, onAltChange }: ScreenshotBlipProps) {
  return (
    <div className="rc-polaroids">
      {screenshots.map((s, i) => {
        // -1..1deg, stable per attachment so it does not jump between renders.
        const tilt = ((hashString(s.id) % 21) - 10) / 10;
        return (
          <figure key={s.id} className="rc-polaroid" data-tilt={tilt > 0.3 ? "r" : tilt < -0.3 ? "l" : "n"}>
            <TapeCorner className="rc-tape rc-tape--top" />
            <button
              type="button"
              className="rc-polaroid__shot"
              aria-label={`Open screenshot: ${altOf(s)}`}
              onClick={() => onOpen(i)}
            >
              <img
                src={s.url}
                alt={altOf(s)}
                width={s.width ?? 640}
                height={s.height ?? 400}
                loading="lazy"
                decoding="async"
              />
            </button>
            <figcaption className="rc-polaroid__cap">
              <span className="rc-polaroid__text">{s.alt?.trim() || s.name}</span>
              <span className="rc-polaroid__actions">
                <button type="button" className="rc-linkbtn" onClick={() => onAnnotate(s)}>
                  <PencilIcon size={11} />
                  Annotate
                </button>
                {canEditAlt ? <AltEditor attachment={s} onChange={(alt) => onAltChange(s.id, alt)} /> : null}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
