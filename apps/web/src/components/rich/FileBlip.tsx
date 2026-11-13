import { cx } from "../ui/index";
import { fileTypeOf, formatSize } from "../../wave/format";
import { DownloadIcon, FileTypeIcon } from "./richIcons";
import type { Attachment } from "../../wave/types";

/** Anchor styled as a ghost Button (a real link so `download` works). */
export function DownloadLink({ attachment, className, label = "Download" }: { attachment: Attachment; className?: string; label?: string }) {
  const ready = attachment.status === "done" || attachment.status === "queued" || attachment.status === "uploading";
  return (
    <a
      className={cx("sketch sketch-auto ink-btn ink-btn--ghost rc-dl", className)}
      href={attachment.url}
      download={attachment.name}
      aria-label={`${label} ${attachment.name}`}
      aria-disabled={!ready}
    >
      <DownloadIcon size={14} />
      {label}
    </a>
  );
}

export function FileBlip({ file }: { file: Attachment }) {
  const type = fileTypeOf(file.name, file.mimeType);
  return (
    <div className="sketch sketch-b rc-file">
      <span className="rc-file__icon">
        <FileTypeIcon type={type} size={34} />
      </span>
      <span className="rc-file__meta">
        <span className="rc-file__name" title={file.name}>
          {file.name}
        </span>
        <span className="rc-file__sub">
          {type === "generic" ? "File" : type.toUpperCase()} &middot; {formatSize(file.size)}
        </span>
      </span>
      <DownloadLink attachment={file} />
    </div>
  );
}
