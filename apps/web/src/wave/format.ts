import type { BlipView } from "./types";

/** Small pure helpers shared by the rich-content components. */

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** 75 -> "1:15" */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) so doodles stay stable between renders. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FileType = "pdf" | "doc" | "sheet" | "zip" | "generic";

export function fileTypeOf(name: string, mimeType: string): FileType {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (/zip|compressed|tar|gzip/.test(mimeType) || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
  if (/spreadsheet|excel|csv/.test(mimeType) || ["xls", "xlsx", "csv", "ods"].includes(ext)) return "sheet";
  if (/word|document|rtf|opendocument\.text/.test(mimeType) || ["doc", "docx", "rtf", "odt", "txt", "md"].includes(ext)) {
    return "doc";
  }
  return "generic";
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** One-line description of a blip for quotes, pins and decision links. */
export function blipExcerpt(b: BlipView, max = 90): string {
  let s = b.text.trim();
  if (!s) {
    if (b.poll) s = `Poll: ${b.poll.question}`;
    else if (b.card?.agent === "scribe") s = `Summary: ${b.card.summary}`;
    else if (b.card?.agent === "skeptic") s = `Counterpoint: ${b.card.counterpoint}`;
    else if (b.card?.agent === "researcher") s = `Sources: ${b.card.sources.map((x) => x.title).join(", ")}`;
    else if (b.attachments?.length) s = b.attachments.map((a) => a.name).join(", ");
    else if (b.link) s = b.link.title || b.link.url;
    else if (b.code) s = `Code (${b.code.language})`;
    else s = "(empty blip)";
  }
  s = s.replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}\u2026` : s;
}

/** Locale-aware, case-insensitive-ish plural helper. */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
