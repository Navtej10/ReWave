import { domainOf, formatSize } from "./format";
import type { Attachment, AttachmentKind, BlipView, ContentKind, LinkPreview } from "./types";

/** Configurable limits. */
export const MAX_ATTACHMENTS = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface AttachmentLimits {
  maxCount: number;
  maxBytes: number;
}
export const DEFAULT_LIMITS: AttachmentLimits = { maxCount: MAX_ATTACHMENTS, maxBytes: MAX_FILE_BYTES };

export interface AddFilesOptions {
  /** Force a kind, e.g. "screenshot" for pasted images or "voice" for recordings. */
  kind?: AttachmentKind;
  durationSec?: number;
}

const ACCEPTED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "rtf", "txt", "md", "csv", "zip", "7z", "rar", "tar", "gz",
]);
const ACCEPTED_MIME =
  /^(image\/|video\/|application\/(pdf|zip|x-zip-compressed|x-7z-compressed|vnd\.rar|x-rar-compressed|gzip|x-tar|msword|rtf)|application\/vnd\.(openxmlformats-officedocument|ms-|oasis\.opendocument)|text\/(plain|csv|markdown))/;

/** Value for <input accept>. */
export const ACCEPT_ATTR =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,.txt,.md,.csv,.zip,.7z,.rar,.tar,.gz";
export const ACCEPT_MEDIA_ATTR = "image/*,video/*";

function extOf(name: string): string {
  return name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
}

export function isAcceptedFile(file: File): boolean {
  return ACCEPTED_MIME.test(file.type) || ACCEPTED_EXT.has(extOf(file.name));
}

export function kindOfFile(file: File, hint?: AttachmentKind): AttachmentKind {
  if (hint === "screenshot" && file.type.startsWith("image/")) return "screenshot";
  if (hint === "voice" && file.type.startsWith("audio/")) return "voice";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

export interface PlannedFile {
  file: File;
  kind: AttachmentKind;
}
export interface AttachmentPlan {
  accepted: PlannedFile[];
  errors: string[];
}

/** Decide which of `files` can be attached given what is already in the tray. Pure. */
export function planAttachments(
  existingCount: number,
  files: readonly File[],
  hint?: AttachmentKind,
  limits: AttachmentLimits = DEFAULT_LIMITS,
): AttachmentPlan {
  const accepted: PlannedFile[] = [];
  const errors: string[] = [];
  let overCount = false;
  for (const file of files) {
    if (!isAcceptedFile(file) && !(hint === "voice" && file.type.startsWith("audio/"))) {
      errors.push(`${file.name || "That file"} isn\u2019t a supported type. Use images, videos, PDFs, docs or zips.`);
    } else if (file.size > limits.maxBytes) {
      errors.push(`${file.name || "That file"} is ${formatSize(file.size)}. The limit is ${formatSize(limits.maxBytes)} per file.`);
    } else if (existingCount + accepted.length >= limits.maxCount) {
      overCount = true;
    } else {
      accepted.push({ file, kind: kindOfFile(file, hint) });
    }
  }
  if (overCount) errors.push(`You can attach up to ${limits.maxCount} files per blip.`);
  return { accepted, errors };
}

export function createAttachment(
  id: string,
  file: File,
  kind: AttachmentKind,
  durationSec?: number,
): Attachment {
  return {
    id,
    kind,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    url: URL.createObjectURL(file),
    durationSec,
    status: "queued",
    progress: 0,
  };
}

/** Pasted clipboard images arrive as "image.png"; give them a useful name. */
export function nameScreenshot(file: File): File {
  if (!/^image\.\w+$/i.test(file.name)) return file;
  const ext = file.type.split("/")[1] || "png";
  return new File([file], `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`, {
    type: file.type,
  });
}

export function revokeIfBlob(url: string | undefined): void {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

export interface MediaProbe {
  width?: number;
  height?: number;
  durationSec?: number;
}

/** Read intrinsic size / duration so the layout can reserve space. Never rejects. */
export function probeMedia(kind: AttachmentKind, url: string): Promise<MediaProbe> {
  return new Promise((resolve) => {
    if (kind === "image" || kind === "screenshot") {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = url;
    } else if (kind === "video") {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () =>
        resolve({
          width: v.videoWidth || undefined,
          height: v.videoHeight || undefined,
          durationSec: Number.isFinite(v.duration) ? v.duration : undefined,
        });
      v.onerror = () => resolve({});
      v.src = url;
    } else {
      resolve({});
    }
  });
}

/** Grab one frame of a screen / window / tab the user picks. Rejects if cancelled or unsupported. */
export async function captureScreenFile(): Promise<File> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("unsupported");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("capture failed"));
    });
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("capture failed");
    return new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** The clipboard text is exactly one http(s) URL. */
export function extractUrl(text: string): string | null {
  const t = text.trim();
  return /^https?:\/\/[^\s<>]+$/i.test(t) ? t : null;
}

/**
 * Offline stand-in for a real unfurl service: derives a title from the URL.
 * Swap for a server call that returns title / description / thumbnail.
 */
export function buildLinkPreview(url: string): LinkPreview {
  const domain = domainOf(url);
  let title = domain;
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) title = decodeURIComponent(last).replace(/[-_]+/g, " ").replace(/\.\w+$/, "");
  } catch {
    /* keep the domain */
  }
  return { url, title: title.charAt(0).toUpperCase() + title.slice(1), domain };
}

export function deriveKind(parts: {
  poll?: unknown;
  code?: unknown;
  link?: unknown;
  attachments?: readonly Attachment[];
}): ContentKind {
  if (parts.poll) return "poll";
  const first = parts.attachments?.[0];
  if (first) {
    if (first.kind === "image" && first.name.startsWith("sketch-")) return "sketch";
    return first.kind;
  }
  if (parts.code) return "code";
  if (parts.link) return "link";
  return "text";
}

export function isMedia(a: Attachment): boolean {
  return a.kind === "image" || a.kind === "screenshot" || a.kind === "video";
}

export function allAttachments(blips: readonly BlipView[]): Attachment[] {
  return blips.flatMap((b) => b.attachments ?? []);
}
