// Wave ids and share links. Pure logic (the one dependency is `crypto` for generation and
// `location` inside the link helper), so the core is unit- and property-testable.
// See .kiro/specs/07-share-links/design.md. The wave id is the share capability: it must be
// unguessable, so we use >=128 random bits encoded url-safe.
//
// THIS FILE IS THE SOURCE OF TRUTH for what a valid wave id is. The collab sync server
// mirrors `isValidWaveId` (apps/collab/src/index.ts) with a comment pointing back here.

/** 128 bits of entropy -> 16 random bytes. */
const WAVE_ID_BYTES = 16;
/** 16 bytes base64 (no padding) is ceil(16 * 4 / 3) = 22 characters. */
export const WAVE_ID_LENGTH = 22;
/** url-safe base64 alphabet, fixed length. Keep in sync with the server rule. */
const WAVE_ID_RE = /^[A-Za-z0-9_-]{22}$/;
/** Reserved: the old shared document name must never be a valid wave id. */
const RESERVED_IDS = new Set(["index"]);

/** Encode raw bytes as url-safe base64 without padding. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a fresh, unguessable wave id: 128 bits from `crypto.getRandomValues`, encoded as
 * ~22 url-safe base64 characters. Every result satisfies `isValidWaveId` (R1).
 */
export function generateWaveId(): string {
  const bytes = new Uint8Array(WAVE_ID_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/**
 * The single rule for a legal wave id (R2): exactly 22 url-safe base64 chars and not a
 * reserved name. The empty string, short strings, and strings with other characters all
 * fail. The server mirrors this rule to refuse non-wave rooms.
 */
export function isValidWaveId(id: string): boolean {
  if (typeof id !== "string") return false;
  if (RESERVED_IDS.has(id)) return false;
  return WAVE_ID_RE.test(id);
}

/** Build a shareable invite link for a wave: `${location.origin}/#${waveId}` (R3.1). */
export function buildInviteLink(waveId: string): string {
  return `${location.origin}/#${waveId}`;
}

/**
 * Recover a wave id from a URL hash. Accepts `#<id>` and the legacy `#<id>/<name>` form
 * (the part before the first "/"). Returns null when the hash carries no id (R3.2/R3.3).
 * Does NOT validate — callers use `isValidWaveId` to decide how to route.
 */
export function parseWaveIdFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  const id = raw.split("/")[0];
  return id || null;
}

/**
 * Recover a wave id from whatever a user pastes into the Join box: a full invite link
 * (`https://host/#<id>`), a bare `#<id>`, or just the id itself. Tolerant of surrounding
 * whitespace and a trailing legacy `/<name>` segment. Returns null when nothing id-like is
 * found. Does NOT validate — callers use `isValidWaveId` to decide how to route.
 */
export function parseWaveIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Prefer the hash fragment if the paste contains one (full link or bare "#id").
  const hashAt = trimmed.indexOf("#");
  if (hashAt >= 0) return parseWaveIdFromHash(trimmed.slice(hashAt));
  // Otherwise treat it as a bare id, dropping any legacy "/<name>" tail.
  const id = trimmed.split("/")[0];
  return id || null;
}
