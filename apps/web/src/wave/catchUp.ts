import type { BlipView } from "./types";

const KEY_PREFIX = "rewave:lastvisit:";

/** Minimal slice of `Storage` so the logic is testable without a DOM. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** When this browser last looked at the wave (epoch ms), or null if it never has. Stored per wave, never synced. */
export function loadLastVisit(store: KeyValueStore, waveId: string): number | null {
  try {
    const n = Number(store.getItem(KEY_PREFIX + waveId));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveLastVisit(store: KeyValueStore, waveId: string, at: number): void {
  try {
    store.setItem(KEY_PREFIX + waveId, String(at));
  } catch {
    // Storage full or blocked: the digest simply won't be offered next time.
  }
}

/**
 * Blips other people (or agents) added after `since`. Deleted blips and my own are skipped, so the
 * digest only covers what I have not already seen.
 */
export function newSince(blips: readonly BlipView[], since: number | null, myName: string): BlipView[] {
  if (since === null) return [];
  const me = myName.trim().toLowerCase();
  return blips.filter((b) => !b.deleted && b.createdAt > since && b.author.trim().toLowerCase() !== me);
}
