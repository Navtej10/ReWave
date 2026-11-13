export type AgentName = "scribe" | "skeptic" | "researcher";

export const AGENT_NAMES: readonly AgentName[] = ["scribe", "skeptic", "researcher"];

export type ConnectionStatus = "connecting" | "online" | "offline";

export interface Blip {
  id: string;
  authorName: string;
  text: string;
  createdAt: number;
  parentId: string | null;
  /** Set when an agent wrote this blip. */
  agent?: AgentName;
}

export interface Wave {
  id: string;
  /** Empty string means "untitled". */
  title: string;
  blips: Blip[];
}

export interface CurrentUser {
  id: string;
  name: string;
}

export const UNTITLED = "Untitled wave";

export function waveTitle(wave: Wave): string {
  return wave.title.trim() || UNTITLED;
}

export function waveSubtitle(wave: Wave): string {
  const n = wave.blips.length;
  if (n === 0) return "No blips yet";
  return n === 1 ? "1 blip" : `${n} blips`;
}

/** "Jo Ortiz" -> "JO", "Jo" -> "JO". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
