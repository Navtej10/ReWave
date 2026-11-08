// Per-user membership list logic. Pure: plain transforms over the membership array so
// join/leave/mark-read and tolerant parsing are unit- and property-testable, and the React
// hook (useMyWaves) stays thin. This list is PRIVATE — it lives only in the user's browser
// (localStorage key `rewave:mywaves`) and is never synced. See
// .kiro/specs/06-multi-wave/design.md.

import { isValidWaveId } from "./waveId";

/** One joined wave in the user's private list. `lastSeenCount` backs the unread badge. */
export interface Membership {
  id: string;
  joinedAt: number;
  lastSeenCount: number;
}

/** localStorage key for the whole membership list. */
export const MY_WAVES_KEY = "rewave:mywaves";

/** Coerce an unknown value into a finite, non-negative integer (default 0). */
function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Tolerantly parse the stored membership JSON (R1.2). Any failure — missing value, bad JSON,
 * non-array, or malformed/duplicate/invalid entries — yields a clean list without throwing.
 * Entries whose id fails `isValidWaveId` are dropped; the first occurrence of each id wins.
 */
export function parseMemberships(raw: string | null): Membership[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const out: Membership[] = [];
  const seen = new Set<string>();
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== "string" || !isValidWaveId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      joinedAt: toCount((entry as { joinedAt?: unknown }).joinedAt),
      lastSeenCount: toCount((entry as { lastSeenCount?: unknown }).lastSeenCount),
    });
  }
  return out;
}

/** Serialize the membership list for storage. */
export function serializeMemberships(list: Membership[]): string {
  return JSON.stringify(list);
}

/**
 * Add a wave to the list (R1.3). Idempotent: joining a wave already present returns the list
 * unchanged (keeping its original `joinedAt` and `lastSeenCount`). Invalid ids are ignored.
 */
export function joinMembership(list: Membership[], id: string, now: number): Membership[] {
  if (!isValidWaveId(id)) return list;
  if (list.some((m) => m.id === id)) return list;
  return [...list, { id, joinedAt: now, lastSeenCount: 0 }];
}

/** Remove a wave from the list (R1.4). Removing an absent id returns the list unchanged. */
export function leaveMembership(list: Membership[], id: string): Membership[] {
  if (!list.some((m) => m.id === id)) return list;
  return list.filter((m) => m.id !== id);
}

/** Set a wave's last-seen blip count (used by open/mark-read and own-post, R6). */
export function markReadMembership(
  list: Membership[],
  id: string,
  count: number,
): Membership[] {
  const next = Math.max(0, Math.floor(count));
  let changed = false;
  const updated = list.map((m) => {
    if (m.id !== id || m.lastSeenCount === next) return m;
    changed = true;
    return { ...m, lastSeenCount: next };
  });
  return changed ? updated : list;
}

/** The stored last-seen count for a wave, or 0 if it is not in the list. */
export function lastSeenOf(list: Membership[], id: string): number {
  return list.find((m) => m.id === id)?.lastSeenCount ?? 0;
}

/** True when the user has joined this wave. */
export function isMember(list: Membership[], id: string): boolean {
  return list.some((m) => m.id === id);
}
