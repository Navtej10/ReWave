// Small presentational helpers shared across UI components. No Yjs, no sync, no state.

import type { BlipView } from "../wave/types";

/** Relative time like "just now", "2m ago", "3h ago", "5d ago". */
export function relativeTime(createdAt: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - createdAt);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(createdAt).toLocaleDateString();
}

/** Up to two uppercase initials from a display name. */
export function initials(name: string): string {
  const parts = name.replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic HSL background from a name. The one allowed dynamic inline style. */
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 45%)`;
}

/** True when a blip was authored by the current user (name-based, matches presence). */
export function isOwnBlip(blip: BlipView, myName: string): boolean {
  return blip.kind === "human" && blip.author === myName;
}
